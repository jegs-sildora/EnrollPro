import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./eosy.controller.js";

const router: Router = Router();

router.get(
  "/stream",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER", "TEACHER"),
  ctrl.streamEosyUpdates,
);

router.get(
  "/sections",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getEosySections,
);

router.get(
  "/sections/:id/records",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getSectionRecords,
);

router.patch(
  "/records/:id",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.updateEosyRecord,
);

router.post(
  "/records/:id/override",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.overrideEosyRecord,
);

router.post(
  "/sections/:id/finalize",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.finalizeSection,
);

router.get(
  "/grade/:gradeLevelId/records",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getGradeRecords,
);

router.put(
  "/grade/:gradeLevelId/batch-status",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.batchUpdateGradeRecords,
);

router.post(
  "/grade/:gradeLevelId/finalize",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.finalizeGradeLevel,
);

router.post(
  "/grade/:gradeLevelId/unlock",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.unlockGradeLevelEosy,
);

router.post(
  "/batch-update",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.batchUpdateEosyRecords,
);

router.post(
  "/sections/:id/reopen",
  authenticate,
  authorize("SYSTEM_ADMIN"), // Reopening is admin only as per spec
  ctrl.reopenSection,
);

router.get(
  "/school-year/:schoolYearId/export-lock",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.getSchoolYearExportLock,
);

router.get(
  "/school-year/:schoolYearId/final-lis-export",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.downloadFinalLisExport,
);

router.post(
  "/school-year/finalize",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  ctrl.finalizeSchoolYear,
);

router.post(
  "/school-year/unlock",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  ctrl.unlockSchoolYearEosy,
);

router.post(
  "/sections/:id/unlock",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.unlockSectionEosy,
);

router.get(
  "/sections/:id/exports/sf5",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.exportSF5,
);

router.get(
  "/exports/sf6",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.exportSF6,
);

export default router;
