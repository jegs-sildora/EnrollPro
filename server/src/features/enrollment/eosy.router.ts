import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./eosy.controller.js";

const router = Router();

router.get(
  "/sections",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getEosySections,
);

router.get(
  "/sections/:id/records",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getSectionRecords,
);

router.patch(
  "/records/:id",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.updateEosyRecord,
);

router.post(
  "/sections/:id/finalize",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.finalizeSection,
);

router.post(
  "/sections/:id/reopen",
  authenticate,
  authorize("SYSTEM_ADMIN"), // Reopening is admin only as per spec
  ctrl.reopenSection,
);

router.post(
  "/school-year/finalize",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  ctrl.finalizeSchoolYear,
);

export default router;
