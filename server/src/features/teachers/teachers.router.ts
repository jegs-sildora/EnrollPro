import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as teachersCtrl from "./teachers.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  teacherSchema,
  updateTeacherSchema,
  teacherDesignationSchema,
  deactivateTeacherSchema,
  updateServiceStatusSchema,
} from "@enrollpro/shared";

const router: Router = Router();

// All teacher routes require HEAD_REGISTRAR or SYSTEM_ADMIN role
router.use(authenticate, authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"));

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
router.patch("/:id", validate(updateTeacherSchema), teachersCtrl.update);
router.patch(
  "/:id/deactivate",
  validate(deactivateTeacherSchema),
  teachersCtrl.deactivate,
);
router.patch("/:id/reactivate", teachersCtrl.reactivate);
router.patch(
  "/:id/service-status",
  validate(updateServiceStatusSchema),
  teachersCtrl.updateServiceStatus,
);

export default router;
