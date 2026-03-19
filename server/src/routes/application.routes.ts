import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  applicationSubmitSchema,
  approveSchema,
  rejectSchema,
  scheduleExamSchema,
  recordResultSchema,
  rescheduleExamSchema,
} from "../validators/application.validator.js";
import * as ctrl from "../controllers/applicationController.js";
import * as docCtrl from "../controllers/documentController.js";
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

// F2F Walk-in EARLY REGISTRATION - REGISTRAR + SYSTEM_ADMIN (authenticated)
router.post(
  "/f2f",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(applicationSubmitSchema),
  ctrl.storeF2F,
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
  "/documents/:docId",
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
  "/:id/approve",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(approveSchema),
  ctrl.approve,
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
  "/:id/checklist",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
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

// SCP routes
router.patch(
  "/:id/mark-eligible",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markEligible,
);
router.patch(
  "/:id/schedule-exam",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(scheduleExamSchema),
  ctrl.scheduleExam,
);
router.patch(
  "/:id/reschedule-exam",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(rescheduleExamSchema),
  ctrl.rescheduleExam,
);
router.patch(
  "/:id/record-result",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(recordResultSchema),
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
