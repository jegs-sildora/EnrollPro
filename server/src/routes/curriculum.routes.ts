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
  syncStrands,
  updateStrandMatrix,
  listScpConfigs,
  updateScpConfigs,
} from '../controllers/curriculumController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

// Grade Levels
router.get('/:ayId/grade-levels', authenticate, authorize('SYSTEM_ADMIN'), listGradeLevels);
router.post('/:ayId/grade-levels', authenticate, authorize('SYSTEM_ADMIN'), createGradeLevel);
router.put('/grade-levels/:id', authenticate, authorize('SYSTEM_ADMIN'), updateGradeLevel);
router.delete('/grade-levels/:id', authenticate, authorize('SYSTEM_ADMIN'), deleteGradeLevel);

// Strands
router.get('/:ayId/strands', authenticate, authorize('SYSTEM_ADMIN'), listStrands);
router.post('/:ayId/strands', authenticate, authorize('SYSTEM_ADMIN'), createStrand);
router.put('/strands/:id', authenticate, authorize('SYSTEM_ADMIN'), updateStrand);
router.delete('/strands/:id', authenticate, authorize('SYSTEM_ADMIN'), deleteStrand);
router.put('/:ayId/strands/sync', authenticate, authorize('SYSTEM_ADMIN'), syncStrands);

// Strand-to-Grade Matrix
router.put('/:ayId/strand-matrix', authenticate, authorize('SYSTEM_ADMIN'), updateStrandMatrix);

// SCP Configs
router.get('/:ayId/scp-config', authenticate, authorize('SYSTEM_ADMIN'), listScpConfigs);
router.put('/:ayId/scp-config', authenticate, authorize('SYSTEM_ADMIN'), updateScpConfigs);

export default router;
