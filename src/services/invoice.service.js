import crypto from 'crypto';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { ContractorRepository } from '../repositories/contractor.repository.js';
import { WorkflowService } from './workflow.service.js';
import { AppError } from '../utils/AppError.js';
import { WORK_ORDER_STATUS, INVOICE_STATUS } from '../config/constants.js';

import { UserRepository } from '../repositories/user.repository.js';
import { NotificationService } from './notification.service.js';

export class InvoiceService {
  static async listInvoices(query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const [invoices, total, summary] = await Promise.all([
      InvoiceRepository.findAll({ ...query, limit, offset }),
      InvoiceRepository.countAll(query),
      InvoiceRepository.getFinancialSummary()
    ]);

    return {
      invoices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        totalBilled: Number(summary?.total_billed || 0),
        totalPaid: Number(summary?.total_paid || 0),
        totalPending: Number(summary?.total_pending || 0),
        totalApproved: Number(summary?.total_approved || 0)
      }
    };
  }

  static async getInvoiceById(id) {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }
    return invoice;
  }

  static async createInvoice(data, actorUser) {
    // 1. Verify Work Order
    const workOrder = await WorkOrderRepository.findById(data.work_order_id);
    if (!workOrder) {
      throw new AppError('Associated Work Order not found', 404);
    }

    // Business Rule: Invoicing only allowed on verified or closed work orders
    const validStatuses = [WORK_ORDER_STATUS.VERIFIED, WORK_ORDER_STATUS.CLOSED];
    if (!validStatuses.includes(workOrder.status)) {
      throw new AppError(
        `Cannot invoice work order in '${workOrder.status}' status. Work order must be verified by QC inspector first.`,
        400
      );
    }

    // 2. Check for duplicate invoice
    const existing = await InvoiceRepository.findByWorkOrderId(data.work_order_id);
    if (existing) {
      throw new AppError(`An invoice (${existing.invoice_number}) already exists for this Work Order`, 409);
    }

    // 3. Verify Contractor (flexible resolution for company ID or user)
    let contractorId = data.contractor_id || workOrder.contractor_id || workOrder.assigned_to;
    let contractor = null;
    if (contractorId) {
      contractor = await ContractorRepository.findById(contractorId);
    }
    if (!contractor) {
      const allContractors = await ContractorRepository.findAll({});
      contractor = allContractors.find((c) => c.email === actorUser?.email) || allContractors[0];
      contractorId = contractor?.id || 'usr_contractor_01';
    }

    const id = crypto.randomUUID();
    const invoice_number = await InvoiceRepository.generateNextInvoiceNumber();
    const baseAmount = Number(data.amount || workOrder.actual_cost || workOrder.estimated_cost || 0);
    const taxAmount = Number(data.tax_amount || 0);
    const total_amount = Number((baseAmount + taxAmount).toFixed(2));

    const invoice = await InvoiceRepository.create({
      id,
      invoice_number,
      work_order_id: data.work_order_id,
      contractor_id: contractorId,
      amount: baseAmount,
      tax_amount: taxAmount,
      total_amount,
      status: INVOICE_STATUS.PENDING,
      due_date: data.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: data.notes || `Invoice claim for completed work on ${workOrder.tracking_number} - ${workOrder.title}`,
      pdf_url: null
    });

    // Notify Approvers and Admins about new invoice claim
    try {
      const approvers = await UserRepository.findAll({ role: 'APPROVER' });
      const admins = await UserRepository.findAll({ role: 'ADMIN' });
      const recipients = [...approvers, ...admins];

      for (const recipient of recipients) {
        await NotificationService.sendNotification({
          userId: recipient.id,
          title: `New Invoice Submitted: ${invoice_number}`,
          message: `${contractor?.name || 'Contractor'} submitted invoice ${invoice_number} for ${workOrder.tracking_number} ($${total_amount.toLocaleString()}). Action Required: Review and approve disbursement.`,
          type: 'invoice',
          link: `/invoices`
        });
      }
    } catch (notifErr) {
      console.warn('Failed to send invoice notification:', notifErr.message);
    }

    return invoice;
  }

  static async updateInvoiceStatus(id, { status, notes }, actorUser) {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    // Require associated work order to be VERIFIED or CLOSED before Approving or Paying invoice claim
    if ((status === INVOICE_STATUS.APPROVED || status === INVOICE_STATUS.PAID) && invoice.work_order_id) {
      const wo = await WorkOrderRepository.findById(invoice.work_order_id);
      if (wo) {
        if (wo.status !== WORK_ORDER_STATUS.CLOSED && wo.status !== WORK_ORDER_STATUS.VERIFIED) {
          throw new AppError(
            `Cannot ${status} invoice. Associated work order (${wo.tracking_number}) must be Verified or Closed first (currently '${wo.status}').`,
            400
          );
        }

        // Segregation of Duties: User who approved the WO budget cannot approve payment
        if (wo.approved_by && wo.approved_by === actorUser.id && actorUser.role !== 'ADMIN') {
          throw AppError.forbidden(
            'Segregation of Duties Violation: You approved the Work Order budget for this ticket. An independent Finance / Payment Approver must authorize payment.'
          );
        }

        // Segregation of Duties: User who assigned the contractor cannot approve payment
        if (wo.assigned_by && wo.assigned_by === actorUser.id && actorUser.role !== 'ADMIN') {
          throw AppError.forbidden(
            'Segregation of Duties Violation: You assigned the contractor for this work order. An independent Finance / Payment Approver must authorize payment.'
          );
        }
      }
    }

    const updated = await InvoiceRepository.update(id, {
      status,
      notes: notes || invoice.notes
    });

    // Notify Contractor regarding invoice status change
    try {
      const contractorUsers = await UserRepository.findAll({ role: 'CONTRACTOR' });
      const recipientIds = new Set(contractorUsers.map((u) => u.id));
      if (invoice.contractor_id) {
        const directUser = await UserRepository.findById(invoice.contractor_id);
        if (directUser) recipientIds.add(directUser.id);
      }

      const notifConfig = {
        [INVOICE_STATUS.APPROVED]: {
          title: `Invoice Approved: ${invoice.invoice_number}`,
          message: `Invoice claim ${invoice.invoice_number} ($${Number(invoice.total_amount).toLocaleString()}) was approved by ${actorUser?.name || 'Approver'}.`,
          type: 'success'
        },
        [INVOICE_STATUS.PAID]: {
          title: `Invoice Paid & Settled: ${invoice.invoice_number}`,
          message: `Invoice claim ${invoice.invoice_number} ($${Number(invoice.total_amount).toLocaleString()}) has been paid and marked settled.`,
          type: 'success'
        },
        [INVOICE_STATUS.REJECTED]: {
          title: `Invoice Rejected: ${invoice.invoice_number}`,
          message: `Invoice claim ${invoice.invoice_number} was rejected by ${actorUser?.name || 'Approver'}.${notes ? ` Reason: ${notes}` : ''}`,
          type: 'critical'
        }
      };

      const cfg = notifConfig[status];
      if (cfg) {
        for (const cUserId of recipientIds) {
          if (cUserId !== actorUser?.id) {
            await NotificationService.sendNotification({
              userId: cUserId,
              title: cfg.title,
              message: cfg.message,
              type: cfg.type,
              link: `/invoices`
            });
          }
        }
      }
    } catch (notifErr) {
      console.warn('Failed to send invoice status notification:', notifErr.message);
    }

    // If invoice is marked as PAID, automatically close the verified work order and record audit event
    if (status === INVOICE_STATUS.PAID && invoice.work_order_id) {
      try {
        const wo = await WorkOrderRepository.findById(invoice.work_order_id);
        if (wo && wo.status === WORK_ORDER_STATUS.VERIFIED) {
          await WorkflowService.transitionStatus({
            workOrderId: invoice.work_order_id,
            targetStatus: WORK_ORDER_STATUS.CLOSED,
            actor: actorUser,
            notes: `Work order closed upon invoice settlement payment (${invoice.invoice_number})`
          });
        }
      } catch (err) {
        console.warn('Could not auto-close work order on invoice payment:', err.message);
      }
    }

    return updated;
  }

  static async getFinancialSummary() {
    const summary = await InvoiceRepository.getFinancialSummary();
    return {
      totalBilled: Number(summary?.total_billed || 0),
      totalPaid: Number(summary?.total_paid || 0),
      totalPending: Number(summary?.total_pending || 0),
      totalApproved: Number(summary?.total_approved || 0)
    };
  }

  static async requestInvoice({ work_order_id }, actorUser) {
    const workOrder = await WorkOrderRepository.findById(work_order_id);
    if (!workOrder) {
      throw new AppError('Work Order not found', 404);
    }

    if (workOrder.status !== WORK_ORDER_STATUS.VERIFIED && workOrder.status !== WORK_ORDER_STATUS.CLOSED) {
      throw new AppError(
        `Cannot request invoice for work order in '${workOrder.status}' status. It must be verified or closed first.`,
        400
      );
    }

    const existing = await InvoiceRepository.findByWorkOrderId(work_order_id);
    if (existing) {
      throw new AppError(`Invoice claim (${existing.invoice_number}) already exists for this Work Order`, 400);
    }

    let contractorUsers = [];
    if (workOrder.contractor_id || workOrder.assigned_to) {
      const direct = await UserRepository.findById(workOrder.contractor_id || workOrder.assigned_to);
      if (direct) contractorUsers.push(direct);
    }
    if (contractorUsers.length === 0) {
      contractorUsers = await UserRepository.findAll({ role: 'CONTRACTOR' });
    }

    for (const contractor of contractorUsers) {
      await NotificationService.sendNotification({
        userId: contractor.id,
        title: `Invoice Claim Requested: ${workOrder.tracking_number}`,
        message: `${actorUser.name} (${actorUser.role}) has requested you to submit your invoice claim for verified work order ${workOrder.tracking_number} - "${workOrder.title}".`,
        type: 'invoice',
        link: `/work-orders/${workOrder.id}`
      });
    }

    return {
      success: true,
      message: `Invoice claim request sent to contractor (${contractorUsers.map((c) => c.name).join(', ')}) successfully`
    };
  }
}
