import { Router } from 'express';
import {
  listSections,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/sectionsController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

router.get('/', authenticate, authorize('REGISTRAR'), listSections);
router.get('/:ayId', authenticate, authorize('REGISTRAR'), listSections);
router.post('/', authenticate, authorize('REGISTRAR'), createSection);
router.put('/:id', authenticate, authorize('REGISTRAR'), updateSection);
router.delete('/:id', authenticate, authorize('REGISTRAR'), deleteSection);

export default router;
