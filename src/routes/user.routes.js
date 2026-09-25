import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../validators/auth.validator.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Protect all user management routes - require JWT authentication
router.use(authenticateJWT);

router.get('/', authorizeRoles(ROLES.ADMIN, ROLES.APPROVER, ROLES.AUDITOR), getUsers);
router.get('/:id', authorizeRoles(ROLES.ADMIN, ROLES.APPROVER, ROLES.AUDITOR), getUserById);
router.post('/', authorizeRoles(ROLES.ADMIN), validate(createUserSchema), createUser);
router.patch('/:id', authorizeRoles(ROLES.ADMIN), validate(updateUserSchema), updateUser);
router.delete('/:id', authorizeRoles(ROLES.ADMIN), deleteUser);

export default router;
