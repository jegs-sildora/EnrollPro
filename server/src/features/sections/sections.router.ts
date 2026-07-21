import { Router } from 'express';
import multer from "multer";
import {
  listSections,
  listEligibleAdvisers,
  createSection,
  updateSection,
  deleteSection,
  getSectionMasterlist,
  exportSectionSf1,
  previewSectionSf1Import,
  commitSectionSf1Import,
  downloadSectionSf1Template,
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
import { staffIntakePhaseGuard } from "../../middleware/staff-intake-phase.guard.js";
import {
  createSectionSchema,
  updateSectionSchema,
  batchSectioningSchema,
  advisoryHandoverSchema,
  sf1ImportCommitSchema,
} from "@enrollpro/shared";

const router: Router = Router();

const sf1Upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const lowerName = file.originalname.toLowerCase();
    const lowerMime = file.mimetype.toLowerCase();
    const isXlsx =
      lowerMime ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      lowerName.endsWith(".xlsx");

    if (isXlsx) {
      callback(null, true);
      return;
    }

    callback(new Error("Only .xlsx School Form 1 roster files are allowed."));
  },
});

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
  staffIntakePhaseGuard,
  commitBatchSectioning,
);

router.post(
  "/auto-distribute",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  staffIntakePhaseGuard,
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
  "/:id/masterlist/sf1/template",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  downloadSectionSf1Template,
);

router.post(
  "/:id/masterlist/sf1/import/preview",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  sf1Upload.single("file"),
  previewSectionSf1Import,
);

router.post(
  "/:id/masterlist/sf1/import/commit",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(sf1ImportCommitSchema),
  staffIntakePhaseGuard,
  commitSectionSf1Import,
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
	staffIntakePhaseGuard,
	inlineSlotLearner,
);

router.post(
  "/transfer-learner",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  transferLearner,
);

export default router;
