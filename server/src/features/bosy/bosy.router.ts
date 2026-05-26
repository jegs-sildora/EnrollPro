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
  getPhase2QueueHandler,
  confirmScpSlotHandler,
  verifyBeefHandler,
  routeToScpScreeningHandler,
  markBeefPendingHandler,
  resolveBeefHandler,
  revertToPendingBeefHandler,
  downgradeToBeefHandler,
  flushNoShowsHandler,
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
  "/bulk-confirm",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  bulkConfirmReturnHandler,
);

router.post(
  "/confirm-scp-slot/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  confirmScpSlotHandler,
);

router.post(
  "/verify-beef/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  verifyBeefHandler,
);

router.post(
  "/route-to-scp/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  routeToScpScreeningHandler,
);

router.post(
  "/mark-pending/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  markBeefPendingHandler,
);

router.post(
  "/resolve-beef/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  resolveBeefHandler,
);

router.get(
  "/completers",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getJHSCompletersHandler,
);

router.post(
  "/revert-to-pending/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  revertToPendingBeefHandler,
);

router.post(
  "/downgrade-to-beef/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  downgradeToBeefHandler,
);

router.post(
  "/flush-no-shows",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  flushNoShowsHandler,
);

export default router;
