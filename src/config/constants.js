export const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  APPROVER: 'APPROVER',
  CONTRACTOR: 'CONTRACTOR',
  INSPECTOR: 'INSPECTOR',
  AUDITOR: 'AUDITOR'
};

export const WORK_ORDER_STATUS = {
  REPORTED: 'reported',
  APPROVED: 'approved',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

export const WORK_ORDER_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

export const INSPECTION_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL'
};

export const INVOICE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
};

export const CONTRACTOR_COMPLIANCE_STATUS = {
  COMPLIANT: 'compliant',
  WARNING: 'warning',
  NON_COMPLIANT: 'non_compliant'
};

export const APPROVER_SCOPES = {
  WO_APPROVER: 'wo_approver',
  CONTRACTOR_APPROVER: 'contractor_approver',
  PAYMENT_APPROVER: 'payment_approver',
  PROCUREMENT: 'procurement',
  LINE_MANAGER: 'line_manager',
  GENERAL: 'general'
};

export const CONTRACTOR_APPROVAL_STATUS = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  REJECTED: 'rejected'
};

