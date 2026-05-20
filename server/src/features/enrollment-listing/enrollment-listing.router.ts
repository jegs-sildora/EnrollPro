import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./enrollment-listing.controller.js";

const router: Router = Router();

router.use(authenticate, authorize("HEAD_REGISTRAR", "REGISTRAR", "SYSTEM_ADMIN", "TEACHER"));

// Pre-listing (intake log)
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.patch("/:id/status", ctrl.updateStatus);
router.delete("/:id", ctrl.remove);

// Enrolled learners for reading assessment + confirmation
router.get("/enrolled-learners", ctrl.listEnrolledLearners);
router.patch("/applications/:applicationId/reading-profile", ctrl.updateReadingProfile);
router.patch("/applications/:applicationId/confirmation-slip", ctrl.updateConfirmationSlip);

export default router;
