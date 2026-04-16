import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  applicationSubmitSchema,
  approveSchema,
  rejectSchema,
  scheduleExamSchema,
  recordResultSchema,
  rescheduleExamSchema,
  updateChecklistSchema,
  requestRevisionSchema,
  scheduleInterviewSchema,
  recordInterviewResultSchema,
  scheduleAssessmentStepSchema,
  recordStepResultSchema,
  rescheduleAssessmentStepSchema,
  batchProcessSchema,
} from "@enrollpro/shared";
import * as ctrl from "./early-registration.controller.js";
import * as docCtrl from "./document.controller.js";
import rateLimit from "express-rate-limit";
import multer from "multer";
import path from "path";

const router: Router = Router();

// Multer config for document upload
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
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Rate-limit public submission endpoint (15 submissions per 15-min window per IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many submissions. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post("/", submitLimiter, validate(applicationSubmitSchema), ctrl.store);
router.get("/track/:trackingNumber", ctrl.track);
router.get("/lookup-lrn/:lrn", submitLimiter, ctrl.lookupByLrn);
// Backward-compatible alias used by existing client callers
router.get("/lookup-by-lrn/:lrn", submitLimiter, ctrl.lookupByLrn);

// F2F Walk-in EARLY REGISTRATION - REGISTRAR + SYSTEM_ADMIN (authenticated)
router.post(
  "/f2f",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(applicationSubmitSchema),
  ctrl.storeF2F,
);

// Batch processing — must be before /:id routes
router.patch(
  "/batch-process",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchProcessSchema),
  ctrl.batchProcess,
);

// SCP Rankings — must be before /:id routes
router.get(
  "/scp-rankings",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getRankings,
);

router.get(
  "/exports/lis-master",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.exportLisMasterCsv,
);

// Protected routes - REGISTRAR + SYSTEM_ADMIN
router.get(
  "/",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.index,
);
router.get(
  "/:id",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.show,
);
router.get(
  "/:id/detailed",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.showDetailed,
);
router.get(
  "/:id/timeline",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getTimeline,
);
router.get(
  "/:id/sections",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getSectionsForAssignment,
);
router.get(
  "/:id/requirements",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getRequirements,
);
router.get(
  "/:id/navigate",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.navigate,
);

// Document Management
router.post(
  "/:id/documents",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  upload.single("document"),
  docCtrl.upload,
);
router.delete(
  "/:id/documents",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  docCtrl.remove,
);

router.put(
  "/:id",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.update,
);
router.patch(
  "/:id/profile-lock",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  ctrl.setProfileLock,
);
router.patch(
  "/:id/approve",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(approveSchema),
  ctrl.approve,
);
router.patch(
  "/:id/verify",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.verify,
);
router.patch(
  "/:id/enroll",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.enroll,
);
router.patch(
  "/:id/temporarily-enroll",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markTemporarilyEnrolled,
);
router.patch(
  "/:id/assign-lrn",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.assignLrn,
);
router.patch(
  "/:id/checklist",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateChecklistSchema),
  ctrl.updateChecklist,
);
router.patch(
  "/:id/reject",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(rejectSchema),
  ctrl.reject,
);
router.patch(
  "/:id/revision",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(requestRevisionSchema),
  ctrl.requestRevision,
);
router.patch(
  "/:id/withdraw",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.withdraw,
);
router.patch(
  "/:id/offer-regular",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(approveSchema),
  ctrl.offerRegular,
);

// SCP routes — pipeline-aware
router.patch(
  "/:id/mark-eligible",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markEligible,
);
router.patch(
  "/:id/schedule-assessment",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(scheduleAssessmentStepSchema),
  ctrl.scheduleAssessmentStep,
);
router.patch(
  "/:id/record-step-result",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(recordStepResultSchema),
  ctrl.recordStepResult,
);
router.patch(
  "/:id/reschedule-assessment",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(rescheduleAssessmentStepSchema),
  ctrl.rescheduleAssessmentStep,
);

// Legacy SCP routes (backward compat — same handlers)
router.patch(
  "/:id/schedule-exam",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(scheduleAssessmentStepSchema),
  ctrl.scheduleExam,
);
router.patch(
  "/:id/reschedule-exam",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(rescheduleAssessmentStepSchema),
  ctrl.rescheduleExam,
);
router.patch(
  "/:id/schedule-interview",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(scheduleInterviewSchema),
  ctrl.scheduleInterview,
);
router.patch(
  "/:id/record-interview-result",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(recordInterviewResultSchema),
  ctrl.recordInterviewResult,
);
router.patch(
  "/:id/mark-interview-passed",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markInterviewPassed,
);
router.patch(
  "/:id/record-result",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(recordStepResultSchema),
  ctrl.recordResult,
);
router.patch(
  "/:id/pass",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.pass,
);
router.patch(
  "/:id/fail",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.fail,
);

export default router;
