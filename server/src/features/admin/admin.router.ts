import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
} from "@enrollpro/shared";
import * as userCtrl from "./admin-user.controller.js";
import * as sysCtrl from "./admin-system.controller.js";
import * as historicalCorrectionCtrl from "./historical-correction.controller.js";

const router: Router = Router();

// Admin routes require SYSTEM_ADMIN role
router.use(authenticate, authorize("SYSTEM_ADMIN"));

// User Management
router.get("/users/metrics", userCtrl.metrics);
router.get("/users/roles", userCtrl.getRoles);
router.get("/users", userCtrl.index);
router.post("/users", validate(createUserSchema), userCtrl.store);
router.patch("/users/:id", validate(updateUserSchema), userCtrl.update);
router.patch("/users/:id/deactivate", userCtrl.deactivate);
router.patch("/users/:id/reactivate", userCtrl.reactivate);
router.patch(
  "/users/:id/reset-password",
  validate(adminResetPasswordSchema),
  userCtrl.resetPassword,
);
router.post("/learners/:id/reset-password", userCtrl.learnerResetPassword);

// Historical Correction Override
router.post(
  "/historical-correction/authorize",
  historicalCorrectionCtrl.authorize,
);
router.post(
  "/historical-correction/relock",
  historicalCorrectionCtrl.relock,
);

// System Health
router.get("/system/health", sysCtrl.health);
router.get("/dashboard/stats", sysCtrl.dashboardStats);

export default router;
