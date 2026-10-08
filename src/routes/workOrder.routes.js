import { Router } from 'express';
import {
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  uploadWorkOrderPhotos,
  submitAssessment,
  assignLeadAssessor,
  requestEngineer,
  handleEngineerRequest,
  reviewEstimate,
  submitCriticalQuote,
  reviewCriticalQuote,
  getContractorQuotations,
  inviteContractors,
  submitContractorQuotation,
  recommendContractorQuotation,
  reviewContractorRecommendation,
  deleteWorkOrder,
  clearAllWorkOrders
} from '../controllers/workOrder.controller.js';
import {
  transitionStatus,
  getAuditChain,
  verifyIntegrity
} from '../controllers/workflow.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createWorkOrderSchema,
  updateWorkOrderSchema,
  submitAssessmentSchema
} from '../validators/workOrder.validator.js';
import { transitionStatusSchema } from '../validators/workflow.validator.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Protect all work order routes with JWT
router.use(authenticateJWT);

router.get('/', getWorkOrders);
router.get('/:id', getWorkOrderById);

// Create new work order (allows uploading up to 5 initial photos)
router.post(
  '/',
  upload.array('photos', 5),
  validate(createWorkOrderSchema),
  createWorkOrder
);

// Engineering Assessor Scope & Cost Estimation with Automated Funding Dispatcher
router.post(
  '/:id/assessment',
  validate(submitAssessmentSchema),
  submitAssessment
);

// Part 1: Quantum Built Assigns Lead Assessor
router.post(
  '/:id/assign-lead-assessor',
  assignLeadAssessor
);

// Part 1: Lead Inspector Requests Engineer from Quantum Built
router.post(
  '/:id/request-engineer',
  requestEngineer
);

// Part 1: Quantum Built Fulfills or Declines Engineer Request
router.post(
  '/:id/handle-engineer-request',
  handleEngineerRequest
);

// Part 1: Quantum Built 3-Way Estimate Review (Approve / Adjust / Reject)
router.post(
  '/:id/review-estimate',
  reviewEstimate
);

// Critical Emergency Job Quote Submission (by Contractor)
router.post(
  '/:id/critical-quote',
  submitCriticalQuote
);

// Critical Emergency Job Quote Review (Adjust / Approve with Auto-Invoice by Works Engineer)
router.post(
  '/:id/critical-quote-review',
  reviewCriticalQuote
);

// Multi-Contractor Quotations & Selection
router.get('/:id/quotations', getContractorQuotations);
router.post('/:id/invite-contractors', inviteContractors);
router.post('/:id/quotations', submitContractorQuotation);
router.post('/:id/recommend-quotation', recommendContractorQuotation);
router.post('/:id/review-quotation-recommendation', reviewContractorRecommendation);


// Workflow Status Transition (Immutable event & SHA-256 hash generation)
router.patch(
  '/:id/status',
  validate(transitionStatusSchema),
  transitionStatus
);

// Cryptographic Audit Trail & Hash Chain verification
router.get('/:id/audit-chain', getAuditChain);
router.post('/:id/verify-integrity', verifyIntegrity);

// Update general work order details
router.patch(
  '/:id',
  validate(updateWorkOrderSchema),
  updateWorkOrder
);

// Upload additional photos to an existing work order
router.post(
  '/:id/photos',
  upload.array('photos', 5),
  uploadWorkOrderPhotos
);

// Admin-only: Clear all test work orders and linked test data
router.delete(
  '/clear-all',
  authorizeRoles(ROLES.ADMIN),
  clearAllWorkOrders
);

// Admin-only: Delete a single work order and its linked records
router.delete(
  '/:id',
  authorizeRoles(ROLES.ADMIN),
  deleteWorkOrder
);

export default router;

