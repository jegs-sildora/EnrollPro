import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as teachersCtrl from "./teachers.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  teacherSchema,
  updateTeacherSchema,
  teacherDesignationSchema,
} from "@enrollpro/shared";

const router: Router = Router();

// All teacher routes require SYSTEM_ADMIN role
router.use(authenticate, authorize("SYSTEM_ADMIN"));

router.get("/", teachersCtrl.index);
router.get("/:id/designation", teachersCtrl.showDesignation);
router.post(
  "/:id/designation/validate",
  validate(teacherDesignationSchema),
  teachersCtrl.validateDesignation,
);
router.put(
  "/:id/designation",
  validate(teacherDesignationSchema),
  teachersCtrl.upsertDesignation,
);
router.get("/:id", teachersCtrl.show);
router.post("/", validate(teacherSchema), teachersCtrl.store);
router.put("/:id", validate(updateTeacherSchema), teachersCtrl.update);
router.patch("/:id/deactivate", teachersCtrl.deactivate);
router.patch("/:id/reactivate", teachersCtrl.reactivate);

export default router;
