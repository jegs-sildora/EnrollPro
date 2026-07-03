import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getBosyReadiness,
  getBosyQueue,
  syncBosyQueueHandler,
  confirmReturnHandler,
  markTransferRequestHandler,
  bulkConfirmReturnHandler,
  getJHSCompletersHandler,
  getPhase2QueueHandler,
  getPreviousSectionsHandler,
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

router.get(
  "/previous-sections",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getPreviousSectionsHandler,
);

router.get(
  "/phase2-queue",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  getPhase2QueueHandler,
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
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "REGISTRAR", "TEACHER"),
  confirmReturnHandler,
);

router.post(
  "/transfer-request/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "REGISTRAR"),
  markTransferRequestHandler,
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
