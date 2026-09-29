import crypto from 'crypto';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { ContractorRepository } from '../repositories/contractor.repository.js';
import { StatusEventRepository, GENESIS_HASH } from '../repositories/statusEvent.repository.js';
import { computeEventHash, verifyEventChainIntegrity } from '../utils/crypto.js';
import { NotificationService } from './notification.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { InspectionRepository } from '../repositories/inspection.repository.js';
import { AppError } from '../utils/AppError.js';
import { ROLES, WORK_ORDER_STATUS, INSPECTION_STATUS } from '../config/constants.js';

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

    // Approver sub-scope validation
    if (actor.role === ROLES.APPROVER) {
      const scope = actor.approver_scope || 'general';
      if (targetStatus === WORK_ORDER_STATUS.APPROVED && !['wo_approver', 'general'].includes(scope)) {
        throw AppError.forbidden(
          `Forbidden: Approver with scope '${scope}' cannot approve work order budgets. Requires 'wo_approver' or 'general' scope.`
        );
      }
      if (targetStatus === WORK_ORDER_STATUS.ASSIGNED && !['contractor_approver', 'procurement', 'general'].includes(scope)) {
        throw AppError.forbidden(
          `Forbidden: Approver with scope '${scope}' cannot assign contractors. Requires 'contractor_approver' or 'general' scope.`
        );
      }
      if (targetStatus === WORK_ORDER_STATUS.CLOSED && !['payment_approver', 'general'].includes(scope)) {
        throw AppError.forbidden(
          `Forbidden: Approver with scope '${scope}' cannot close/settle work orders. Requires 'payment_approver' or 'general' scope.`
        );
      }
    }

    // 3. Specific validation rules & Segregation of Duties for transitions
    if (targetStatus === WORK_ORDER_STATUS.ASSIGNED) {
      if (!assignedTo && !contractorId && !workOrder.assigned_to) {
        throw AppError.badRequest('Assigned contractor or technician is required when moving to ASSIGNED status');
      }

      // Segregation of Duties: User who approved the Work Order budget cannot assign the contractor
      if (workOrder.approved_by && workOrder.approved_by === actor.id && actor.role !== ROLES.ADMIN) {
        throw AppError.forbidden(
          'Segregation of Duties Violation: You approved this Work Order budget. Contractor assignment must be performed by Procurement or an independent approver.'
        );
      }

      // Check contractor active approval status (Line Manager approved)
      const selectedContractorId = assignedTo || contractorId || workOrder.assigned_to;
      if (selectedContractorId) {
        const contractor = await ContractorRepository.findById(selectedContractorId);
        if (contractor && contractor.approval_status && contractor.approval_status !== 'active') {
          throw AppError.badRequest(
            `Cannot assign contractor '${contractor.name}'. Contractor is in '${contractor.approval_status}' status and must be approved by a Line Manager first.`
          );
        }
      }
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

    // 7. Update work order with audit tracking
    const updatePayload = { status: targetStatus };
    if (targetStatus === WORK_ORDER_STATUS.APPROVED) {
      updatePayload.approved_by = actor.id;
      if (actualCost !== undefined) {
        updatePayload.estimated_cost = actualCost;
      }
    }
    if (targetStatus === WORK_ORDER_STATUS.ASSIGNED) {
      updatePayload.assigned_by = actor.id;
      if (assignedTo) {
        updatePayload.assigned_to = assignedTo;
        updatePayload.contractor_id = contractorId || assignedTo;
      } else if (contractorId) {
        updatePayload.contractor_id = contractorId;
        updatePayload.assigned_to = contractorId;
      }
    }
    if (targetStatus !== WORK_ORDER_STATUS.APPROVED && actualCost !== undefined) {
      updatePayload.actual_cost = actualCost;
    }

    if (targetStatus === WORK_ORDER_STATUS.COMPLETED) {
      updatePayload.completed_at = timestamp;
      // Guarantee actual_cost is strictly the budget approved by the Approver
      updatePayload.actual_cost = workOrder.estimated_cost ?? workOrder.actual_cost ?? actualCost ?? 0;
    } else if (targetStatus === WORK_ORDER_STATUS.VERIFIED) {
      updatePayload.verified_at = timestamp;
    } else if (targetStatus === WORK_ORDER_STATUS.CLOSED || targetStatus === WORK_ORDER_STATUS.CANCELLED) {
      updatePayload.closed_at = timestamp;
    }

    const updatedWorkOrder = await WorkOrderRepository.update(workOrderId, updatePayload);

    // If verified or failed QC by Inspector / Admin, ensure an inspection entry is logged for audit & UI tables
    if (targetStatus === WORK_ORDER_STATUS.VERIFIED && (actor.role === ROLES.INSPECTOR || actor.role === ROLES.ADMIN)) {
      try {
        const existingInspections = await InspectionRepository.findByWorkOrderId(workOrderId);
        const hasRecentPass = existingInspections.some(
          (insp) => insp.result === INSPECTION_STATUS.PASS && (Date.now() - new Date(insp.inspected_at).getTime()) < 15000
        );
        if (!hasRecentPass) {
          const inspId = `insp_${crypto.randomBytes(6).toString('hex')}`;
          await InspectionRepository.create({
            id: inspId,
            work_order_id: workOrderId,
            inspector_id: actor.id,
            result: INSPECTION_STATUS.PASS,
            checklist_results: JSON.stringify({
              calibration: true,
              electricalSafety: true,
              sterilization: true,
              functionalTesting: true
            }),
            observations: notes || `Safety & Quality Verification passed by ${actor.name || 'Safety Inspector'}. Work verified compliant.`,
            recommendations: 'Authorized for contractor invoice billing and clinical deployment.'
          });
        }
      } catch (inspErr) {
        console.warn('Auto inspection log creation skipped:', inspErr.message);
      }
    } else if (currentStatus === WORK_ORDER_STATUS.COMPLETED && targetStatus === WORK_ORDER_STATUS.IN_PROGRESS && (actor.role === ROLES.INSPECTOR || actor.role === ROLES.ADMIN)) {
      try {
        const existingInspections = await InspectionRepository.findByWorkOrderId(workOrderId);
        const hasRecentFail = existingInspections.some(
          (insp) => insp.result === INSPECTION_STATUS.FAIL && (Date.now() - new Date(insp.inspected_at).getTime()) < 15000
        );
        if (!hasRecentFail) {
          const inspId = `insp_${crypto.randomBytes(6).toString('hex')}`;
          await InspectionRepository.create({
            id: inspId,
            work_order_id: workOrderId,
            inspector_id: actor.id,
            result: INSPECTION_STATUS.FAIL,
            checklist_results: null,
            observations: notes || `Quality Inspection FAILED - Returned for corrective maintenance by ${actor.name || 'Safety Inspector'}.`,
            recommendations: 'Contractor must perform recalibration and fix safety issues.'
          });
        }
      } catch (inspErr) {
        console.warn('Auto inspection fail log creation skipped:', inspErr.message);
      }
    }

    // Trigger role-based in-app notifications
    try {
      // Helper to fetch all contractor recipient user IDs
      const contractorUsers = await UserRepository.findAll({ role: 'CONTRACTOR' });
      const contractorUserIds = new Set(contractorUsers.map((u) => u.id));
      if (workOrder.assigned_to) {
        const directUser = await UserRepository.findById(workOrder.assigned_to);
        if (directUser) contractorUserIds.add(directUser.id);
      }
      if (assignedTo) {
        const directAssigned = await UserRepository.findById(assignedTo);
        if (directAssigned) contractorUserIds.add(directAssigned.id);
      }

      // 1. If assigned to contractor/technician
      if (assignedTo || targetStatus === WORK_ORDER_STATUS.ASSIGNED) {
        for (const cUserId of contractorUserIds) {
          if (cUserId !== actor.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: `Work Order Assigned: ${workOrder.tracking_number}`,
              message: `You have been assigned to "${workOrder.title}". Action Required: Initiate field repairs.`,
              type: 'work_order',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 2. When Approved
      if (targetStatus === WORK_ORDER_STATUS.APPROVED) {
        const approvers = await UserRepository.findAll({ role: 'APPROVER' });
        for (const approver of approvers) {
          if (approver.id !== actor.id) {
            await NotificationService.sendNotification({
              userId: approver.id,
              title: `Work Order Approved: ${workOrder.tracking_number}`,
              message: `"${workOrder.title}" was approved by ${actor.name || actor.role}. Ready for contractor assignment.`,
              type: 'info',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 3. When Contractor MARKS COMPLETED: Alert Inspectors, Approvers, and Admins
      if (targetStatus === WORK_ORDER_STATUS.COMPLETED) {
        const inspectors = await UserRepository.findAll({ role: 'INSPECTOR' });
        const approvers = await UserRepository.findAll({ role: 'APPROVER' });
        const admins = await UserRepository.findAll({ role: 'ADMIN' });
        const qcRecipients = [...inspectors, ...approvers, ...admins];

        for (const recipient of qcRecipients) {
          if (recipient.id !== actor.id) {
            await NotificationService.sendNotification({
              userId: recipient.id,
              title: `QC Inspection Required: ${workOrder.tracking_number}`,
              message: `${actor.name || 'Contractor'} has completed repair work on "${workOrder.title}". Action Required: Perform safety verification.`,
              type: 'warning',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 4. When Inspector VERIFIES: Alert Contractor and Approver
      if (targetStatus === WORK_ORDER_STATUS.VERIFIED) {
        for (const cUserId of contractorUserIds) {
          if (cUserId !== actor.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: `QC Verified: ${workOrder.tracking_number}`,
              message: `QC Inspector ${actor.name || 'Inspector'} verified "${workOrder.title}". You can now generate your invoice claim.`,
              type: 'success',
              link: `/work-orders/${workOrderId}`
            });
          }
        }

        const approvers = await UserRepository.findAll({ role: 'APPROVER' });
        for (const approver of approvers) {
          if (approver.id !== actor.id) {
            await NotificationService.sendNotification({
              userId: approver.id,
              title: `Work Order Verified: ${workOrder.tracking_number}`,
              message: `"${workOrder.title}" passed safety inspection and is ready for billing & closing.`,
              type: 'success',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 5. When Inspector FAILS QC (Returned to In Progress from Completed): Alert Contractor
      if (currentStatus === WORK_ORDER_STATUS.COMPLETED && targetStatus === WORK_ORDER_STATUS.IN_PROGRESS) {
        for (const cUserId of contractorUserIds) {
          if (cUserId !== actor.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: `QC Inspection Failed / Returned: ${workOrder.tracking_number}`,
              message: `QC Inspector ${actor.name || 'Inspector'} returned work order for corrective repairs. Remarks: ${notes || 'Correction needed.'}`,
              type: 'critical',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 6. When Work Order is CANCELLED / REJECTED: Alert Contractor & Staff
      if (targetStatus === WORK_ORDER_STATUS.CANCELLED) {
        for (const cUserId of contractorUserIds) {
          if (cUserId !== actor.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: `Work Order Cancelled / Rejected: ${workOrder.tracking_number}`,
              message: `Work order "${workOrder.title}" was rejected by ${actor.name || actor.role}. Reason: ${notes || 'Cancelled by leadership.'}`,
              type: 'critical',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 7. When Work Order is CLOSED: Alert Contractor
      if (targetStatus === WORK_ORDER_STATUS.CLOSED) {
        for (const cUserId of contractorUserIds) {
          if (cUserId !== actor.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: `Work Order Closed: ${workOrder.tracking_number}`,
              message: `Work order "${workOrder.title}" is officially verified, paid, and closed.`,
              type: 'success',
              link: `/work-orders/${workOrderId}`
            });
          }
        }
      }

      // 8. Notify Staff reporter ONLY for key resolution milestones (Approved, Closed, Cancelled)
      if (workOrder.reported_by && workOrder.reported_by !== actor.id) {
        let staffNotif = null;
        if (targetStatus === WORK_ORDER_STATUS.APPROVED) {
          staffNotif = {
            title: `Ticket Approved: ${workOrder.tracking_number}`,
            message: `Your reported issue "${workOrder.title}" was approved by leadership and scheduled for repair.`,
            type: 'info'
          };
        } else if (targetStatus === WORK_ORDER_STATUS.CLOSED) {
          staffNotif = {
            title: `Issue Resolved & Closed: ${workOrder.tracking_number}`,
            message: `Maintenance repairs on "${workOrder.title}" have been verified and ticket is officially resolved.`,
            type: 'success'
          };
        } else if (targetStatus === WORK_ORDER_STATUS.CANCELLED) {
          staffNotif = {
            title: `Ticket Cancelled / Rejected: ${workOrder.tracking_number}`,
            message: `Your reported ticket "${workOrder.title}" was cancelled by ${actor.name || actor.role}.${notes ? ` Reason: ${notes}` : ''}`,
            type: 'critical'
          };
        }

        if (staffNotif) {
          await NotificationService.sendNotification({
            userId: workOrder.reported_by,
            title: staffNotif.title,
            message: staffNotif.message,
            type: staffNotif.type,
            link: `/work-orders/${workOrderId}`
          });
        }
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
