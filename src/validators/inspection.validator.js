import { z } from 'zod';
import { INSPECTION_STATUS } from '../config/constants.js';

export const createInspectionSchema = z.object({
  work_order_id: z.string().min(1, 'Work order ID is required'),
  result: z.enum([INSPECTION_STATUS.PASS, INSPECTION_STATUS.FAIL]),
  checklist_results: z.string().optional().nullable(),
  observations: z.string().min(3, 'Inspection observations/notes are required'),
  recommendations: z.string().optional().nullable()
});

export const updateInspectionSchema = createInspectionSchema.partial();
