import { z } from 'zod';
import { WORK_ORDER_PRIORITY, WORK_ORDER_STATUS } from '../config/constants.js';

export const createWorkOrderSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(5, 'Detailed description is required'),
  facility_id: z.string().min(1, 'Facility selection is required'),
  location_details: z.string().optional().nullable(),
  category: z.string().default('Biomedical Equipment'),
  priority: z.enum([
    WORK_ORDER_PRIORITY.LOW,
    WORK_ORDER_PRIORITY.MEDIUM,
    WORK_ORDER_PRIORITY.HIGH,
    WORK_ORDER_PRIORITY.CRITICAL
  ]).default(WORK_ORDER_PRIORITY.MEDIUM),
  estimated_cost: z.coerce.number().min(0).optional().nullable(),
  due_date: z.string().optional().nullable()
});

export const updateWorkOrderSchema = createWorkOrderSchema.partial().extend({
  status: z.enum([
    WORK_ORDER_STATUS.REPORTED,
    WORK_ORDER_STATUS.APPROVED,
    WORK_ORDER_STATUS.ASSIGNED,
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.COMPLETED,
    WORK_ORDER_STATUS.VERIFIED,
    WORK_ORDER_STATUS.CLOSED,
    WORK_ORDER_STATUS.CANCELLED
  ]).optional(),
  assigned_to: z.string().optional().nullable(),
  contractor_id: z.string().optional().nullable(),
  actual_cost: z.coerce.number().min(0).optional().nullable()
});
