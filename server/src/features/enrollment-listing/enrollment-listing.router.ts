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

// Intake pipeline queues
router.get("/reading-queue", ctrl.getReadingQueue);
router.get("/confirmation-queue", ctrl.getConfirmationQueue);
router.patch("/:id/assess", ctrl.assessListing);
router.patch("/applications/:applicationId/intake-assess", ctrl.assessApplicationForIntake);
router.patch("/:id/intake-confirm", ctrl.confirmListing);

// Enrolled learners for reading assessment + confirmation (legacy)
router.get("/enrolled-learners", ctrl.listEnrolledLearners);
router.patch("/applications/:applicationId/reading-profile", ctrl.updateReadingProfile);
router.patch("/applications/:applicationId/confirmation-slip", ctrl.updateConfirmationSlip);
router.patch("/applications/:applicationId/officialize", ctrl.officializeApplication);

export default router;
