-- Migration 016: Add Route A Quote Approval Lifecycle (PDF Page 4)
ALTER TABLE work_orders ADD COLUMN quote_status TEXT DEFAULT NULL; -- 'under_review', 'awaiting_client', 'client_approved', 'client_declined'
ALTER TABLE work_orders ADD COLUMN client_approved_by TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN client_approved_at DATETIME DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN client_decline_reason TEXT DEFAULT NULL;
