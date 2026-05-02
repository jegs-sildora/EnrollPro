import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { syncSmartGrades, confirmConfirmationSlip, batchConfirmConfirmationSlips } from "./enrollment.controller.js";

const router = Router();

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

export default router;
