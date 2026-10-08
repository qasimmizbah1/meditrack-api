-- Migration: Add itemized assessment breakdown and multi-contractor quotations support
ALTER TABLE work_orders ADD COLUMN assessment_itemized_breakdown TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN selected_contractor_quote_id TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN engineer_recommendation_notes TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN engineer_recommended_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN engineer_recommended_at TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_approver_action TEXT DEFAULT NULL; -- 'approved', 'reevaluate'
ALTER TABLE work_orders ADD COLUMN contractor_approver_notes TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_approver_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN contractor_approver_at TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS contractor_quotations (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  contractor_name TEXT DEFAULT NULL,
  quote_ref TEXT DEFAULT NULL,
  amount REAL NOT NULL,
  breakdown TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status TEXT DEFAULT 'submitted', -- 'submitted', 'recommended', 'assigned', 'rejected'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (contractor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contractor_quotations_wo ON contractor_quotations(work_order_id);
