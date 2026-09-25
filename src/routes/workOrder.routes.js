import { Router } from 'express';
import {
  getWorkOrders,
  getWorkOrderById,
  createWorkOrder,
  updateWorkOrder,
  uploadWorkOrderPhotos
} from '../controllers/workOrder.controller.js';
import {
  transitionStatus,
  getAuditChain,
  verifyIntegrity
} from '../controllers/workflow.controller.js';
import { validate } from '../middleware/validate.js';
import { createWorkOrderSchema, updateWorkOrderSchema } from '../validators/workOrder.validator.js';
import { transitionStatusSchema } from '../validators/workflow.validator.js';
import { authenticateJWT } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

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

export default router;
