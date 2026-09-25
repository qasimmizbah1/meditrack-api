import { Router } from 'express';
import {
  getInspections,
  getInspectionById,
  createInspection,
  updateInspection
} from '../controllers/inspection.controller.js';
import { validate } from '../middleware/validate.js';
import { createInspectionSchema, updateInspectionSchema } from '../validators/inspection.validator.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Protect all inspection routes with JWT
router.use(authenticateJWT);

router.get('/', getInspections);
router.get('/:id', getInspectionById);

// Submit Inspection (Restricted to INSPECTOR and ADMIN)
router.post(
  '/',
  authorizeRoles(ROLES.INSPECTOR, ROLES.ADMIN),
  upload.array('photos', 5),
  validate(createInspectionSchema),
  createInspection
);

router.put(
  '/:id',
  authorizeRoles(ROLES.INSPECTOR, ROLES.ADMIN),
  validate(updateInspectionSchema),
  updateInspection
);

export default router;
