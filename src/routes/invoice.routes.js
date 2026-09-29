import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { authenticateJWT, authorizeRoles, authorizeApproverScope } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createInvoiceSchema, updateInvoiceStatusSchema } from '../validators/invoice.validator.js';
import { ROLES, APPROVER_SCOPES } from '../config/constants.js';

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

router.post(
  '/request',
  authorizeRoles(ROLES.ADMIN, ROLES.APPROVER),
  InvoiceController.requestInvoice
);

router.patch(
  '/:id/status',
  authorizeApproverScope(APPROVER_SCOPES.PAYMENT_APPROVER, APPROVER_SCOPES.GENERAL),
  validate(updateInvoiceStatusSchema),
  InvoiceController.updateStatus
);

export default router;

