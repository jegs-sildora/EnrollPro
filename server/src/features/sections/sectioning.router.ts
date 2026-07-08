import { Router } from "express";
import {
  getSectionsSummary,
  getSectioningPool,
  assignBulk,
  commitDraft,
} from "./sectioning.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router: Router = Router();

// All sectioning operations require Registrar or Admin access
router.use(authenticate);
router.use(authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"));

router.get("/sections-summary", getSectionsSummary);
router.get("/pool", getSectioningPool);
router.post("/assign-bulk", assignBulk);
router.post("/commit-draft", commitDraft);

export default router;
