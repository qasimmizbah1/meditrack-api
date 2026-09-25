import { z } from 'zod';
import { WORK_ORDER_STATUS } from '../config/constants.js';

export const transitionStatusSchema = z.object({
  status: z.enum([
    WORK_ORDER_STATUS.REPORTED,
    WORK_ORDER_STATUS.APPROVED,
    WORK_ORDER_STATUS.ASSIGNED,
    WORK_ORDER_STATUS.IN_PROGRESS,
    WORK_ORDER_STATUS.COMPLETED,
    WORK_ORDER_STATUS.VERIFIED,
    WORK_ORDER_STATUS.CLOSED
  ]),
  notes: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  contractor_id: z.string().optional().nullable(),
  actual_cost: z.coerce.number().min(0).optional().nullable()
});
