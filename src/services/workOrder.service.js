import crypto from 'crypto';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { FacilityRepository } from '../repositories/facility.repository.js';
import { WorkflowService } from './workflow.service.js';
import { NotificationService } from './notification.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { WORK_ORDER_STATUS } from '../config/constants.js';

import { StatusEventRepository, GENESIS_HASH } from '../repositories/statusEvent.repository.js';
import { InspectionRepository } from '../repositories/inspection.repository.js';
import { computeEventHash } from '../utils/crypto.js';

export class WorkOrderService {
  static async getAllWorkOrders(query, currentUser) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;

    const filter = {
      facilityId: query.facility_id || undefined,
      status: query.status,
      priority: query.priority,
      category: query.category,
      search: query.search,
      limit,
      offset
    };

    const [workOrders, total] = await Promise.all([
      WorkOrderRepository.findAll(filter),
      WorkOrderRepository.countAll(filter)
    ]);

    return {
      workOrders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getWorkOrderById(id, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    const [photos, inspections, events] = await Promise.all([
      WorkOrderRepository.getPhotos(id),
      InspectionRepository.findByWorkOrderId(id),
      StatusEventRepository.getEventsByWorkOrderId(id)
    ]);

    // Blind Quoting Governance:
    // If currentUser is CONTRACTOR, assessor_estimate, assessment_notes, and internal estimated_cost are redacted.
    const isContractor = currentUser && (currentUser.role === 'CONTRACTOR' || currentUser.role === 'contractor');
    if (isContractor) {
      workOrder.assessor_estimate = null;
      workOrder.assessment_notes = null;
      workOrder.estimated_cost = null;
    }

    return {
      ...workOrder,
      is_blind_quoted: !!isContractor,
      photos,
      inspections,
      events
    };
  }

  static async assignLeadAssessor(id, { leadAssessorId, leadAssessorRole }, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    if (currentUser.role !== 'APPROVER' && currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Quantum Built Managers / Approvers can assign Lead Assessors');
    }

    const assignedUser = await UserRepository.findById(leadAssessorId);
    if (!assignedUser) {
      throw AppError.notFound('Assessor user not found');
    }

    await WorkOrderRepository.update(id, {
      lead_assessor_id: leadAssessorId,
      lead_assessor_role: leadAssessorRole || assignedUser.inspector_scope || 'works_inspector',
      assessor_id: leadAssessorId
    });

    // Notify assigned Lead Assessor
    try {
      await NotificationService.sendNotification({
        userId: leadAssessorId,
        title: `Assigned as Lead Assessor: ${workOrder.tracking_number}`,
        message: `You have been designated as Lead Assessor for ${workOrder.tracking_number} (${workOrder.title}) by ${currentUser.name}. Please conduct technical scoping and submit preliminary estimate.`,
        type: 'warning',
        link: `/work-orders/${id}`
      });
    } catch (notifErr) {
      console.warn('Failed to send lead assessor notification:', notifErr.message);
    }

    // Record Audit Event
    try {
      await StatusEventRepository.recordEvent({
        workOrderId: id,
        status: 'lead_assigned',
        actorId: currentUser.id,
        notes: `Lead Works Assessor designated by Quantum Built (${currentUser.name}): ${assignedUser.name} (${leadAssessorRole || 'Works Inspector'})`
      });
    } catch (auditErr) {
      console.warn('Failed to record lead assessor audit event:', auditErr.message);
    }

    return this.getWorkOrderById(id, currentUser);
  }

  static async requestEngineer(id, { reason }, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    if (currentUser.role !== 'INSPECTOR' && currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Lead Works Inspectors can request an engineer from Quantum Built');
    }

    await WorkOrderRepository.update(id, {
      assessor_request_engineer: 1,
      assessor_request_reason: reason || 'Technical engineering scoping required',
      assessor_request_status: 'pending'
    });

    // Notify Quantum Built Approvers & Admins
    try {
      const approvers = await UserRepository.findAll({ role: 'APPROVER' });
      const admins = await UserRepository.findAll({ role: 'ADMIN' });
      const recipients = [...approvers, ...admins];

      for (const r of recipients) {
        await NotificationService.sendNotification({
          userId: r.id,
          title: `Engineer Requested by Lead Inspector: ${workOrder.tracking_number}`,
          message: `${currentUser.name} requested an Engineer for ${workOrder.tracking_number}. Reason: "${reason}". Action Required: Fulfill or Decline request.`,
          type: 'warning',
          link: `/work-orders/${id}`
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send engineer request notification:', notifErr.message);
    }

    // Record Audit Event
    try {
      await StatusEventRepository.recordEvent({
        workOrderId: id,
        status: 'engineer_requested',
        actorId: currentUser.id,
        notes: `Lead Inspector ${currentUser.name} requested Works Engineer referral from Quantum Built. Reason: ${reason}`
      });
    } catch (auditErr) {
      console.warn('Failed to record engineer request audit event:', auditErr.message);
    }

    return this.getWorkOrderById(id, currentUser);
  }

  static async handleEngineerRequest(id, { action, engineerId, declineReason }, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    if (currentUser.role !== 'APPROVER' && currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Quantum Built can fulfill or decline engineer requests');
    }

    if (action === 'fulfill') {
      const engineer = engineerId ? await UserRepository.findById(engineerId) : null;
      await WorkOrderRepository.update(id, {
        assessor_request_status: 'fulfilled',
        assessor_request_engineer_id: engineerId || 'usr_inspector_02',
        assessor_role: 'works_engineer'
      });

      // Notify Engineer & Lead Inspector
      try {
        if (engineerId) {
          await NotificationService.sendNotification({
            userId: engineerId,
            title: `Joined Assessment Session: ${workOrder.tracking_number}`,
            message: `Quantum Built assigned you to join the assessment session for ${workOrder.tracking_number} (${workOrder.title}).`,
            type: 'warning',
            link: `/work-orders/${id}`
          });
        }
        if (workOrder.lead_assessor_id) {
          await NotificationService.sendNotification({
            userId: workOrder.lead_assessor_id,
            title: `Engineer Assigned to Assessment: ${workOrder.tracking_number}`,
            message: `Quantum Built fulfilled your request. Works Engineer ${engineer?.name || 'David Vance'} has joined the assessment session.`,
            type: 'success',
            link: `/work-orders/${id}`
          });
        }
      } catch (notifErr) {
        console.warn('Failed to notify fulfill engineer request:', notifErr.message);
      }
    } else {
      await WorkOrderRepository.update(id, {
        assessor_request_status: 'declined',
        assessment_adjustment_notes: declineReason || 'Engineer request declined by Quantum Built. Please carry on assessment alone.'
      });

      if (workOrder.lead_assessor_id) {
        try {
          await NotificationService.sendNotification({
            userId: workOrder.lead_assessor_id,
            title: `Engineer Request Declined: ${workOrder.tracking_number}`,
            message: `Quantum Built declined the engineer request. Reason: "${declineReason || 'Please carry on assessment alone'}". You can proceed with the estimate.`,
            type: 'info',
            link: `/work-orders/${id}`
          });
        } catch (notifErr) {
          console.warn('Failed to notify decline engineer request:', notifErr.message);
        }
      }
    }

    // Record Audit Event
    try {
      await StatusEventRepository.recordEvent({
        workOrderId: id,
        status: action === 'fulfill' ? 'engineer_fulfilled' : 'engineer_declined',
        actorId: currentUser.id,
        notes: action === 'fulfill'
          ? `Quantum Built (${currentUser.name}) fulfilled engineer referral. Assigned Works Engineer: ${engineerId || 'David Vance'}`
          : `Quantum Built (${currentUser.name}) declined engineer request. Reason: ${declineReason || 'Carry on assessment alone'}`
      });
    } catch (auditErr) {
      console.warn('Failed to record handle engineer audit event:', auditErr.message);
    }

    return this.getWorkOrderById(id, currentUser);
  }

  static async reviewEstimate(id, { action, adjustmentNotes }, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    if (currentUser.role !== 'APPROVER' && currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Quantum Built Managers / Approvers can review engineering estimates');
    }

    if (action === 'approve') {
      await WorkOrderRepository.update(id, {
        assessment_review_status: 'approved',
        assessor_request_status: workOrder.assessor_request_status === 'pending' ? 'fulfilled' : workOrder.assessor_request_status,
        approved_by: currentUser.id
      });

      // Transition Work Order to Approved status via immutable ledger workflow
      if (workOrder.status === 'reported') {
        await WorkflowService.transitionStatus({
          workOrderId: id,
          targetStatus: 'approved',
          actor: currentUser,
          notes: `Quantum Built (${currentUser.name}) approved engineering assessment & preliminary estimate of R ${Number(workOrder.assessor_estimate || workOrder.estimated_cost || 0).toLocaleString('en-ZA')}.`
        });
      }
    } else if (action === 'adjust') {
      await WorkOrderRepository.update(id, {
        assessment_review_status: 'adjusted',
        assessment_adjustment_notes: adjustmentNotes || 'Quantum Built requested adjustment on preliminary estimate.'
      });

      try {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'assessment_adjusted',
          actorId: currentUser.id,
          notes: `Quantum Built (${currentUser.name}) requested scoping adjustment on preliminary estimate. Notes: "${adjustmentNotes || 'Please revise and resubmit.'}"`
        });
      } catch (auditErr) {
        console.warn('Failed to record adjustment audit event:', auditErr.message);
      }

      // Notify Lead Assessor to adjust
      if (workOrder.lead_assessor_id || workOrder.assessor_id) {
        try {
          await NotificationService.sendNotification({
            userId: workOrder.lead_assessor_id || workOrder.assessor_id,
            title: `Assessment Adjustment Requested: ${workOrder.tracking_number}`,
            message: `Quantum Built (${currentUser.name}) requested adjustments on estimate. Notes: "${adjustmentNotes}". Please revise and resubmit.`,
            type: 'warning',
            link: `/work-orders/${id}`
          });
        } catch (notifErr) {
          console.warn('Failed to send adjustment notification:', notifErr.message);
        }
      }
    } else if (action === 'reject') {
      await WorkOrderRepository.update(id, {
        assessment_review_status: 'rejected',
        assessment_adjustment_notes: adjustmentNotes || 'Assessment rejected by Quantum Built. Reassignment required.',
        assessor_estimate: null,
        assessment_type: null,
        lead_assessor_id: null,
        lead_assessor_role: null
      });

      try {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'assessment_rejected',
          actorId: currentUser.id,
          notes: `Quantum Built (${currentUser.name}) rejected preliminary estimate. Reason: "${adjustmentNotes || 'Assessment rejected.'}". Ticket returned for lead reassignment.`
        });
      } catch (auditErr) {
        console.warn('Failed to record rejection audit event:', auditErr.message);
      }

      // Notify Lead Assessor of rejection
      if (workOrder.lead_assessor_id || workOrder.assessor_id) {
        try {
          await NotificationService.sendNotification({
            userId: workOrder.lead_assessor_id || workOrder.assessor_id,
            title: `Assessment Rejected: ${workOrder.tracking_number}`,
            message: `Quantum Built (${currentUser.name}) rejected the assessment. Reason: "${adjustmentNotes}". Ticket returned for lead reassignment.`,
            type: 'critical',
            link: `/work-orders/${id}`
          });
        } catch (notifErr) {
          console.warn('Failed to send rejection notification:', notifErr.message);
        }
      }
    }

    return this.getWorkOrderById(id, currentUser);
  }

