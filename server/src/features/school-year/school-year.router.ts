import { Router } from 'express';
import {
	listSchoolYears,
	getSchoolYear,
	createSchoolYear,
	updateSchoolYear,
	transitionSchoolYear,
	deleteSchoolYear,
	getNextDefaults,
	toggleOverride,
	updateDates,
} from './school-year.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import {
	createSchoolYearSchema,
	updateSchoolYearSchema,
	transitionSchoolYearSchema,
	toggleOverrideSchema,
} from '@enrollpro/shared';

const router: Router = Router();

// TEACHER needs list to see the SYSwitcher, SYSTEM_ADMIN needs access to manage
router.get(
	'/',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN', 'TEACHER'),
	listSchoolYears,
);
router.get(
	'/next-defaults',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	getNextDefaults,
);
router.get('/:id', authenticate, authorize('SYSTEM_ADMIN'), getSchoolYear);
router.post(
	'/activate',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	validate(createSchoolYearSchema),
	createSchoolYear,
);
router.put(
	'/:id',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	validate(updateSchoolYearSchema),
	updateSchoolYear,
);
router.patch(
	'/:id/status',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	validate(transitionSchoolYearSchema),
	transitionSchoolYear,
);
router.patch(
	'/:id/override',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	validate(toggleOverrideSchema),
	toggleOverride,
);
router.patch(
	'/:id/dates',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	validate(updateSchoolYearSchema),
	updateDates,
);
router.delete(
	'/:id',
	authenticate,
	authorize('SYSTEM_ADMIN'),
	deleteSchoolYear,
);

export default router;
