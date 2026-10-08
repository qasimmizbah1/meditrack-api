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
  urgency_category: z.string().optional().nullable(),
  funding_route: z.enum(['route_a', 'route_b']).optional().nullable(),
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
  actual_cost: z.coerce.number().min(0).optional().nullable(),
  system_quote_no: z.string().optional().nullable(),
  contractor_quote_ref: z.string().optional().nullable(),
  direct_issue_justification: z.string().optional().nullable(),
  quote_status: z.enum(['under_review', 'awaiting_client', 'client_approved', 'client_declined']).optional().nullable(),
  client_approved_by: z.string().optional().nullable(),
  client_approved_at: z.string().optional().nullable(),
  client_decline_reason: z.string().optional().nullable(),
  signoff_engineer_by: z.string().optional().nullable(),
  signoff_engineer_at: z.string().optional().nullable(),
  signoff_fm_by: z.string().optional().nullable(),
  signoff_fm_at: z.string().optional().nullable(),
  signoff_inspector_by: z.string().optional().nullable(),
  signoff_inspector_at: z.string().optional().nullable(),
  completion_cert_no: z.string().optional().nullable(),
  client_recovery_invoice_no: z.string().optional().nullable(),
  client_recovery_status: z.enum(['pending', 'submitted', 'recovered']).optional().nullable(),
  signoff_rejection_reason: z.string().optional().nullable(),
  assessor_role: z.enum(['works_engineer', 'works_inspector']).optional().nullable(),
  timesheet_data: z.string().optional().nullable(),
  timesheet_total_hours: z.coerce.number().min(0).optional().nullable(),
  timesheet_submitted_by: z.string().optional().nullable(),
  timesheet_submitted_at: z.string().optional().nullable(),
  inspector_timesheet_data: z.string().optional().nullable(),
  inspector_timesheet_hours: z.coerce.number().min(0).optional().nullable(),
  inspector_timesheet_by: z.string().optional().nullable(),
  inspector_timesheet_at: z.string().optional().nullable(),
  engineer_timesheet_data: z.string().optional().nullable(),
  engineer_timesheet_hours: z.coerce.number().min(0).optional().nullable(),
  engineer_timesheet_by: z.string().optional().nullable(),
  engineer_timesheet_at: z.string().optional().nullable(),
  assessor_estimate: z.coerce.number().min(0).optional().nullable(),
  charge_code: z.enum(['PRE', 'ONS', 'TRV', 'EVI', 'FIN']).optional().nullable(),
  assessment_notes: z.string().optional().nullable(),
  assessment_date: z.string().optional().nullable(),
  assessment_hours: z.coerce.number().min(0).optional().nullable(),
  estimated_days: z.coerce.number().min(0).optional().nullable()
});

export const submitAssessmentSchema = z.object({
  assessment_type: z.enum(['offsite', 'onsite'], {
    required_error: 'Assessment mode is required (offsite or onsite)'
  }),
  assessor_role: z.enum(['works_engineer', 'works_inspector']).optional().default('works_engineer'),
  assessor_estimate: z.coerce.number().min(0, 'Assessor estimate must be at least R0').optional().nullable(),
  charge_code: z.enum(['PRE', 'ONS', 'TRV', 'EVI', 'FIN'], {
    required_error: 'Valid charge code is required (PRE, ONS, TRV, EVI, FIN)'
  }),
  assessment_hours: z.coerce.number().min(0).optional().nullable(),
  estimated_days: z.coerce.number().min(0).optional().nullable(),
  due_date: z.string().optional().nullable(),
  assessment_notes: z.string().optional().nullable(),
  route_b_override: z.boolean().optional(),
  refer_to_engineer: z.boolean().optional(),
  itemized_breakdown: z.any().optional().nullable(),
  timesheet_data: z.any().optional().nullable(),
  timesheet_hours: z.coerce.number().min(0).optional().nullable()
});

