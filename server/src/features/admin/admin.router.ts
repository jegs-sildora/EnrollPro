import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
	createUserSchema,
	updateUserSchema,
	adminResetPasswordSchema,
} from '@enrollpro/shared';
import * as userCtrl from './admin-user.controller.js';
import * as emailCtrl from './admin-email-log.controller.js';
import * as sysCtrl from './admin-system.controller.js';

const router: Router = Router();

// All admin routes require SYSTEM_ADMIN role
router.use(authenticate, authorize('SYSTEM_ADMIN'));

// User Management
router.get('/users', userCtrl.index);
router.post('/users', validate(createUserSchema), userCtrl.store);
router.put('/users/:id', validate(updateUserSchema), userCtrl.update);
router.patch('/users/:id/deactivate', userCtrl.deactivate);
router.patch('/users/:id/reactivate', userCtrl.reactivate);
router.patch(
	'/users/:id/reset-password',
	validate(adminResetPasswordSchema),
	userCtrl.resetPassword,
);

// Email Logs
router.get('/email-logs', emailCtrl.index);
router.get('/email-logs/export', emailCtrl.exportCsv);
router.get('/email-logs/:id', emailCtrl.show);
router.patch('/email-logs/:id/resend', emailCtrl.resend);

// System Health
router.get('/system/health', sysCtrl.health);
router.get('/dashboard/stats', sysCtrl.dashboardStats);

export default router;
