import { Router } from 'express';
import {
  listSections,
  listEligibleAdvisers,
  createSection,
  updateSection,
  deleteSection,
  getSectionMasterlist,
  exportSectionSf1,
  getUnsectionedPool,
  inlineSlotLearner,
  getBatchPrerequisites,
  runBatchSectioning,
  commitBatchSectioning,
  handoverAdviser,
  transferLearner,
  autoDistributeUnassigned,
} from "./sections.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createSectionSchema,
  updateSectionSchema,
  batchSectioningSchema,
  advisoryHandoverSchema,
} from "@enrollpro/shared";

const router: Router = Router();

router.get(
  "/teachers",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  listEligibleAdvisers,
);

router.get(
  "/batch-sectioning/prerequisites/:gradeLevelId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getBatchPrerequisites,
);

router.post(
  "/batch-sectioning/run",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchSectioningSchema),
  runBatchSectioning,
);

router.post(
  "/batch-sectioning/commit",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchSectioningSchema),
  commitBatchSectioning,
);

router.post(
  "/auto-distribute",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  autoDistributeUnassigned,
);

router.get(
  "/",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  listSections,
);
router.get(
  "/:ayId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  listSections,
);
router.post(
  "/",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(createSectionSchema),
  createSection,
);

router.post(
  "/:id/handover-adviser",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(advisoryHandoverSchema),
  handoverAdviser,
);

router.put(
  "/:id",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateSectionSchema),
  updateSection,
);
router.delete(
	'/:id',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	deleteSection,
);

router.get(
	'/:id/masterlist',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	getSectionMasterlist,
);

router.get(
	'/:id/masterlist/sf1',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	exportSectionSf1,
);

router.get(
	'/unsectioned-pool/:gradeLevelId',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	getUnsectionedPool,
);

router.post(
	'/:id/inline-slot',
	authenticate,
	authorize('HEAD_REGISTRAR', 'SYSTEM_ADMIN'),
	inlineSlotLearner,
);

router.post(
  "/transfer-learner",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  transferLearner,
);

export default router;
