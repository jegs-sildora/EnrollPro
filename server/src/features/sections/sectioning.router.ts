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

const sectioningRoles = [
  "HEAD_REGISTRAR",
  "SYSTEM_ADMIN",
  "GRADE 7 COORDINATOR",
  "GRADE 8 COORDINATOR",
  "GRADE 9 COORDINATOR",
  "GRADE 10 COORDINATOR",
] as const;

// Grade coordinators may section learners only within their assigned grade.
router.use(authenticate);
router.use(authorize(...sectioningRoles));

router.get("/sections-summary", getSectionsSummary);
router.get("/pool", getSectioningPool);
router.post("/assign-bulk", staffIntakePhaseGuard, assignBulk);
router.post("/commit-draft", staffIntakePhaseGuard, commitDraft);

export default router;
