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
      refer_to_engineer
    } = assessmentData;

    // Handle Referral to Works Engineer by Inspector
    if (refer_to_engineer) {
      await WorkOrderRepository.update(id, {
        assessment_type,
        assessor_role: 'works_engineer',
        assessor_id: currentUser.id,
        assessor_estimate: null,
        charge_code,
        assessment_notes: assessment_notes || `Referred to Works Engineer by ${currentUser.name} for technical scope & cost estimation.`,
        assessment_date: new Date().toISOString()
      });

      // Dispatch real-time alert/notification to Works Engineers
      try {
        const engineers = await UserRepository.findAll({ role: 'INSPECTOR' });
        const targetEngineers = engineers.filter(
          (u) => u.inspector_scope === 'works_engineer' || u.email === 'engineer@meditrack.com' || u.role === 'ADMIN'
        );

        for (const eng of targetEngineers) {
          await NotificationService.sendNotification({
            userId: eng.id,
            title: `Technical Scope Estimation Requested: ${workOrder.tracking_number}`,
            message: `${currentUser.name} (Site Inspector) referred ${workOrder.tracking_number} (${workOrder.title}) for detailed technical scoping and cost estimation.`,
            type: 'warning',
            link: `/work-orders/${id}`
          });
        }
      } catch (notifyErr) {
        console.warn('Failed to notify engineer:', notifyErr.message);
      }

      // Record Audit Event
      try {
        const lastEvent = await StatusEventRepository.getLastEvent(id);
        const previousHash = lastEvent ? lastEvent.current_hash : GENESIS_HASH;
        const timestamp = new Date().toISOString();
        const currentHash = computeEventHash({
          previousHash,
          status: workOrder.status,
          actorId: currentUser.id,
          timestamp
        });

        const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
        await StatusEventRepository.create({
          id: eventId,
          work_order_id: id,
          status: workOrder.status,
          actor_id: currentUser.id,
          previous_hash: previousHash,
          current_hash: currentHash,
          notes: `Technical Scoping Referred to Works Engineer by ${currentUser.name} (Site Inspector). Mode=${assessment_type.toUpperCase()}, ChargeCode=${charge_code}.${assessment_notes ? ` Notes: ${assessment_notes}` : ''}`,
          created_at: timestamp
        });
      } catch (auditErr) {
        console.warn('Failed to record referral audit event:', auditErr.message);
      }

      return await WorkOrderRepository.findById(id);
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

    await WorkOrderRepository.update(id, {
      assessment_type,
      assessor_role: assessor_role || 'works_engineer',
      assessor_id: currentUser.id,
      assessor_estimate: numericEstimate,
      estimated_cost: numericEstimate,
      charge_code,
      assessment_notes: assessment_notes || null,
      assessment_date: new Date().toISOString(),
      funding_route: fundingRoute
    });

    // Record Immutable Status/Audit Event for Ledger
    try {
      const lastEvent = await StatusEventRepository.getLastEvent(id);
      const previousHash = lastEvent ? lastEvent.current_hash : GENESIS_HASH;
      const timestamp = new Date().toISOString();
      const currentHash = computeEventHash({
        previousHash,
        status: workOrder.status,
        actorId: currentUser.id,
        timestamp
      });

      const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
      const routeLabel = isQbOverride
        ? 'Route B (QB Special Override > R50,000 with recorded reasoning)'
        : fundingRoute === 'route_b'
        ? 'Route B (Advance Funded <= R50,000)'
        : 'Route A (Client Funded > R50,000)';

      await StatusEventRepository.create({
        id: eventId,
        work_order_id: id,
        status: workOrder.status,
        actor_id: currentUser.id,
        previous_hash: previousHash,
        current_hash: currentHash,
        notes: `Engineering Assessment completed: Mode=${assessment_type.toUpperCase()}, ChargeCode=${charge_code}, Estimate=R ${numericEstimate.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}. Automated Routing: ${routeLabel}.${assessment_notes ? ` Notes: ${assessment_notes}` : ''}`,
        created_at: timestamp
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
            message: `${currentUser.name} completed ${assessment_type} assessment [Code: ${charge_code}]. Estimate: R ${numericEstimate.toLocaleString('en-ZA')}. Routed to ${fundingRoute === 'route_b' ? 'Route B (Advance Funded)' : 'Route A (Client Funded)'}.`,
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

    // 3-Way Tri-Signature Completion Logic (PDF Page 5)
    const hasEng = payload.signoff_engineer_by || workOrder.signoff_engineer_by;
    const hasFm = payload.signoff_fm_by || workOrder.signoff_fm_by;
    const hasInsp = payload.signoff_inspector_by || workOrder.signoff_inspector_by;

    if (hasEng && hasFm && hasInsp && !workOrder.completion_cert_no && !payload.completion_cert_no) {
      const year = new Date().getFullYear();
      const numCode = workOrder.tracking_number ? workOrder.tracking_number.replace(/\D/g, '').slice(-4) : '1001';
      payload.completion_cert_no = `CERT-${year}-${numCode || '1001'}`;
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
        const lastEvent = await StatusEventRepository.getLastEvent(id);
        const previousHash = lastEvent ? lastEvent.current_hash : GENESIS_HASH;
        const timestamp = new Date().toISOString();
        const currentHash = computeEventHash({
          previousHash,
          status: workOrder.status,
          actorId: currentUser ? currentUser.id : 'system',
          timestamp
        });

        const statusLabel =
          payload.quote_status === 'under_review'
            ? 'Contractor Quote Submitted — Under Review by Quantum Built'
            : payload.quote_status === 'awaiting_client'
            ? 'Quote Approved by Quantum Built — Submitted to NC DOH (Client Gateway)'
            : payload.quote_status === 'client_approved'
            ? 'Client Approved: Quote Approved by NC DOH — Ready for Work Order Issue'
            : 'Quote Declined by Client — Returned to Quantum Built for Renegotiation';

        await StatusEventRepository.create({
          id: `evt_${crypto.randomBytes(8).toString('hex')}`,
          work_order_id: id,
          status: workOrder.status,
          actor_id: currentUser ? currentUser.id : 'system',
          previous_hash: previousHash,
          current_hash: currentHash,
          notes: `${statusLabel}${payload.client_decline_reason ? ` (Reason: ${payload.client_decline_reason})` : ''}`,
          created_at: timestamp
        });
      } catch (evtErr) {
        console.warn('Failed to record quote lifecycle audit event:', evtErr.message);
      }
    }

    // If 3-way sign-off was recorded, log audit trail event
    const signoffEvent =
      payload.signoff_engineer_by && !workOrder.signoff_engineer_by
        ? `3-Way Sign-off: Works Engineer Technical Sign-off by ${payload.signoff_engineer_by}`
        : payload.signoff_fm_by && !workOrder.signoff_fm_by
        ? `3-Way Sign-off: Facilities Manager Hospital Site Sign-off by ${payload.signoff_fm_by}`
        : payload.signoff_inspector_by && !workOrder.signoff_inspector_by
        ? `3-Way Sign-off: Works Inspector Compliance Sign-off by ${payload.signoff_inspector_by}`
        : payload.signoff_rejection_reason && !workOrder.signoff_rejection_reason
        ? `3-Way Sign-off Rejected: Returned to In Progress for Rework (Reason: ${payload.signoff_rejection_reason})`
        : payload.client_recovery_status === 'submitted' && workOrder.client_recovery_status !== 'submitted'
        ? `NC DOH Client Recovery Invoice Generated (${payload.client_recovery_invoice_no || 'REC-INVOICE'}) with attached Completion Certificate`
        : null;

    if (signoffEvent) {
      try {
        const lastEvent = await StatusEventRepository.getLastEvent(id);
        const previousHash = lastEvent ? lastEvent.current_hash : GENESIS_HASH;
        const timestamp = new Date().toISOString();
        const currentHash = computeEventHash({
          previousHash,
          status: workOrder.status,
          actorId: currentUser ? currentUser.id : 'system',
          timestamp
        });

        await StatusEventRepository.create({
          id: `evt_${crypto.randomBytes(8).toString('hex')}`,
          work_order_id: id,
          status: workOrder.status,
          actor_id: currentUser ? currentUser.id : 'system',
          previous_hash: previousHash,
          current_hash: currentHash,
          notes: signoffEvent,
          created_at: timestamp
        });
      } catch (evtErr) {
        console.warn('Failed to record signoff audit event:', evtErr.message);
      }
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
