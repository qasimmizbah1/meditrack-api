import { z } from 'zod';
import { INVOICE_STATUS } from '../config/constants.js';

export const createInvoiceSchema = z.object({
  work_order_id: z.string().min(1, 'Work order ID is required'),
  contractor_id: z.string().min(1, 'Contractor ID is required'),
  amount: z.coerce.number().positive('Invoice base amount must be greater than 0'),
  tax_amount: z.coerce.number().min(0).default(0),
  due_date: z.string().min(4, 'Due date is required'),
  notes: z.string().optional().nullable()
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum([
    INVOICE_STATUS.PENDING,
    INVOICE_STATUS.APPROVED,
    INVOICE_STATUS.REJECTED,
    INVOICE_STATUS.PAID
  ]),
  notes: z.string().optional().nullable()
});
