import { Router } from 'express';
import { createDepartment, listDepartments } from '../controllers/departmentController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { createDepartmentSchema } from '../validators/department.validator.js';

const router: Router = Router();

router.post('/', authenticate, validate(createDepartmentSchema), createDepartment);
router.get('/', authenticate, listDepartments);

export default router;
