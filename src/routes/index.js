import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import facilityRoutes from './facility.routes.js';
import workOrderRoutes from './workOrder.routes.js';
import contractorRoutes from './contractor.routes.js';
import inspectionRoutes from './inspection.routes.js';
import invoiceRoutes from './invoice.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import notificationRoutes from './notification.routes.js';
import ledgerAnchorRoutes from './ledgerAnchor.routes.js';

const router = Router();

// Mount Health Check
router.use('/health', healthRoutes);

// Mount Auth & User Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Mount Facilities Routes
router.use('/facilities', facilityRoutes);

// Mount Work Orders Routes
router.use('/work-orders', workOrderRoutes);

// Mount Contractors Routes
router.use('/contractors', contractorRoutes);

// Mount Inspections Routes
router.use('/inspections', inspectionRoutes);

// Mount Invoices Routes
router.use('/invoices', invoiceRoutes);

// Mount Dashboard Routes
router.use('/dashboard', dashboardRoutes);

// Mount Notification Routes
router.use('/notifications', notificationRoutes);

// Mount Ledger Anchors & Cryptographic Audit Routes
router.use('/ledger', ledgerAnchorRoutes);

export default router;
