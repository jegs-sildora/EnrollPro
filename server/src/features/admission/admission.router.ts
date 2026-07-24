import { Router, type Router as ExpressRouter } from "express";
import {
  submitApplication,
  trackApplication,
  updateExistingApplication,
} from "./admission.controller.js";

const router: ExpressRouter = Router();

router.post("/", submitApplication);
router.post("/update-existing", updateExistingApplication);
router.get("/track/:trackingNumber", trackApplication);

export const admissionRoutes = router;
