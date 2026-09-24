import { Router, type Router as ExpressRouter } from "express";
import {
  submitAdmission,
  submitWalkInAdmission,
  submitEnrollment,
  trackApplication,
  updateExistingApplication,
  validateLrn,
  getLearnerProfile,
} from "./admission.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { authorizeScpProgram } from "../../middleware/scpAuthorize.js";

const router: ExpressRouter = Router();
const walkInRouter: ExpressRouter = Router();

const scpAdmissionManagerRoles = [
  "HEAD_REGISTRAR",
  "SYSTEM_ADMIN",
  "PRINCIPAL",
  "SCHOOL_REGISTRAR",
  "STE_COORDINATOR",
  "SPA_COORDINATOR",
  "SPS_COORDINATOR",
  "STE HEAD TEACHER",
  "SPA HEAD TEACHER",
  "SPS HEAD TEACHER",
] as const;

router.post("/admissions", submitAdmission);
walkInRouter.post(
  "/walk-in",
  authenticate,
  authorize(...scpAdmissionManagerRoles),
  authorizeScpProgram,
  submitWalkInAdmission,
);
router.post("/enrollments", submitEnrollment);
router.put("/update-existing", updateExistingApplication);
router.get("/track/:trackingNumber", trackApplication);
router.get("/validate-lrn/:lrn", validateLrn);
router.get("/learner-profile/:lrn", getLearnerProfile);

export const admissionRoutes = router;
export const walkInAdmissionRoutes = walkInRouter;
