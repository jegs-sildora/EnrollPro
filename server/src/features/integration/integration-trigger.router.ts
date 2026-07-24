import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  syncSmartSectionGrades,
  syncAtlasFaculty,
  getAtlasTeachingLoad,
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

export default router;
