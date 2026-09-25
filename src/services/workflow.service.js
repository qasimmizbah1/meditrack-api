import crypto from 'crypto';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { StatusEventRepository, GENESIS_HASH } from '../repositories/statusEvent.repository.js';
import { computeEventHash, verifyEventChainIntegrity } from '../utils/crypto.js';
import { NotificationService } from './notification.service.js';
import { AppError } from '../utils/AppError.js';
import { ROLES, WORK_ORDER_STATUS } from '../config/constants.js';

const ALLOWED_TRANSITIONS = {
  [WORK_ORDER_STATUS.REPORTED]: {
    allowedNext: [WORK_ORDER_STATUS.APPROVED, WORK_ORDER_STATUS.CANCELLED, WORK_ORDER_STATUS.CLOSED],
    allowedRoles: [ROLES.APPROVER, ROLES.ADMIN]
  },
  [WORK_ORDER_STATUS.APPROVED]: {
    allowedNext: [WORK_ORDER_STATUS.ASSIGNED, WORK_ORDER_STATUS.CANCELLED],
    allowedRoles: [ROLES.APPROVER, ROLES.ADMIN]
  },
  [WORK_ORDER_STATUS.ASSIGNED]: {
    allowedNext: [WORK_ORDER_STATUS.IN_PROGRESS, WORK_ORDER_STATUS.CANCELLED],
    allowedRoles: [ROLES.CONTRACTOR, ROLES.ADMIN, ROLES.APPROVER]
  },
  [WORK_ORDER_STATUS.IN_PROGRESS]: {
    allowedNext: [WORK_ORDER_STATUS.COMPLETED],
    allowedRoles: [ROLES.CONTRACTOR, ROLES.ADMIN]
  },
  [WORK_ORDER_STATUS.COMPLETED]: {
    allowedNext: [WORK_ORDER_STATUS.VERIFIED, WORK_ORDER_STATUS.IN_PROGRESS],
    allowedRoles: [ROLES.INSPECTOR, ROLES.ADMIN]
  },
  [WORK_ORDER_STATUS.VERIFIED]: {
    allowedNext: [WORK_ORDER_STATUS.CLOSED],
    allowedRoles: [ROLES.APPROVER, ROLES.ADMIN]
  },
  [WORK_ORDER_STATUS.CLOSED]: {
    allowedNext: [],
    allowedRoles: []
  },
  [WORK_ORDER_STATUS.CANCELLED]: {
    allowedNext: [],
    allowedRoles: []
  }
};