  static async submitAssessment(id, assessmentData, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    if (currentUser.role !== 'INSPECTOR' && currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Forbidden: Technical engineering assessments can only be submitted by Site Engineers or Site Inspectors.');
    }
    const {
      assessment_type,
      assessor_role,
      assessor_estimate,
      charge_code,
      assessment_notes,
      route_b_override,
      refer_to_engineer,
      assessment_hours,
      estimated_days,
      due_date
    } = assessmentData;

    // Handle Referral to Works Engineer by Inspector
    if (refer_to_engineer) {
      return this.requestEngineer(id, { reason: assessment_notes || 'Technical engineering scoping required' }, currentUser);
    }

    const numericEstimate = Number(assessor_estimate) || 0;

    // Automated Funding Threshold Dispatcher:
    // Route B (Advance Funded Float): <= R50,000 OR Critical 0–24h OR QB Elects/Overrides (> R50k with reasoning note)
    // Route A (Client Funded / Formal Quote Approval): > R50,000 (Default)
    let fundingRoute = 'route_b';
    let isQbOverride = false;

    if (workOrder.urgency_category === 'Critical 0–24h') {
      fundingRoute = 'route_b';
    } else if (numericEstimate > 50000) {
      if (route_b_override && assessment_notes && assessment_notes.trim().length > 0) {
        fundingRoute = 'route_b';
        isQbOverride = true;
      } else {
        fundingRoute = 'route_a';
      }
    } else {
      fundingRoute = 'route_b';
    }

    let calculatedDueDate = due_date || workOrder.due_date || null;
    if (estimated_days !== undefined && estimated_days !== '' && Number(estimated_days) > 0) {
      calculatedDueDate = new Date(Date.now() + Number(estimated_days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const numericEstimatedDays = estimated_days !== undefined && estimated_days !== '' && Number(estimated_days) > 0 ? Number(estimated_days) : null;

    await WorkOrderRepository.update(id, {
      assessment_type,
      assessor_role: assessor_role || workOrder.lead_assessor_role || 'works_inspector',
      assessor_id: currentUser.id,
      assessor_estimate: numericEstimate,
      estimated_cost: numericEstimate,
      charge_code,
      assessment_hours: assessment_hours !== undefined && assessment_hours !== '' ? Number(assessment_hours) : null,
      estimated_days: numericEstimatedDays,
      due_date: calculatedDueDate,
      assessment_review_status: 'pending',
      assessor_request_status: workOrder.assessor_request_status === 'pending' ? 'fulfilled' : workOrder.assessor_request_status,
      assessment_notes: assessment_notes || null,
      assessment_date: new Date().toISOString(),
      funding_route: fundingRoute
    });

    // Record Immutable Status/Audit Event for Ledger
    try {
      const routeLabel = isQbOverride
        ? 'Route B (QB Special Override > R50,000 with recorded reasoning)'
        : fundingRoute === 'route_b'
        ? 'Route B (Advance Funded <= R50,000)'
        : 'Route A (Client Funded > R50,000)';

      const hoursNote = assessment_hours ? `, Logged Time: ${assessment_hours} hrs` : '';
      const daysNote = numericEstimatedDays ? `, SLA: ${numericEstimatedDays} days` : '';

      await StatusEventRepository.recordEvent({
        workOrderId: id,
        status: 'assessment_submitted',
        actorId: currentUser.id,
        notes: `Engineering Assessment completed: Mode=${assessment_type.toUpperCase()}, ChargeCode=${charge_code}, Estimate=R ${numericEstimate.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}${hoursNote}${daysNote}. Automated Routing: ${routeLabel}.${assessment_notes ? ` Notes: ${assessment_notes}` : ''}`
      });
    } catch (auditErr) {
      console.warn('Failed to record assessment audit event:', auditErr.message);
    }

    // Notify Approvers & Admins of assessment completion
    try {
      const approvers = await UserRepository.findAll({ role: 'APPROVER' });
      const admins = await UserRepository.findAll({ role: 'ADMIN' });
      const recipients = [...approvers, ...admins];

      for (const recipient of recipients) {
        if (recipient.id !== currentUser.id) {
          await NotificationService.sendNotification({
            userId: recipient.id,
            title: `Engineering Assessment Completed: ${workOrder.tracking_number}`,
            message: `${currentUser.name} completed ${assessment_type} assessment [Code: ${charge_code}]. Estimate: R ${numericEstimate.toLocaleString('en-ZA')}. Routed to ${fundingRoute === 'route_b' ? 'Route B (Advance Funded)' : 'Route A (Client Funded)'}. Ready for QB Review.`,
            type: fundingRoute === 'route_a' ? 'warning' : 'info',
            link: `/work-orders/${id}`
          });
        }
      }
    } catch (notifErr) {
      console.warn('Failed to send assessment notification:', notifErr.message);
    }

    return this.getWorkOrderById(id, currentUser);
  }


  static async createWorkOrder(data, currentUser, files = []) {
    const facility = await FacilityRepository.findById(data.facility_id);
    if (!facility) {
      throw AppError.badRequest(`Facility with ID ${data.facility_id} does not exist`);
    }

    const id = `wo_${crypto.randomBytes(8).toString('hex')}`;
    const trackingNumber = await WorkOrderRepository.generateNextTrackingNumber();

    const urgencyCategory = data.urgency_category || 'Urgent 4–8 days';
    let mappedPriority = data.priority || 'medium';
    let mappedFundingRoute = data.funding_route || 'route_b';

    if (urgencyCategory === 'Critical 0–24h') {
      mappedPriority = 'critical';
      mappedFundingRoute = 'route_b'; // Bypasses statutory notice & standard quote sourcing
    } else if (urgencyCategory === 'Very urgent 2–4 days') {
      mappedPriority = 'high';
      mappedFundingRoute = 'route_b'; // Fast-track bypass
    } else if (urgencyCategory === 'Urgent 4–8 days') {
      mappedPriority = 'medium';
      mappedFundingRoute = 'route_b'; // Fast-track bypass
    } else if (urgencyCategory === '8+ days or statutory') {
      mappedPriority = 'low';
      mappedFundingRoute = 'route_a'; // Statutory scheduled maintenance with 30d/15d notice
    }

    const isEmergencyBypass = urgencyCategory === 'Critical 0–24h';
    const initialStatus = isEmergencyBypass ? WORK_ORDER_STATUS.APPROVED : WORK_ORDER_STATUS.REPORTED;

    const workOrder = await WorkOrderRepository.create({
      id,
      tracking_number: trackingNumber,
      title: data.title,
      description: data.description,
      facility_id: data.facility_id,
      location_details: data.location_details || null,
      category: data.category || 'Biomedical Equipment',
      priority: mappedPriority,
      urgency_category: urgencyCategory,
      funding_route: mappedFundingRoute,
      status: initialStatus,
      reported_by: currentUser.id,
      approved_by: isEmergencyBypass ? currentUser.id : null,
      estimated_cost: data.estimated_cost || 0,
      due_date: data.due_date || null
    });

    // Record Genesis Cryptographic Status Event
    const genesisNote = isEmergencyBypass
      ? `Critical emergency work order (0–24h SLA) automatically fast-tracked under Advance Float agreement for immediate specialist dispatch`
      : `Work order reported at ${facility.name} (${facility.code}) — Awaiting initial triage & approval by Facility Approver`;

    await WorkflowService.recordGenesisEvent(
      id,
      currentUser.id,
      genesisNote,
      initialStatus
    );

    // Save attached initial photos if provided via Multer
    if (files && files.length > 0) {
      for (const file of files) {
        const photoId = `wop_${crypto.randomBytes(6).toString('hex')}`;
        const relativeUrl = `/uploads/work-orders/${file.filename}`;
        await WorkOrderRepository.addPhoto({
          id: photoId,
          work_order_id: id,
          photo_url: relativeUrl,
          caption: 'Initial inspection photo',
          stage: 'initial',
          uploaded_by: currentUser.id
        });
      }
    }

    // Trigger in-app notifications to Approvers and Admins
    try {
      const approvers = await UserRepository.findAll({ role: 'APPROVER' });
      const admins = await UserRepository.findAll({ role: 'ADMIN' });
      const recipients = [...approvers, ...admins];

      for (const recipient of recipients) {
        if (recipient.id !== currentUser.id) {
          await NotificationService.sendNotification({
            userId: recipient.id,
            title: `New Ticket Reported: ${trackingNumber}`,
            message: `${currentUser.name} reported "${data.title}" at ${facility.name} (Priority: ${data.priority.toUpperCase()}). Action Required: Please review and approve or reject this request.`,
            type: data.priority === 'critical' ? 'critical' : 'warning',
            link: `/work-orders/${id}`
          });
        }
      }
    } catch (notifErr) {
      console.warn('Failed to send work order creation notification:', notifErr.message);
    }

    return this.getWorkOrderById(id);
  }

  static async updateWorkOrder(id, updateData, currentUser) {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    const payload = { ...updateData };

    // Route A Quotation Lifecycle Management (PDF Page 4)
    if (currentUser?.role === 'CONTRACTOR' && updateData.estimated_cost !== undefined) {
      payload.quote_status = 'under_review';
    }

    // Strict Sequential 3-Way Sign-off Enforcement: 1. Inspector -> 2. Engineer -> 3. Facilities Manager
    if (payload.signoff_engineer_by && !workOrder.signoff_engineer_by) {
      if (!workOrder.signoff_inspector_by && !payload.signoff_inspector_by && currentUser?.role !== 'ADMIN') {
        const error = new Error('Sequential Sign-off Requirement: Step 1 (Works Inspector Statutory & Quality sign-off) must be completed before Works Engineer sign-off.');
        error.statusCode = 400;
        throw error;
      }
    }
    if (payload.signoff_fm_by && !workOrder.signoff_fm_by) {
      if (!workOrder.signoff_engineer_by && !payload.signoff_engineer_by && currentUser?.role !== 'ADMIN') {
        const error = new Error('Sequential Sign-off Requirement: Step 2 (Works Engineer Technical sign-off) must be completed before Facilities Manager operational handover sign-off.');
        error.statusCode = 400;
        throw error;
      }
    }

    // 3-Way Tri-Signature Completion Logic (PDF Page 5)
    const hasEng = payload.signoff_engineer_by || workOrder.signoff_engineer_by;
    const hasFm = payload.signoff_fm_by || workOrder.signoff_fm_by;
    const hasInsp = payload.signoff_inspector_by || workOrder.signoff_inspector_by;

    if (hasEng && hasFm && hasInsp) {
      if (!workOrder.completion_cert_no && !payload.completion_cert_no) {
        const year = new Date().getFullYear();
        const numCode = workOrder.tracking_number ? workOrder.tracking_number.replace(/\D/g, '').slice(-4) : '1001';
        payload.completion_cert_no = `CERT-${year}-${numCode || '1001'}`;
      }
      if (workOrder.status === 'completed' && !payload.status) {
        payload.status = 'verified';
        payload.verified_at = new Date().toISOString();
      }
    }

    if (payload.client_recovery_status === 'submitted' && !workOrder.client_recovery_invoice_no && !payload.client_recovery_invoice_no) {
      const year = new Date().getFullYear();
      const numCode = workOrder.tracking_number ? workOrder.tracking_number.replace(/\D/g, '').slice(-4) : '1001';
      payload.client_recovery_invoice_no = `REC-${year}-${numCode || '1001'}`;
    }

    const updated = await WorkOrderRepository.update(id, payload);

    // If quote_status was updated, log audit trail event
    if (payload.quote_status && payload.quote_status !== workOrder.quote_status) {
      try {
        const statusKey =
          payload.quote_status === 'under_review'
            ? 'quote_submitted'
            : payload.quote_status === 'awaiting_client'
            ? 'quote_client_gateway'
            : payload.quote_status === 'client_approved'
            ? 'client_approved'
            : 'client_declined';

        const statusLabel =
          payload.quote_status === 'under_review'
            ? `Contractor Quote Submitted: R ${Number(payload.estimated_cost || workOrder.estimated_cost || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} — Under Review by Quantum Built`
            : payload.quote_status === 'awaiting_client'
            ? 'Quote Approved by Quantum Built — Submitted to NC DOH (Client Gateway)'
            : payload.quote_status === 'client_approved'
            ? 'Client Approved: Quote Approved by NC DOH — Ready for Work Order Issue'
            : 'Quote Declined by Client — Returned to Quantum Built for Renegotiation';

        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: statusKey,
          actorId: currentUser ? currentUser.id : 'system',
          notes: `${statusLabel}${payload.client_decline_reason ? ` (Reason: ${payload.client_decline_reason})` : ''}`
        });
      } catch (evtErr) {
        console.warn('Failed to record quote lifecycle audit event:', evtErr.message);
      }
    }

    // 3-Way Sign-off event recording
    try {
      if (payload.signoff_engineer_by && !workOrder.signoff_engineer_by) {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'signoff_engineer',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `3-Way Sign-off: Works Engineer Technical & Structural Sign-off verified by ${payload.signoff_engineer_by}.`
        });
      }
      if (payload.signoff_fm_by && !workOrder.signoff_fm_by) {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'signoff_fm',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `3-Way Sign-off: Hospital Facilities Manager on-site operational handover sign-off verified by ${payload.signoff_fm_by}.`
        });
      }
      if (payload.signoff_inspector_by && !workOrder.signoff_inspector_by) {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'signoff_inspector',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `3-Way Sign-off: Works Inspector statutory compliance & safety inspection passed by ${payload.signoff_inspector_by}.`
        });
      }
      if (payload.signoff_rejection_reason && !workOrder.signoff_rejection_reason) {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'signoff_rejected',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `3-Way Sign-off Rejected: Returned to In Progress for Rework (Reason: ${payload.signoff_rejection_reason}).`
        });
      }
      if (payload.completion_cert_no && !workOrder.completion_cert_no) {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'cert_issued',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `Official Statutory Certificate of Completion [${payload.completion_cert_no}] issued and sealed for contractor billing & client recovery.`
        });
      }
      if (payload.client_recovery_status === 'submitted' && workOrder.client_recovery_status !== 'submitted') {
        await StatusEventRepository.recordEvent({
          workOrderId: id,
          status: 'client_recovery_submitted',
          actorId: currentUser ? currentUser.id : 'system',
          notes: `NC DOH Client Recovery Invoice Generated (${payload.client_recovery_invoice_no || 'REC-INVOICE'}) with attached Completion Certificate.`
        });
      }
    } catch (evtErr) {
      console.warn('Failed to record signoff audit event:', evtErr.message);
    }

    return updated;
  }

  static async uploadPhotos(id, currentUser, files, stage = 'in_progress', caption = '') {
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }

    if (!files || files.length === 0) {
      throw AppError.badRequest('No image files uploaded');
    }

    const savedPhotos = [];
    for (const file of files) {
      const photoId = `wop_${crypto.randomBytes(6).toString('hex')}`;
      const relativeUrl = `/uploads/work-orders/${file.filename}`;
      const photo = await WorkOrderRepository.addPhoto({
        id: photoId,
        work_order_id: id,
        photo_url: relativeUrl,
        caption: caption || 'Work order progress photo',
        stage,
        uploaded_by: currentUser.id
      });
      savedPhotos.push(photo);
    }

    return savedPhotos;
  }

  static async deleteWorkOrder(id, currentUser) {
    if (currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Administrators can delete work orders');
    }
    const workOrder = await WorkOrderRepository.findById(id);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${id} not found`);
    }
    await WorkOrderRepository.deleteById(id);
    return { success: true, message: `Work order ${workOrder.tracking_number} deleted successfully` };
  }

  static async clearAllWorkOrders(currentUser) {
    if (currentUser.role !== 'ADMIN') {
      throw AppError.forbidden('Only Administrators can clear all test work orders');
    }
    await WorkOrderRepository.clearAll();
    return { success: true, message: 'All test work orders, invoices, inspections, and audit events cleared successfully' };
  }
}
