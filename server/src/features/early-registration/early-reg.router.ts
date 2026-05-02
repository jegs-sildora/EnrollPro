import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  batchAssignRegularSectionCommitSchema,
  batchAssignRegularSectionPreviewSchema,
  batchAssignRegularSectionSchema,
  batchFinalizeInterviewSchema,
  batchSaveScoresSchema,
  batchScheduleStepSchema,
  batchVerifyDocumentsPreviewSchema,
  batchVerifyDocumentsSchema,
  earlyRegistrationSubmitSchema,
  rejectSchema,
  scheduleAssessmentStepSchema,
  updateChecklistSchema,
} from "@enrollpro/shared";
import * as ctrl from "./early-reg.controller.js";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";

const router: Router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve("uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Rate-limit public submission (15 per 15-min window per IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    message:
      "Too many submissions right now. Please try again in a few minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public ──
router.get("/check-lrn/:lrn", ctrl.checkLrn);

router.post(
  "/",
  submitLimiter,
  validate(earlyRegistrationSubmitSchema),
  ctrl.store,
);

// ── Registrar / Admin ──
router.post(
  "/f2f",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(earlyRegistrationSubmitSchema),
  ctrl.storeF2F,
);

router.get(
  "/",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.index,
);

router.get(
  "/:id",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.show,
);

router.patch(
  "/:id/verify",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.verify,
);

router.post(
  "/:id/documents",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  upload.single("document"),
  ctrl.uploadDocument,
);

router.delete(
  "/:id/documents",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.removeDocument,
);

router.patch(
  "/:id/checklist",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateChecklistSchema),
  ctrl.updateChecklist,
);

// ── Lifecycle (admin) ──
router.patch(
  "/batch-process",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.batchProcess,
);

router.post(
  "/batch/verify-documents/preview",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchVerifyDocumentsPreviewSchema),
  ctrl.batchVerifyDocumentsPreview,
);

router.patch(
  "/batch/verify-documents",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchVerifyDocumentsSchema),
  ctrl.batchVerifyDocuments,
);

router.patch(
  "/batch/assign-regular-section/commit",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchAssignRegularSectionCommitSchema),
  ctrl.batchAssignRegularSectionsCommit,
);

router.post(
  "/batch/assign-regular-section/preview",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchAssignRegularSectionPreviewSchema),
  ctrl.batchAssignRegularSectionsPreview,
);

router.patch(
  "/batch/assign-regular-section",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchAssignRegularSectionSchema),
  ctrl.batchAssignRegularSection,
);

router.patch(
  "/batch/schedule-step",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchScheduleStepSchema),
  ctrl.batchScheduleStep,
);

router.patch(
  "/batch/save-scores",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchSaveScoresSchema),
  ctrl.batchSaveScores,
);

router.patch(
  "/batch/finalize-interview",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchFinalizeInterviewSchema),
  ctrl.batchFinalizeInterview,
);

router.get(
  "/:id/detailed",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.showDetailed,
);

router.get(
  "/:id/requirements",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.getRequirements,
);

router.patch(
  "/:id/reject",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(rejectSchema),
  ctrl.reject,
);

router.patch(
  "/:id/withdraw",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.withdraw,
);

router.patch(
  "/:id/mark-eligible",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markEligible,
);

router.patch(
  "/:id/schedule-assessment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(scheduleAssessmentStepSchema),
  ctrl.scheduleAssessment,
);

router.patch(
  "/:id/record-step-result",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.recordStepResult,
);

router.patch(
  "/:id/pass",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.pass,
);

router.patch(
  "/:id/fail",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.fail,
);

router.patch(
  "/:id/approve",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.approve,
);

router.patch(
  "/:id/temporarily-enroll",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.temporarilyEnroll,
);

router.patch(
  "/:id/enroll",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.enroll,
);

router.patch(
  "/:id/assign-lrn",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.assignLrn,
);

router.patch(
  "/:id/mark-interview-passed",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markInterviewPassed,
);

export default router;
