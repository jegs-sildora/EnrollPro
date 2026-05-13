import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getBosyReadiness,
  getBosyQueue,
  syncBosyQueueHandler,
  confirmReturnHandler,
  bulkConfirmReturnHandler,
  getJHSCompletersHandler,
  getTLEProgramsHandler,
} from "./bosy.controller.js";

const router = Router();

router.get(
  "/readiness",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getBosyReadiness,
);

router.get(
  "/queue",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getBosyQueue,
);

router.post(
  "/sync",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  syncBosyQueueHandler,
);

router.post(
  "/confirm-return/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  confirmReturnHandler,
);

router.post(
  "/bulk-confirm",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  bulkConfirmReturnHandler,
);

router.get(
  "/completers",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getJHSCompletersHandler,
);

router.get(
  "/tle-programs",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "REGISTRAR"),
  getTLEProgramsHandler,
);

export default router;
