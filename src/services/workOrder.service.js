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

    const { assessment_type, assessor_estimate, charge_code, assessment_notes } = assessmentData;
    const numericEstimate = Number(assessor_estimate) || 0;

    // Automated Funding Threshold Dispatcher:
    // Route B (Advance Funded Float): <= R50,000 OR Critical 0–24h
    // Route A (Client Funded / Formal Quote Approval): > R50,000
    let fundingRoute = 'route_b';
    if (workOrder.urgency_category === 'Critical 0–24h') {
      fundingRoute = 'route_b';
    } else if (numericEstimate > 50000) {
      fundingRoute = 'route_a';
    } else {
      fundingRoute = 'route_b';
    }

    await WorkOrderRepository.update(id, {
      assessment_type,
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
      const routeLabel = fundingRoute === 'route_b' ? 'Route B (Advance Funded <= R50,000)' : 'Route A (Client Funded > R50,000)';

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

    const isFastTrack = urgencyCategory !== '8+ days or statutory';
    const initialStatus = isFastTrack ? WORK_ORDER_STATUS.APPROVED : WORK_ORDER_STATUS.REPORTED;

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
      approved_by: isFastTrack ? currentUser.id : null,
      estimated_cost: data.estimated_cost || 0,
      due_date: data.due_date || null
    });

    // Record Genesis Cryptographic Status Event
    const genesisNote = urgencyCategory === '8+ days or statutory'
      ? `8+ days or statutory work order created at ${facility.name} (${facility.code}) — 30d & 15d pre-notices queued for NC DOH & QB`
      : `Fast-track work order (${urgencyCategory}) automatically approved under QB Route B facility agreement — Immediate specialist dispatch`;

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

    return WorkOrderRepository.update(id, updateData);
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
}
