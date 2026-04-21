import { Router } from 'express';
import {
	listSections,
	listTeachers,
	createSection,
	updateSection,
	deleteSection,
	getBatchPrerequisites,
	runBatchSectioning,
	commitBatchSectioning,
} from './sections.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { createSectionSchema, updateSectionSchema, batchSectioningSchema } from '@enrollpro/shared';

const router: Router = Router();

router.get(
	'/teachers',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	listTeachers,
);

router.get(
	'/batch-sectioning/prerequisites/:gradeLevelId',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	getBatchPrerequisites,
);

router.post(
	'/batch-sectioning/run',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	validate(batchSectioningSchema),
	runBatchSectioning,
);

router.post(
	'/batch-sectioning/commit',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	validate(batchSectioningSchema),
	commitBatchSectioning,
);

router.get(
	'/',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	listSections,
);
router.get(
	'/:ayId',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	listSections,
);
router.post(
	'/',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	validate(createSectionSchema),
	createSection,
);
router.put(
	'/:id',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	validate(updateSectionSchema),
	updateSection,
);
router.delete(
	'/:id',
	authenticate,
	authorize('REGISTRAR', 'SYSTEM_ADMIN'),
	deleteSection,
);

export default router;
