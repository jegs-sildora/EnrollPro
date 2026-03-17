import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as ctrl from '../controllers/auditLogController.js';

const router: Router = Router();

router.get('/', authenticate, authorize('SYSTEM_ADMIN'), ctrl.index);
router.get('/export', authenticate, authorize('SYSTEM_ADMIN'), ctrl.exportCsv);

export default router;
