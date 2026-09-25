import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

router.use(authenticateJWT);

router.get('/summary', DashboardController.getSummary);

export default router;
