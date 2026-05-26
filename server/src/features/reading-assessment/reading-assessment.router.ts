import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getReadingAssessmentQueue,
  getAdviserQueue,
  getContinuingQueue,
  recordReadingLevel,
} from "./reading-assessment.controller.js";

const router: Router = Router();

// Accessible to TEACHER as well as all registrar/admin roles
router.use(
  authenticate,
  authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
);

router.get("/queue", getReadingAssessmentQueue);
router.get("/adviser-queue", getAdviserQueue);
router.get("/continuing-queue", getContinuingQueue);
router.put("/:applicationId", recordReadingLevel);

export default router;
