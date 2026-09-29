import { Router } from 'express';
import {
  getWorkCategories,
  getWorkCategoryById,
  createWorkCategory,
  updateWorkCategory,
  deleteWorkCategory
} from '../controllers/workCategory.controller.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Authenticated users can list categories to populate creation dropdowns
router.use(authenticateJWT);

router.get('/', getWorkCategories);
router.get('/:id', getWorkCategoryById);

// Admin-only management (Add, Edit, Delete categories)
router.post('/', authorizeRoles(ROLES.ADMIN), createWorkCategory);
router.put('/:id', authorizeRoles(ROLES.ADMIN), updateWorkCategory);
router.delete('/:id', authorizeRoles(ROLES.ADMIN), deleteWorkCategory);

export default router;
