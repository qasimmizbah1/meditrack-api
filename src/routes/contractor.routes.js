import { Router } from 'express';
import {
  getContractors,
  getContractorById,
  createContractor,
  reviewContractor,
  updateContractor,
  uploadContractorDocument
} from '../controllers/contractor.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createContractorSchema,
  updateContractorSchema,
  createDocumentSchema
} from '../validators/contractor.validator.js';
import { authenticateJWT, authorizeRoles, authorizeApproverScope } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ROLES, APPROVER_SCOPES } from '../config/constants.js';

const router = Router();

// Protect all contractor routes with JWT
router.use(authenticateJWT);

router.get('/', getContractors);
router.get('/:id', getContractorById);

// Create contractors (Admin only)
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN),
  validate(createContractorSchema),
  createContractor
);

// Review & Activate Contractor (Admin only)
router.post(
  '/:id/review',
  authorizeRoles(ROLES.ADMIN),
  reviewContractor
);

// Update contractor details (Admin only)
router.put(
  '/:id',
  authorizeRoles(ROLES.ADMIN),
  validate(updateContractorSchema),
  updateContractor
);

// Upload compliance document
router.post(
  '/:id/documents',
  upload.single('file'),
  validate(createDocumentSchema),
  uploadContractorDocument
);

export default router;
