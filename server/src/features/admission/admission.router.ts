import { Router, type Router as ExpressRouter } from "express";
import {
  submitApplication,
  trackApplication,
  updateExistingApplication,
  validateLrn,
  getLearnerProfile,
} from "./admission.controller.js";

const router: ExpressRouter = Router();

router.post("/", submitApplication);
router.post("/update-existing", updateExistingApplication);
router.get("/track/:trackingNumber", trackApplication);
router.get("/validate-lrn/:lrn", validateLrn);
router.get("/learner-profile/:lrn", getLearnerProfile);

export const admissionRoutes = router;
