import { Router } from 'express';
import {
  listSchoolYears,
  getSchoolYear,
  createSchoolYear,
  updateSchoolYear,
  transitionSchoolYear,
  deleteSchoolYear,
  getNextDefaults,
  toggleOverride,
  updateDates,
} from '../controllers/schoolYearController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

// TEACHER needs list to see the SYSwitcher, SYSTEM_ADMIN needs access to manage
router.get('/', authenticate, authorize('REGISTRAR', 'SYSTEM_ADMIN', 'TEACHER'), listSchoolYears);
router.get('/next-defaults', authenticate, authorize('SYSTEM_ADMIN'), getNextDefaults);
router.get('/:id', authenticate, authorize('SYSTEM_ADMIN'), getSchoolYear);
router.post('/activate', authenticate, authorize('SYSTEM_ADMIN'), createSchoolYear);
router.put('/:id', authenticate, authorize('SYSTEM_ADMIN'), updateSchoolYear);
router.patch('/:id/status', authenticate, authorize('SYSTEM_ADMIN'), transitionSchoolYear);
router.patch('/:id/override', authenticate, authorize('SYSTEM_ADMIN'), toggleOverride);
router.patch('/:id/dates', authenticate, authorize('SYSTEM_ADMIN'), updateDates);
router.delete('/:id', authenticate, authorize('SYSTEM_ADMIN'), deleteSchoolYear);

export default router;
