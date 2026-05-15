import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  syncSmartSectionGrades,
  syncAtlasFaculty,
  getAtlasTeachingLoad,
  broadcastPhase1,
  broadcastPhase2,
} from "./integration-trigger.controller.js";

const router: Router = Router();

// Integration triggers are SYSTEM_ADMIN only — they touch external systems.
router.post(
  "/smart/sections/:id/sync-grades",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  syncSmartSectionGrades,
);

router.post(
  "/atlas/sync-faculty",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  syncAtlasFaculty,
);

router.get(
  "/atlas/faculty/:id/teaching-load",
  authenticate,
  getAtlasTeachingLoad,
);

router.post(
  "/broadcast/phase1",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  broadcastPhase1,
);

router.post(
  "/broadcast/phase2",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  broadcastPhase2,
);

export default router;
