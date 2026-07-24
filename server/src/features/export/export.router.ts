import { Router } from 'express';
import { exportSF1, exportLisMaster, exportSF7 } from './export.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router: Router = Router();

router.get(
  '/sf1/:sectionId',
  authenticate,
  authorize('TEACHER', 'HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
  exportSF1,
);
router.get('/lis-master', authenticate, authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'), exportLisMaster);
router.get('/sf7', authenticate, authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'), exportSF7);

export default router;
