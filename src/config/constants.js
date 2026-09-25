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
  CLOSED: 'closed'
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
