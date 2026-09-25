import { Router } from 'express';
import { login, logout, me } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validator.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', authenticateJWT, logout);
router.get('/me', authenticateJWT, me);

export default router;
