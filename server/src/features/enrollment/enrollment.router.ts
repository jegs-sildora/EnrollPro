import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  finalizeIntake,
  getPendingVerifications,
  flagDeficient,
  directEncodeWalkIn,
  getWalkInAtlasSubjects,
  cancelApplication,
  restoreApplication,
  deleteApplication,
  revertApplication,
  completeRequirements,
} from "./enrollment.controller.js";
import { getScpApplicants, bulkSaveScpAssessments, lockScpRoster } from "./controllers/enrollment.scp.controller.js";
import { saveScpAssessment } from "./enrollment.controller.js";
import { validate } from "../../middleware/validate.js";
import { directEncodeWalkInSchema, scpAssessmentUpdateSchema } from "@enrollpro/shared";

const router: Router = Router();

router.post(
  "/finalize-intake",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  finalizeIntake,
);

router.get(
  "/pending-verifications",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getPendingVerifications,
);

router.patch(
  "/:applicationId/flag-deficient",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  flagDeficient,
);

router.patch(
  "/:applicationId/cancel",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  cancelApplication,
);

router.patch(
  "/:applicationId/restore",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  restoreApplication,
);

router.delete(
  "/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  deleteApplication,
);

router.patch(
  "/:applicationId/revert",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  revertApplication,
);

router.post(
  "/walk-in",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER"),
  validate(directEncodeWalkInSchema),
  directEncodeWalkIn,
);

router.get(
  "/walk-in/atlas-subjects",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER"),
  getWalkInAtlasSubjects,
);

router.patch(
  "/:applicationId/complete-requirements",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  completeRequirements,
);

router.get(
  "/scp-applicants",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getScpApplicants,
);

router.patch(
  "/scp-applicants/bulk-assessment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  bulkSaveScpAssessments,
);

router.post(
  "/scp-applicants/lock-roster",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  lockScpRoster,
);

router.patch(
  "/scp-applicants/:applicationId/assessment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  validate(scpAssessmentUpdateSchema),
  saveScpAssessment,
);

export default router;
