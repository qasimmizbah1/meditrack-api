-- Migration 015: Add Sourcing and Quoting Fields
ALTER TABLE work_orders ADD COLUMN system_quote_no TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_quote_ref TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN direct_issue_justification TEXT DEFAULT NULL;
