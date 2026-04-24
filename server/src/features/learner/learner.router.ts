import { Router } from 'express';
import { lookupLearner, lookupLearnerByLrn } from './learner.controller.js';
import { validate } from '../../middleware/validate.js';
import { learnerLookupSchema } from '@enrollpro/shared';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

// Rate limiting: 10 attempts per 15 minutes per IP address
const learnerLookupLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 10, // limit each IP to 10 requests per windowMs
	message: { message: 'Too many attempts. Please try again in 15 minutes.' },
	standardHeaders: true,
	legacyHeaders: false,
});

// Learner portal lookup endpoint - public
router.post(
	'/lookup',
	learnerLookupLimiter,
	validate(learnerLookupSchema),
	lookupLearner,
);

// Registrar lookup endpoint for Confirmation Slip workflow
router.get('/lookup', lookupLearnerByLrn);

export default router;
