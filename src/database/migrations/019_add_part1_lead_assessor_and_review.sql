-- 019_add_part1_lead_assessor_and_review.sql
-- Implements Part 1: Lead Assessor Assignment, Inspector->QB Engineer Request & Decision, Assessment Time Sessions, and 3-Way Review (Approve/Adjust/Reject)

ALTER TABLE work_orders ADD COLUMN lead_assessor_id TEXT;
ALTER TABLE work_orders ADD COLUMN lead_assessor_role TEXT;
ALTER TABLE work_orders ADD COLUMN assessor_request_engineer INTEGER DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN assessor_request_reason TEXT;
ALTER TABLE work_orders ADD COLUMN assessor_request_status TEXT;
ALTER TABLE work_orders ADD COLUMN assessor_request_engineer_id TEXT;
ALTER TABLE work_orders ADD COLUMN assessment_hours REAL;
ALTER TABLE work_orders ADD COLUMN assessment_review_status TEXT;
ALTER TABLE work_orders ADD COLUMN assessment_adjustment_notes TEXT;
