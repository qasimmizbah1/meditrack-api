-- Migration: Add contractor invitations and seed multiple contractors for competitive bidding

ALTER TABLE work_orders ADD COLUMN invited_contractor_ids TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN quote_invitation_mode TEXT DEFAULT NULL; -- 'single' or 'multi'
ALTER TABLE work_orders ADD COLUMN quote_invitation_notes TEXT DEFAULT NULL;
ALTER TABLE work_orders ADD COLUMN quote_invited_at TEXT DEFAULT NULL;

-- Ensure additional contractors exist for multi-contractor quoting
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status, facility_id)
VALUES 
  ('usr_contractor_02', 'MediTech Precision Systems (Contractor 2)', 'contractor2@meditrack.com', '$2b$10$wGszbWLDJAL8/NOWlxe06.uTDUlTPlNK8EXbDTYsj6QvN8GVhKla2', 'CONTRACTOR', 'active', 'fac_01'),
  ('usr_contractor_03', 'Vanguard Clinical Engineering (Contractor 3)', 'contractor3@meditrack.com', '$2b$10$wGszbWLDJAL8/NOWlxe06.uTDUlTPlNK8EXbDTYsj6QvN8GVhKla2', 'CONTRACTOR', 'active', 'fac_01');
