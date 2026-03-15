import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { getStudents, getStudentById, updateStudent } from '../controllers/students.controller.js';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// Get all students with search and filters
router.get('/', authorize('REGISTRAR', 'TEACHER'), getStudents);

// Get single student by ID
router.get('/:id', authorize('REGISTRAR', 'TEACHER'), getStudentById);

// Update student information
router.put('/:id', authorize('REGISTRAR'), updateStudent);

export default router;
