import { Router } from 'express';
import {
  getFacilities,
  getFacilityById,
  createFacility,
  updateFacility,
  deleteFacility
} from '../controllers/facility.controller.js';
import { validate } from '../middleware/validate.js';
import { createFacilitySchema, updateFacilitySchema } from '../validators/facility.validator.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Protect all facility endpoints with JWT authentication
router.use(authenticateJWT);

router.get('/', getFacilities);
router.get('/:id', getFacilityById);

// Create / Update facilities restricted to ADMIN and APPROVER
router.post(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
  validate(createFacilitySchema),
  createFacility
);

router.put(
  '/:id',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
  validate(updateFacilitySchema),
  updateFacility
);

// Delete restricted to ADMIN only
router.delete(
  '/:id',
  authorizeRoles(ROLES.ADMIN),
  deleteFacility
);

export default router;
