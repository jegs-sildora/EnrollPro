import { Router } from "express";
import {
  lookupLearnerByLrn,
  learnerLogin,
  learnerSetupPassword,
  getLearnerMe,
  getLearnerDashboardUnified,
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

// Authenticated learner — get own profile data (legacy)
router.get(
  "/me",
  authenticateLearner,
  getLearnerMe,
);

// Authenticated learner — get unified dashboard data
router.get(
  "/dashboard-unified",
  authenticateLearner,
  getLearnerDashboardUnified,
);

// Registrar lookup endpoint for Confirmation Slip workflow - SECURED for staff only
router.get(
  "/lookup",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  lookupLearnerByLrn,
);

export default router;
