-- 020_add_estimated_days.sql
-- Adds explicit estimated_days column to store turnaround days from assessment scoping

ALTER TABLE work_orders ADD COLUMN estimated_days INTEGER;
