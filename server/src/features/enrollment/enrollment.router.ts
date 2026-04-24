import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { syncSmartGrades, confirmConfirmationSlip } from "./enrollment.controller.js";

const router = Router();

router.post(
  "/sync-smart-grades",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  syncSmartGrades,
);

router.post(
  "/confirm-slip",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  confirmConfirmationSlip,
);

export default router;
