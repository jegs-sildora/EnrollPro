import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  applicationSubmitSchema,
  approveSchema,
  rejectSchema,
  scheduleExamSchema,
  recordResultSchema,
} from '../validators/application.validator.js';
import * as ctrl from '../controllers/applicationController.js';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Rate-limit public submission endpoint (15 submissions per 15-min window per IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/', submitLimiter, validate(applicationSubmitSchema), ctrl.store);
router.get('/track/:trackingNumber', ctrl.track);

// Protected routes - REGISTRAR + SYSTEM_ADMIN
router.get('/', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.index);
router.get('/:id', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.show);
router.patch('/:id/approve', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), validate(approveSchema), ctrl.approve);
router.patch('/:id/reject', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), validate(rejectSchema), ctrl.reject);

// SCP routes
router.patch('/:id/schedule-exam', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), validate(scheduleExamSchema), ctrl.scheduleExam);
router.patch('/:id/record-result', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), validate(recordResultSchema), ctrl.recordResult);
router.patch('/:id/pass', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.pass);
router.patch('/:id/fail', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN'), ctrl.fail);

export default router;
