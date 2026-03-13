import { Router } from 'express';
import {
  listGradeLevels,
  createGradeLevel,
  updateGradeLevel,
  deleteGradeLevel,
  listStrands,
  createStrand,
  updateStrand,
  deleteStrand,
  updateStrandMatrix,
} from '../controllers/curriculumController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

// Grade Levels
router.get('/:ayId/grade-levels', authenticate, authorize('REGISTRAR'), listGradeLevels);
router.post('/:ayId/grade-levels', authenticate, authorize('REGISTRAR'), createGradeLevel);
router.put('/grade-levels/:id', authenticate, authorize('REGISTRAR'), updateGradeLevel);
router.delete('/grade-levels/:id', authenticate, authorize('REGISTRAR'), deleteGradeLevel);

// Strands
router.get('/:ayId/strands', authenticate, authorize('REGISTRAR'), listStrands);
router.post('/:ayId/strands', authenticate, authorize('REGISTRAR'), createStrand);
router.put('/strands/:id', authenticate, authorize('REGISTRAR'), updateStrand);
router.delete('/strands/:id', authenticate, authorize('REGISTRAR'), deleteStrand);

// Matrix
router.put('/:ayId/strand-matrix', authenticate, authorize('REGISTRAR'), updateStrandMatrix);

export default router;
