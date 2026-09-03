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

router.post(
  "/walk-in",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  directEncodeWalkIn,
);

export default router;
