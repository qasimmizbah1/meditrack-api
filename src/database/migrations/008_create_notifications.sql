-- Migration 008: Notifications & Alerts
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT 0,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- Seed initial notifications with valid foreign keys
INSERT OR IGNORE INTO notifications (id, user_id, title, message, type, link, is_read, created_at)
VALUES 
    ('notif_001', 'usr_admin_01', 'System Security Audit Active', 'Deterministic SHA-256 Merkle Ledger audit engine initialized.', 'info', '/dashboard', 0, datetime('now', '-2 hours')),
    ('notif_002', 'usr_admin_01', 'New Quality Inspection Conducted', 'QC Inspector filed PASS for MRI Chiller coolant replacement.', 'success', '/inspections', 0, datetime('now', '-30 minutes')),
    ('notif_003', 'usr_contractor_01', 'Work Order Assigned', 'You have been assigned to WO-2026-0001 (Emergency Power Generator Overhaul).', 'work_order', '/work-orders', 0, datetime('now', '-1 hour')),
    ('notif_004', 'usr_approver_01', 'Pending Invoice Claim', 'MedTech Solutions submitted invoice for $12,500 awaiting approval.', 'invoice', '/invoices', 0, datetime('now', '-15 minutes')),
    ('notif_005', 'usr_inspector_01', 'QC Inspection Required', 'WO-2026-0002 has completed repair and is ready for safety inspection.', 'warning', '/inspections', 0, datetime('now', '-5 minutes'));
