-- Migration 013: Add Assessor Estimation and Assessment Fields
ALTER TABLE work_orders ADD COLUMN assessment_type TEXT DEFAULT NULL; -- 'offsite', 'onsite'
ALTER TABLE work_orders ADD COLUMN assessor_id TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN assessor_estimate REAL DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN charge_code TEXT DEFAULT NULL; -- 'PRE', 'ONS', 'TRV', 'FIN'
ALTER TABLE work_orders ADD COLUMN assessment_notes TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN assessment_date TEXT DEFAULT NULL;
