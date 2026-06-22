import { Router, type Router as ExpressRouter } from "express";
import { submitApplication, updateExistingApplication, lookupLrn, specialEnrollment } from "./admission.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router: ExpressRouter = Router();

router.post("/", submitApplication);
router.post("/update-existing", updateExistingApplication);

router.get(
  "/lookup-lrn/:lrn",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  lookupLrn
);

router.post(
  "/special-enrollment",
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN"),
  specialEnrollment
);

export const admissionRoutes = router;
