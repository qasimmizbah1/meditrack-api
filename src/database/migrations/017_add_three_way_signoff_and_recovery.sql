-- 017_add_three_way_signoff_and_recovery.sql
-- NC DOH & Quantum Built HVAC Maintenance SLA Plan (PDF Page 5)
-- 3-Way Completion Tri-Signoff & Client Recovery Invoicing Stream

ALTER TABLE work_orders ADD COLUMN signoff_engineer_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN signoff_engineer_at TEXT DEFAULT NULL;

ALTER TABLE work_orders ADD COLUMN signoff_fm_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN signoff_fm_at TEXT DEFAULT NULL;

ALTER TABLE work_orders ADD COLUMN signoff_inspector_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN signoff_inspector_at TEXT DEFAULT NULL;

ALTER TABLE work_orders ADD COLUMN completion_cert_no TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN client_recovery_invoice_no TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN client_recovery_status TEXT DEFAULT 'pending';
ALTER TABLE work_orders ADD COLUMN signoff_rejection_reason TEXT DEFAULT NULL;
