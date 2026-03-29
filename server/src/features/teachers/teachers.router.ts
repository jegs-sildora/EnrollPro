import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import * as teachersCtrl from './teachers.controller.js';
import { validate } from '../../middleware/validate.js';
import { teacherSchema, updateTeacherSchema } from '@enrollpro/shared';

const router: Router = Router();

// All teacher routes require SYSTEM_ADMIN role
router.use(authenticate, authorize('SYSTEM_ADMIN'));

router.get('/', teachersCtrl.index);
router.get('/:id', teachersCtrl.show);
router.post('/', validate(teacherSchema), teachersCtrl.store);
router.put('/:id', validate(updateTeacherSchema), teachersCtrl.update);
router.patch('/:id/deactivate', teachersCtrl.deactivate);
router.patch('/:id/reactivate', teachersCtrl.reactivate);

export default router;
