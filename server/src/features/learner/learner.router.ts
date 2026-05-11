import { Router } from "express";
import {
  lookupLearner,
  lookupLearnerByLrn,
  learnerConfirmReturn,
} from "./learner.controller.js";
import { validate } from "../../middleware/validate.js";
import { learnerLookupSchema } from "@enrollpro/shared";

const router: Router = Router();

// Learner portal lookup endpoint - public
router.post("/lookup", validate(learnerLookupSchema), lookupLearner);

// Registrar lookup endpoint for Confirmation Slip workflow
router.get("/lookup", lookupLearnerByLrn);

// Learner self-confirms BOSY return (no auth — identified by applicationId from their session)
router.post("/confirm-return", learnerConfirmReturn);

export default router;
