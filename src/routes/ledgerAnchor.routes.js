import { Router } from 'express';
import { LedgerAnchorController } from '../controllers/ledgerAnchor.controller.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Public / Auditor Verification Endpoints (no auth required for transparent public verification)
router.post('/verify-proof', LedgerAnchorController.verifyProof);
router.get('/audit-ledger', LedgerAnchorController.auditLedger);
router.get('/proof/:eventId', LedgerAnchorController.getProof);

// Authenticated Routes
router.use(authenticateJWT);

router.get('/', LedgerAnchorController.list);
router.get('/:id', LedgerAnchorController.getById);

// Trigger batch anchoring (ADMIN, AUDITOR, APPROVER)
router.post(
  '/batch',
  authorizeRoles(ROLES.ADMIN, ROLES.AUDITOR, ROLES.APPROVER),
  LedgerAnchorController.createBatch
);

export default router;
