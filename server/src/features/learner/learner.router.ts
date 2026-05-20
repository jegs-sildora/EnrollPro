import { Router } from "express";
import {
  lookupLearner,
  lookupLearnerByLrn,
  learnerConfirmReturn,
  submitTleChoices,
  getLearnerProfile,
  getLearnerAcademicHistory,
  learnerRequestTransfer,
  getOnboardingStatus,
  getTLEOptions,
} from "./learner.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { authenticateLearner } from "../../middleware/authenticate.js";
import { learnerLookupSchema } from "@enrollpro/shared";

const router: Router = Router();

// Learner portal lookup endpoint - public
router.post("/lookup", validate(learnerLookupSchema), lookupLearner);

// Registrar lookup endpoint for Confirmation Slip workflow - SECURED for staff only
router.get(
  "/lookup",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  lookupLearnerByLrn,
);

// Learner self-confirms BOSY return
router.post("/confirm-return", authenticateLearner, learnerConfirmReturn);

// Learner submits Phase 3 TLE specialization choices
router.post("/submit-tle-choices", authenticateLearner, submitTleChoices);

// Learner requests transfer out
router.post("/request-transfer", authenticateLearner, learnerRequestTransfer);

// Authenticated learner portal endpoints (JWT required, role=LEARNER)
router.get("/onboarding-status", authenticateLearner, getOnboardingStatus);
router.get("/tle-options/:gradeLevelId", authenticateLearner, getTLEOptions);
router.get("/profile", authenticateLearner, getLearnerProfile);
router.get("/academic-history", authenticateLearner, getLearnerAcademicHistory);

export default router;
