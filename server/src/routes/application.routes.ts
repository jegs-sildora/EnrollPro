import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as ctrl from '../controllers/applicationController.js';

const router: Router = Router();

// Public routes
router.post('/', ctrl.store);
router.get('/track/:trackingNumber', ctrl.track);

// Protected routes - REGISTRAR + SYSTEM_ADMIN
router.get('/', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.index);
router.get('/:id', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.show);
router.patch('/:id/approve', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.approve);
router.patch('/:id/reject', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.reject);

// SCP routes
router.patch('/:id/schedule-exam', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.scheduleExam);
router.patch('/:id/record-result', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.recordResult);
router.patch('/:id/pass', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.pass);
router.patch('/:id/fail', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.fail);

export default router;
