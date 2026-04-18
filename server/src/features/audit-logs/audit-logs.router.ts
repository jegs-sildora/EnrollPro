import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./audit-logs.controller.js";

const router: Router = Router();

router.get(
  "/",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.index,
);
router.get("/export", authenticate, authorize("SYSTEM_ADMIN"), ctrl.exportCsv);

export default router;
