import { Router } from "express";
import {
  lookupLearner,
  lookupLearnerByLrn,
  learnerConfirmReturn,
  getLearnerProfile,
  getLearnerAcademicHistory,
} from "./learner.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { learnerLookupSchema } from "@enrollpro/shared";

const router: Router = Router();

// Learner portal lookup endpoint - public
router.post("/lookup", validate(learnerLookupSchema), lookupLearner);

// Registrar lookup endpoint for Confirmation Slip workflow
router.get("/lookup", lookupLearnerByLrn);

// Learner self-confirms BOSY return (no auth — identified by applicationId from their session)
router.post("/confirm-return", learnerConfirmReturn);

// Authenticated learner portal endpoints (JWT required, role=LEARNER)
router.get("/profile", authenticate, getLearnerProfile);
router.get("/academic-history", authenticate, getLearnerAcademicHistory);

export default router;
