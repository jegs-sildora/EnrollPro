import { Router } from 'express';
import {
  listAcademicYears,
  getAcademicYear,
  createAcademicYear,
  updateAcademicYear,
  transitionAcademicYear,
  deleteAcademicYear,
  getNextDefaults,
  toggleOverride,
  updateDates,
} from '../controllers/academicYearController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

router.get('/', authenticate, authorize('REGISTRAR'), listAcademicYears);
router.get('/next-defaults', authenticate, authorize('REGISTRAR'), getNextDefaults);
router.get('/:id', authenticate, authorize('REGISTRAR'), getAcademicYear);
router.post('/activate', authenticate, authorize('REGISTRAR'), createAcademicYear);
router.put('/:id', authenticate, authorize('REGISTRAR'), updateAcademicYear);
router.patch('/:id/status', authenticate, authorize('REGISTRAR'), transitionAcademicYear);
router.patch('/:id/override', authenticate, authorize('REGISTRAR'), toggleOverride);
router.patch('/:id/dates', authenticate, authorize('REGISTRAR'), updateDates);
router.delete('/:id', authenticate, authorize('REGISTRAR'), deleteAcademicYear);

export default router;
