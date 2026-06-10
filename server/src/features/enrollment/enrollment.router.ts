import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  syncSmartGrades,
  confirmConfirmationSlip,
  batchConfirmConfirmationSlips,
  finalizeIntake,
  getPendingVerifications,
  flagDeficient,
  directEncodeWalkIn,
} from "./enrollment.controller.js";

const router: Router = Router();

router.post(
  "/sync-smart-grades",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  syncSmartGrades,
);

router.post(
  "/confirm-slip",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  confirmConfirmationSlip,
);

router.post(
  "/batch-confirm",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  batchConfirmConfirmationSlips,
);

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

router.post(
  "/walk-in",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "REGISTRAR"),
  directEncodeWalkIn,
);

export default router;
