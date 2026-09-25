import crypto from 'crypto';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { WorkOrderRepository } from '../repositories/workOrder.repository.js';
import { ContractorRepository } from '../repositories/contractor.repository.js';
import { WorkflowService } from './workflow.service.js';
import { AppError } from '../utils/AppError.js';
import { WORK_ORDER_STATUS, INVOICE_STATUS } from '../config/constants.js';

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
    const validStatuses = [WORK_ORDER_STATUS.VERIFIED, WORK_ORDER_STATUS.CLOSED, 'completed'];
    if (!validStatuses.includes(workOrder.status)) {
      throw new AppError(
        `Cannot invoice work order in '${workOrder.status}' status. Work order must be verified by QC inspector or completed first.`,
        400
      );
    }

    // 2. Check for duplicate invoice
    const existing = await InvoiceRepository.findByWorkOrderId(data.work_order_id);
    if (existing) {
      throw new AppError(`An invoice (${existing.invoice_number}) already exists for this Work Order`, 409);
    }

    // 3. Verify Contractor
    const contractor = await ContractorRepository.findById(data.contractor_id);
    if (!contractor) {
      throw new AppError('Contractor not found', 404);
    }

    const id = crypto.randomUUID();
    const invoice_number = await InvoiceRepository.generateNextInvoiceNumber();
    const baseAmount = Number(data.amount);
    const taxAmount = Number(data.tax_amount || 0);
    const total_amount = Number((baseAmount + taxAmount).toFixed(2));

    const invoice = await InvoiceRepository.create({
      id,
      invoice_number,
      work_order_id: data.work_order_id,
      contractor_id: data.contractor_id,
      amount: baseAmount,
      tax_amount: taxAmount,
      total_amount,
      status: INVOICE_STATUS.PENDING,
      due_date: data.due_date,
      notes: data.notes || null,
      pdf_url: null
    });

    return invoice;
  }

  static async updateInvoiceStatus(id, { status, notes }, actorUser) {
    const invoice = await InvoiceRepository.findById(id);
    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const updated = await InvoiceRepository.update(id, {
      status,
      notes: notes || invoice.notes
    });

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
}
