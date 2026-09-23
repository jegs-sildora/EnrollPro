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
import { getScpApplicants, bulkSaveScpAssessments, lockScpRoster, unlockScpRoster, forfeitScpSlot, restoreScpApplication } from "./controllers/enrollment.scp.controller.js";
import { saveScpAssessment } from "./enrollment.controller.js";
import { validate } from "../../middleware/validate.js";
import { authorizeScpProgram } from "../../middleware/scpAuthorize.js";
import { directEncodeWalkInSchema, scpAssessmentUpdateSchema } from "@enrollpro/shared";

const router: Router = Router();

const enrollmentProcessorRoles = [
  "HEAD_REGISTRAR",
  "SYSTEM_ADMIN",
  "CLASS_ADVISER",
  "GRADE 7 COORDINATOR",
  "GRADE 8 COORDINATOR",
  "GRADE 9 COORDINATOR",
  "GRADE 10 COORDINATOR",
] as const;

router.post(
  "/finalize-intake",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  finalizeIntake,
);

router.get(
  "/pending-verifications",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  getPendingVerifications,
);

router.patch(
  "/:applicationId/flag-deficient",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  flagDeficient,
);

router.patch(
  "/:applicationId/cancel",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  cancelApplication,
);

router.patch(
  "/:applicationId/restore",
  authenticate,
  authorize(...enrollmentProcessorRoles),
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
  authorize(...enrollmentProcessorRoles),
  revertApplication,
);

router.post(
  "/walk-in",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  validate(directEncodeWalkInSchema),
  directEncodeWalkIn,
);

router.get(
  "/walk-in/atlas-subjects",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  getWalkInAtlasSubjects,
);

router.patch(
  "/:applicationId/complete-requirements",
  authenticate,
  authorize(...enrollmentProcessorRoles),
  completeRequirements,
);

router.get(
  "/scp-applicants",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  getScpApplicants,
);

router.patch(
  "/scp-applicants/bulk-assessment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  bulkSaveScpAssessments,
);

router.post(
  "/scp-applicants/lock-roster",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  lockScpRoster,
);

router.post(
  "/scp-applicants/unlock-roster",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  unlockScpRoster,
);

router.patch(
  "/scp-applicants/:applicationId/assessment",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  validate(scpAssessmentUpdateSchema),
  saveScpAssessment,
);

router.post(
  "/scp-applicants/:applicationId/forfeit",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  forfeitScpSlot,
);

router.post(
  "/scp-applicants/:applicationId/restore",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "PRINCIPAL", "SCHOOL_REGISTRAR", "STE_COORDINATOR", "SPA_COORDINATOR", "SPS_COORDINATOR", "STE HEAD TEACHER", "SPA HEAD TEACHER", "SPS HEAD TEACHER"),
  authorizeScpProgram,
  restoreScpApplication,
);

export default router;
