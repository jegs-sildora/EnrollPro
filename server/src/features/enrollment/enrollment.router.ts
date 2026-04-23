import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { syncSmartGrades } from "./enrollment.controller.js";

const router = Router();

router.post(
  "/sync-smart-grades",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  syncSmartGrades,
);

export default router;
