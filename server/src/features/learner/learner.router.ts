import { Router } from "express";
import {
  lookupLearnerByLrn,
  learnerLogin,
  learnerSetupPassword,
  getLearnerDashboardUnified,
  checkDuplicateLearner,
} from "./learner.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { authenticateLearner } from "../../middleware/authenticate-learner.js";
import { validate } from "../../middleware/validate.js";
import {
  learnerLoginSchema,
  learnerSetupPasswordSchema,
} from "@enrollpro/shared";

const router: Router = Router();

// Public — learner portal login (no auth required)
router.post("/auth", validate(learnerLoginSchema), learnerLogin);

// Protected — learner must be authenticated with a valid learner JWT
router.post(
  "/setup-password",
  authenticateLearner,
  validate(learnerSetupPasswordSchema),
  learnerSetupPassword,
);

// Alias for the standard change-password endpoint (DRY reuse)
router.post(
  "/change-password",
  authenticateLearner,
  validate(learnerSetupPasswordSchema),
  learnerSetupPassword,
);

// Authenticated learner — get unified dashboard data
router.get(
  "/dashboard-unified",
  authenticateLearner,
  getLearnerDashboardUnified,
);

// Registrar lookup used by staff-assisted learner enrollment.
router.get(
  "/lookup",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  lookupLearnerByLrn,
);

router.post(
  "/check-duplicate",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  checkDuplicateLearner,
);

export default router;
