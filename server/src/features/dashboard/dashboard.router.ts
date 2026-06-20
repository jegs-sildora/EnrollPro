import { Router } from 'express';
import { getStats, lockPhaseAndExportSF1 } from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router: Router = Router();

// Dashboard stats are visible to all staff roles
router.get(
	'/stats',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN', 'TEACHER'),
	getStats,
);

// Locking phase requires high privilege
router.post(
	'/stats/lock',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	lockPhaseAndExportSF1,
);

export default router;
