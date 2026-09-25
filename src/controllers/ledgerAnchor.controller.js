import { LedgerAnchorService } from '../services/ledgerAnchor.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export class LedgerAnchorController {
  static list = catchAsync(async (req, res) => {
    const data = await LedgerAnchorService.listAnchors(req.query);
    return ApiResponse.success(res, data.anchors, 'Ledger anchors retrieved successfully', 200, data.meta);
  });

  static getById = catchAsync(async (req, res) => {
    const anchor = await LedgerAnchorService.getAnchorById(req.params.id);
    return ApiResponse.success(res, anchor, 'Ledger anchor retrieved successfully');
  });

  static createBatch = catchAsync(async (req, res) => {
    const result = await LedgerAnchorService.createBatchAnchor(req.user);
    return ApiResponse.created(res, result, 'New Merkle batch anchored successfully');
  });

  static getProof = catchAsync(async (req, res) => {
    const proof = await LedgerAnchorService.generateProofForEvent(req.params.eventId);
    return ApiResponse.success(res, proof, 'Merkle inclusion proof generated successfully');
  });

  static verifyProof = catchAsync(async (req, res) => {
    const { leafHash, proofPath, expectedRoot } = req.body;
    const result = LedgerAnchorService.verifyProof(leafHash, proofPath, expectedRoot);
    return ApiResponse.success(res, result, 'Merkle proof evaluated');
  });

  static auditLedger = catchAsync(async (req, res) => {
    const auditReport = await LedgerAnchorService.verifyEntireAuditLedger();
    return ApiResponse.success(res, auditReport, 'Full cryptographic audit executed');
  });
}
