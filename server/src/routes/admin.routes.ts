import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as userCtrl from '../controllers/adminUserController.js';
import * as emailCtrl from '../controllers/adminEmailLogController.js';
import * as sysCtrl from '../controllers/adminSystemController.js';

const router: Router = Router();

// All admin routes require SYSTEM_ADMIN role
router.use(authenticate, authorize('SYSTEM_ADMIN'));

// User Management
router.get('/users', userCtrl.index);
router.post('/users', userCtrl.store);
router.put('/users/:id', userCtrl.update);
router.patch('/users/:id/deactivate', userCtrl.deactivate);
router.patch('/users/:id/reactivate', userCtrl.reactivate);
router.patch('/users/:id/reset-password', userCtrl.resetPassword);

// Email Logs
router.get('/email-logs', emailCtrl.index);
router.get('/email-logs/export', emailCtrl.exportCsv);
router.get('/email-logs/:id', emailCtrl.show);
router.patch('/email-logs/:id/resend', emailCtrl.resend);

// System Health
router.get('/system/health', sysCtrl.health);
router.get('/dashboard/stats', sysCtrl.dashboardStats);

export default router;
