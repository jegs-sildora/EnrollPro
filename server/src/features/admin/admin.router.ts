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

const router: Router = Router();

// Routes available to all authenticated users
router.get("/system/status", authenticate, sysCtrl.getSystemStatus);

// All other admin routes require SYSTEM_ADMIN role
router.use(authenticate, authorize("SYSTEM_ADMIN"));

// System Lifecycle
router.post("/system/lock-bosy", sysCtrl.lockBosy);
router.post("/system/unlock-bosy", sysCtrl.unlockBosy);

// User Management
router.get("/users/metrics", userCtrl.metrics);
router.get("/users", userCtrl.index);
router.post("/users", validate(createUserSchema), userCtrl.store);
router.put("/users/:id", validate(updateUserSchema), userCtrl.update);
router.patch("/users/:id/deactivate", userCtrl.deactivate);
router.patch("/users/:id/reactivate", userCtrl.reactivate);
router.patch(
  "/users/:id/reset-password",
  validate(adminResetPasswordSchema),
  userCtrl.resetPassword,
);

// System Health
router.get("/system/health", sysCtrl.health);
router.get("/dashboard/stats", sysCtrl.dashboardStats);

export default router;
