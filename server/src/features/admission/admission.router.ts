import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  applicationSubmitSchema,
  approveSchema,
  rejectSchema,
  unenrollSchema,
  processExitSchema,
  updateChecklistSchema,
  requestRevisionSchema,
  batchProcessSchema,
  readingProfileUpdateSchema,
  specialEnrollmentSchema,
} from "@enrollpro/shared";
import * as ctrl from "./early-registration.controller.js";
import * as docCtrl from "./document.controller.js";
import { secureUpload } from "../../lib/multer.js";

const router: Router = Router();

// Public routes
router.post("/", validate(applicationSubmitSchema), ctrl.store);
router.get("/track/:trackingNumber", ctrl.track);
router.get("/lookup-lrn/:lrn", ctrl.lookupByLrn);
// Backward-compatible alias used by existing client callers
router.get("/lookup-by-lrn/:lrn", ctrl.lookupByLrn);

// F2F Walk-in EARLY REGISTRATION - REGISTRAR + SYSTEM_ADMIN (authenticated)
router.post(
  "/f2f",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(applicationSubmitSchema),
  ctrl.storeF2F,
);

// Batch processing — must be before /:id routes
router.post(
  "/batch-assign-section",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.batchAssignSection,
);

router.post(
  "/batch-process",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(batchProcessSchema),
  ctrl.batchProcess,
);



router.get(
  "/exports/lis-master",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.exportLisMasterCsv,
);

router.get(
  "/exports/sf1",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.exportSf1Csv,
);

// Protected routes - REGISTRAR + SYSTEM_ADMIN
router.post(
  "/special-enrollment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(specialEnrollmentSchema),
  ctrl.specialEnrollment,
);

router.get(
  "/",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.index,
);
router.get(
  "/:id",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.show,
);
router.get(
  "/:id/detailed",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.showDetailed,
);
router.get(
  "/:id/timeline",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getTimeline,
);
router.get(
  "/:id/sections",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getSectionsForAssignment,
);
router.get(
  "/:id/requirements",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getRequirements,
);
router.get(
  "/:id/navigate",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.navigate,
);

// Document Management
router.post(
  "/:id/documents",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  secureUpload.single("document"),
  docCtrl.upload,
);
router.delete(
  "/:id/documents",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  docCtrl.remove,
);

router.put(
  "/:id",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
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
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(approveSchema),
  ctrl.approve,
);
router.patch(
  "/:id/verify",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.verify,
);
router.patch(
  "/:id/reading-profile",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(readingProfileUpdateSchema),
  ctrl.updateReadingProfile,
);
router.patch(
  "/:id/enroll",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.enroll,
);
router.patch(
  "/:id/unenroll",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(unenrollSchema),
  ctrl.unenroll,
);
router.patch(
  "/:id/process-exit",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(processExitSchema),
  ctrl.processExit,
);
router.patch(
  "/:id/restore-status",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.restoreStatus,
);

router.patch(
  "/:id/temporarily-enroll",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.markTemporarilyEnrolled,
);
router.patch(
  "/:id/assign-lrn",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.assignLrn,
);
router.patch(
  "/:id/checklist",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateChecklistSchema),
  ctrl.updateChecklist,
);
router.patch(
  "/:id/reject",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(rejectSchema),
  ctrl.reject,
);
router.patch(
  "/:id/revision",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(requestRevisionSchema),
  ctrl.requestRevision,
);
router.patch(
  "/:id/withdraw",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.withdraw,
);


// Catch-all for unhandled routes in this router
router.use((req, res) => {
  console.warn(`[DEBUG] 404 in admission.router: ${req.method} ${req.path}`);
  res.status(404).json({
    message: `Route ${req.method} ${req.path} not found in admission router`,
    path: req.path,
    method: req.method
  });
});

export default router;
