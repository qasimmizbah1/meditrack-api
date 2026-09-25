import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createInvoiceSchema, updateInvoiceStatusSchema } from '../validators/invoice.validator.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateJWT);

router.get('/summary', InvoiceController.getSummary);
router.get('/', InvoiceController.list);
router.get('/:id', InvoiceController.getById);

router.post(
  '/',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER, ROLES.CONTRACTOR),
  validate(createInvoiceSchema),
  InvoiceController.create
);

router.patch(
  '/:id/status',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
  validate(updateInvoiceStatusSchema),
  InvoiceController.updateStatus
);

export default router;
