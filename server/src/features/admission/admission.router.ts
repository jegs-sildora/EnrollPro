import { Router, type Router as ExpressRouter } from "express";
import { submitApplication, updateExistingApplication } from "./admission.controller.js";

const router: ExpressRouter = Router();

router.post("/", submitApplication);
router.post("/update-existing", updateExistingApplication);

export const admissionRoutes = router;
