import { WorkflowService } from '../services/workflow.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const transitionStatus = catchAsync(async (req, res) => {
  const { status, notes, assigned_to, contractor_id, actual_cost } = req.body;
  const result = await WorkflowService.transitionStatus({
    workOrderId: req.params.id,
    targetStatus: status,
    actor: req.user,
    notes,
    assignedTo: assigned_to,
    contractorId: contractor_id,
    actualCost: actual_cost
  });

  return ApiResponse.success(res, result, `Status transitioned to ${status.toUpperCase()} successfully`);
});

export const getAuditChain = catchAsync(async (req, res) => {
  const chain = await WorkflowService.getAuditChain(req.params.id);
  return ApiResponse.success(res, chain, 'Cryptographic audit chain retrieved');
});

export const verifyIntegrity = catchAsync(async (req, res) => {
  const chain = await WorkflowService.getAuditChain(req.params.id);
  return ApiResponse.success(
    res,
    {
      work_order_id: chain.work_order_id,
      tracking_number: chain.tracking_number,
      is_valid: chain.integrity.is_tamper_free,
      verified_events: chain.integrity.verified_events_count,
      error: chain.integrity.error,
      verified_at: chain.integrity.verified_at
    },
    chain.integrity.is_tamper_free
      ? 'Audit chain integrity verified: Zero tampering detected.'
      : 'Tamper Alert: Hash chain integrity check failed!'
  );
});
