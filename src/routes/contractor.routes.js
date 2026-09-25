import { Router } from 'express';
import {
  getContractors,
  getContractorById,
  createContractor,
  updateContractor,
  uploadContractorDocument
} from '../controllers/contractor.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createContractorSchema,
  updateContractorSchema,
  createDocumentSchema
} from '../validators/contractor.validator.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Protect all contractor routes with JWT
router.use(authenticateJWT);

router.get('/', getContractors);
router.get('/:id', getContractorById);

// Create / Update contractors (Admin / Approver)
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
  validate(createContractorSchema),
  createContractor
);

router.put(
  '/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
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
