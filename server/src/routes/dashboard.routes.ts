import { Router } from 'express';
import { getStats } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router: Router = Router();

router.get('/stats', authenticate, authorize('REGISTRAR'), getStats);

export default router;
