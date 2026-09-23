import { Router, type Router as ExpressRouter } from "express";
import {
  submitAdmission,
  submitEnrollment,
  trackApplication,
  updateExistingApplication,
  validateLrn,
  getLearnerProfile,
} from "./admission.controller.js";

const router: ExpressRouter = Router();

router.post("/admissions", submitAdmission);
router.post("/enrollments", submitEnrollment);
router.put("/update-existing", updateExistingApplication);
router.get("/track/:trackingNumber", trackApplication);
router.get("/validate-lrn/:lrn", validateLrn);
router.get("/learner-profile/:lrn", getLearnerProfile);

export const admissionRoutes = router;
