import { Router } from 'express';
import { exportSF1, exportLisMaster } from './export.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router: Router = Router();

router.get('/sf1/:sectionId', authenticate, authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'), exportSF1);
router.get('/lis-master', authenticate, authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'), exportLisMaster);

export default router;
