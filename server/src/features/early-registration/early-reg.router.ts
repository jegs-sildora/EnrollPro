import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
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
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(earlyRegistrationSubmitSchema),
  ctrl.storeF2F,
);

router.get(
  "/",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.index,
);

router.get(
  "/:id",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.show,
);

router.patch(
  "/:id/verify",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.verify,
);

router.post(
  "/:id/documents",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  upload.single("document"),
  ctrl.uploadDocument,
);

router.delete(
  "/:id/documents",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.removeDocument,
);

router.patch(
  "/:id/checklist",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateChecklistSchema),
  ctrl.updateChecklist,
);

// ── Lifecycle (admin) ──
router.patch(
  "/batch-process",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.batchProcess,
);

router.get(
  "/:id/detailed",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.showDetailed,
);

router.patch(
  "/:id/reject",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(rejectSchema),
  ctrl.reject,
);

router.patch(
  "/:id/withdraw",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.withdraw,
);

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
  ctrl.scheduleAssessment,
);

router.patch(
  "/:id/record-step-result",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.recordStepResult,
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

router.patch(
  "/:id/approve",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.approve,
);

router.patch(
  "/:id/temporarily-enroll",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.temporarilyEnroll,
);

router.patch(
  "/:id/enroll",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.enroll,
);

router.patch(
  "/:id/assign-lrn",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.assignLrn,
);

router.patch(
  "/:id/mark-interview-passed",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markInterviewPassed,
);

export default router;
