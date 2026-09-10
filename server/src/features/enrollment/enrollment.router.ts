import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  finalizeIntake,
  getPendingVerifications,
  flagDeficient,
  directEncodeWalkIn,
  cancelApplication,
  restoreApplication,
  deleteApplication,
  revertApplication,
  completeRequirements,
} from "./enrollment.controller.js";

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
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  directEncodeWalkIn,
);

router.patch(
  "/:applicationId/complete-requirements",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  completeRequirements,
);

export default router;
