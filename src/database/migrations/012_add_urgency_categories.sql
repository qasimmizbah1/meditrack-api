-- Migration 012: Add HVAC Maintenance Plan Urgency Categories & Funding Routes
ALTER TABLE work_orders ADD COLUMN urgency_category TEXT DEFAULT 'Urgent 4–8 days';
ALTER TABLE work_orders ADD COLUMN funding_route TEXT DEFAULT 'route_b';
ALTER TABLE work_orders ADD COLUMN statutory_notice_sent INTEGER DEFAULT 0;
