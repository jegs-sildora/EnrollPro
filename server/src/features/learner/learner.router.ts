import { Router } from "express";
import {
  lookupLearnerByLrn,
} from "./learner.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router: Router = Router();

// Registrar lookup endpoint for Confirmation Slip workflow - SECURED for staff only
router.get(
  "/lookup",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  lookupLearnerByLrn,
);

export default router;