export class WorkflowService {
  /**
   * Transitions a work order to a new status and creates a cryptographic status event
   */
  static async transitionStatus({ workOrderId, targetStatus, actor, notes, assignedTo, contractorId, actualCost }) {
    const workOrder = await WorkOrderRepository.findById(workOrderId);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${workOrderId} not found`);
    }

    const currentStatus = workOrder.status;

    // 1. Validate if transition is permitted from current status
    const transitionRule = ALLOWED_TRANSITIONS[currentStatus];
    if (!transitionRule || !transitionRule.allowedNext.includes(targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${currentStatus}' to '${targetStatus}'. Allowed next states: [${transitionRule?.allowedNext.join(', ') || 'none'}]`
      );
    }

    // 2. Validate actor's role permission
    if (!transitionRule.allowedRoles.includes(actor.role)) {
      throw AppError.forbidden(
        `User role '${actor.role}' is not authorized to transition status from '${currentStatus}' to '${targetStatus}'. Required roles: [${transitionRule.allowedRoles.join(', ')}]`
      );
    }

    // 3. Specific validation rules for transitions
    if (targetStatus === WORK_ORDER_STATUS.ASSIGNED && !assignedTo && !contractorId && !workOrder.assigned_to) {
      throw AppError.badRequest('Assigned contractor or technician is required when moving to ASSIGNED status');
    }

    // 4. Fetch the latest status event to get previous_hash
    const latestEvent = await StatusEventRepository.getLatestEventByWorkOrderId(workOrderId);
    const previousHash = latestEvent ? latestEvent.current_hash : GENESIS_HASH;

    // 5. Generate deterministic event timestamp & SHA-256 hash
    const timestamp = new Date().toISOString();
    const currentHash = computeEventHash({
      previousHash,
      status: targetStatus,
      actorId: actor.id,
      timestamp
    });

    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;

    // 6. Record immutable status event
    const statusEvent = await StatusEventRepository.create({
      id: eventId,
      work_order_id: workOrderId,
      status: targetStatus,
      actor_id: actor.id,
      previous_hash: previousHash,
      current_hash: currentHash,
      notes: notes || null,
      created_at: timestamp
    });

    // 7. Update work order
    const updatePayload = { status: targetStatus };
    if (assignedTo) updatePayload.assigned_to = assignedTo;
    if (contractorId) updatePayload.contractor_id = contractorId;
    if (actualCost !== undefined) updatePayload.actual_cost = actualCost;

    if (targetStatus === WORK_ORDER_STATUS.COMPLETED) {
      updatePayload.completed_at = timestamp;
    } else if (targetStatus === WORK_ORDER_STATUS.VERIFIED) {
      updatePayload.verified_at = timestamp;
    } else if (targetStatus === WORK_ORDER_STATUS.CLOSED || targetStatus === WORK_ORDER_STATUS.CANCELLED) {
      updatePayload.closed_at = timestamp;
    }

    const updatedWorkOrder = await WorkOrderRepository.update(workOrderId, updatePayload);

    // Trigger in-app notifications
    try {
      if (assignedTo) {
        await NotificationService.sendNotification({
          userId: assignedTo,
          title: `Work Order Assigned (${workOrder.tracking_number})`,
          message: `You have been assigned to ${workOrder.title}`,
          type: 'work_order',
          link: `/work-orders/${workOrderId}`
        });
      }
      if (workOrder.reported_by && workOrder.reported_by !== actor.id) {
        await NotificationService.sendNotification({
          userId: workOrder.reported_by,
          title: `Status Updated: ${workOrder.tracking_number}`,
          message: `Order transitioned from ${currentStatus} to ${targetStatus} by ${actor.name || actor.role}`,
          type: targetStatus === WORK_ORDER_STATUS.VERIFIED ? 'success' : 'info',
          link: `/work-orders/${workOrderId}`
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send notification:', notifErr.message);
    }

    return {
      workOrder: updatedWorkOrder,
      event: statusEvent
    };
  }

  /**
   * Initializes the genesis status event when a work order is reported
   */
  static async recordGenesisEvent(workOrderId, reporterId, notes = 'Work order reported') {
    const timestamp = new Date().toISOString();
    const currentHash = computeEventHash({
      previousHash: GENESIS_HASH,
      status: WORK_ORDER_STATUS.REPORTED,
      actorId: reporterId,
      timestamp
    });

    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;

    return StatusEventRepository.create({
      id: eventId,
      work_order_id: workOrderId,
      status: WORK_ORDER_STATUS.REPORTED,
      actor_id: reporterId,
      previous_hash: GENESIS_HASH,
      current_hash: currentHash,
      notes,
      created_at: timestamp
    });
  }

  /**
   * Retrieves the full cryptographic audit history and verifies chain integrity
   */
  static async getAuditChain(workOrderId) {
    const workOrder = await WorkOrderRepository.findById(workOrderId);
    if (!workOrder) {
      throw AppError.notFound(`Work order with ID ${workOrderId} not found`);
    }

    const events = await StatusEventRepository.getEventsByWorkOrderId(workOrderId);
    const verification = verifyEventChainIntegrity(events);

    return {
      work_order_id: workOrderId,
      tracking_number: workOrder.tracking_number,
      current_status: workOrder.status,
      chain_length: events.length,
      integrity: {
        is_tamper_free: verification.isValid,
        verified_events_count: verification.verifiedCount,
        error: verification.error || null,
        verified_at: new Date().toISOString()
      },
      events
    };
  }
}
