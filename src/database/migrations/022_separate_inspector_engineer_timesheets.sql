-- 022_separate_inspector_engineer_timesheets.sql
-- Adds separate timesheet fields for Works Inspector and Works Engineer

ALTER TABLE work_orders ADD COLUMN inspector_timesheet_data TEXT;
ALTER TABLE work_orders ADD COLUMN inspector_timesheet_hours REAL;
ALTER TABLE work_orders ADD COLUMN inspector_timesheet_by TEXT;
ALTER TABLE work_orders ADD COLUMN inspector_timesheet_at DATETIME;

ALTER TABLE work_orders ADD COLUMN engineer_timesheet_data TEXT;
ALTER TABLE work_orders ADD COLUMN engineer_timesheet_hours REAL;
ALTER TABLE work_orders ADD COLUMN engineer_timesheet_by TEXT;
ALTER TABLE work_orders ADD COLUMN engineer_timesheet_at DATETIME;
