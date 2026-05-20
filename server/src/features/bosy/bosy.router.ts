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
} from "./bosy.controller.js";

const router: Router = Router();

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

export default router;
