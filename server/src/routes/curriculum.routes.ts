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
  listScpConfigs,
  updateScpConfigs,
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

// Strand-to-Grade Matrix
router.put('/:ayId/strand-matrix', authenticate, authorize('REGISTRAR'), updateStrandMatrix);

// SCP Configs
router.get('/:ayId/scp-config', authenticate, authorize('REGISTRAR'), listScpConfigs);
router.put('/:ayId/scp-config', authenticate, authorize('REGISTRAR'), updateScpConfigs);

export default router;
