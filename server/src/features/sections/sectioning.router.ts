import { Router } from "express";
import {
  getSectionsSummary,
  getSectioningPool,
  assignBulk,
  commitDraft,
} from "./sectioning.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { staffIntakePhaseGuard } from "../../middleware/staff-intake-phase.guard.js";

const router: Router = Router();

// All sectioning operations require Registrar or Admin access
router.use(authenticate);
router.use(authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"));

router.get("/sections-summary", getSectionsSummary);
router.get("/pool", getSectioningPool);
router.post("/assign-bulk", staffIntakePhaseGuard, assignBulk);
router.post("/commit-draft", staffIntakePhaseGuard, commitDraft);

export default router;
