-- 021_add_timesheet_fields.sql
-- Adds timesheet_data (JSON) and timesheet_total_hours to work_orders

ALTER TABLE work_orders ADD COLUMN timesheet_data TEXT;
ALTER TABLE work_orders ADD COLUMN timesheet_total_hours REAL;
ALTER TABLE work_orders ADD COLUMN timesheet_submitted_by TEXT;
ALTER TABLE work_orders ADD COLUMN timesheet_submitted_at DATETIME;
