-- 018_add_assessor_role.sql
-- Allow selection between Site / Works Engineer vs Site / Works Inspector on Technical Assessment

ALTER TABLE work_orders ADD COLUMN assessor_role TEXT DEFAULT 'works_engineer';
