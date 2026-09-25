import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getRolloverReadiness,
  getPublicConfig,
  resetSystemDateOverride,
  updateSystemDateOverride,
} from "./system.controller.js";

const systemRoutes: ExpressRouter = Router();

// Public — no auth required; used by the learner portal login page for dynamic branding
systemRoutes.get("/public-config", getPublicConfig);

systemRoutes.put(
  "/date-override",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  updateSystemDateOverride,
);

systemRoutes.delete(
  "/date-override",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  resetSystemDateOverride,
);

// Get Phase-Aware Rollover Readiness Status
systemRoutes.get(
  "/rollover-readiness",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  getRolloverReadiness,
);

export default systemRoutes;
