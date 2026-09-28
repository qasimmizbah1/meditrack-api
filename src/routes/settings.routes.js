import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Settings can be read by authenticated users, updated only by ADMIN
router.use(authenticateJWT);

router.get('/', getSettings);
router.patch('/', authorizeRoles(ROLES.ADMIN), updateSettings);

export default router;
