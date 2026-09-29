-- Migration 011: Segregation of Duties (SoD) & Approver Scopes Support

-- 1. Add approver_scope to users table (default 'general' for approvers)
ALTER TABLE users ADD COLUMN approver_scope TEXT DEFAULT 'general';

-- 2. Add contractor onboarding governance columns
ALTER TABLE contractors ADD COLUMN approval_status TEXT DEFAULT 'active';
ALTER TABLE contractors ADD COLUMN approved_by TEXT;
ALTER TABLE contractors ADD COLUMN rejection_reason TEXT;

-- 3. Add dual-signoff tracking to work orders table
ALTER TABLE work_orders ADD COLUMN approved_by TEXT;
ALTER TABLE work_orders ADD COLUMN assigned_by TEXT;
