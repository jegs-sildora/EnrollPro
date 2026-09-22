import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { staffIntakePhaseGuard } from "../../middleware/staff-intake-phase.guard.js";
import {
  getBosyReadiness,
  getBosyQueue,
  confirmReturnHandler,
  markTransferRequestHandler,
  revokeConfirmedReturnHandler,
  markConfirmedTransferOutHandler,
  bulkConfirmReturnHandler,
  getJHSCompletersHandler,
  getPreviousSectionsHandler,
} from "./bosy.controller.js";

const router: Router = Router();

router.get(
  "/readiness",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  getBosyReadiness,
);

router.get(
  "/queue",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  getBosyQueue,
);

router.get(
  "/previous-sections",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "CLASS_ADVISER", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  getPreviousSectionsHandler,
);

router.post(
  "/confirm-return/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "CLASS_ADVISER", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  staffIntakePhaseGuard,
  confirmReturnHandler,
);

router.post(
  "/transfer-request/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  staffIntakePhaseGuard,
  markTransferRequestHandler,
);

router.post(
  "/revoke-confirmation/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  staffIntakePhaseGuard,
  revokeConfirmedReturnHandler,
);

router.post(
  "/confirmed-transfer-out/:applicationId",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  staffIntakePhaseGuard,
  markConfirmedTransferOutHandler,
);

router.post(
  "/bulk-confirm",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  staffIntakePhaseGuard,
  bulkConfirmReturnHandler,
);

router.get(
  "/completers",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE 7 COORDINATOR", "GRADE 8 COORDINATOR", "GRADE 9 COORDINATOR", "GRADE 10 COORDINATOR"),
  getJHSCompletersHandler,
);

export default router;
