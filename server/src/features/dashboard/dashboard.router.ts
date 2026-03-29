import { Router } from 'express';
import { getStats } from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router: Router = Router();

// Dashboard stats are visible to all staff roles
router.get(
	'/stats',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN', 'TEACHER'),
	getStats,
);

export default router;
