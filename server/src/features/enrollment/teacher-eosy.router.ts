import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./teacher-eosy.controller.js";

const router: Router = Router();

// Only CLASS_ADVISER or TEACHER roles can access this
router.use(authenticate, authorize("CLASS_ADVISER", "TEACHER", "HEAD_REGISTRAR", "SYSTEM_ADMIN"));

router.get("/advisory", ctrl.getTeacherAdvisory);
router.post("/advisory/submit", ctrl.submitTeacherAdvisory);

export default router;
