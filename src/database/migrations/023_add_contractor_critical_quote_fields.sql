-- Migration 023: Add Contractor Critical Job Quote & Engineering Review Fields
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_cost REAL DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_breakdown TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_status TEXT DEFAULT NULL; -- 'submitted', 'adjusted', 'approved'
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_submitted_at DATETIME DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_engineer_notes TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_approved_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_critical_quote_approved_at DATETIME DEFAULT NULL;
