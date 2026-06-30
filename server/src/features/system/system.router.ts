import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { executeSystemRollover, getRolloverReadiness, getPublicConfig } from "./system.controller.js";

const systemRoutes: ExpressRouter = Router();

// Public — no auth required; used by the learner portal login page for dynamic branding
systemRoutes.get("/public-config", getPublicConfig);

// Get Phase-Aware Rollover Readiness Status
systemRoutes.get(
  "/rollover-readiness",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  getRolloverReadiness,
);

// Only SYSTEM_ADMIN should be able to execute EOSY finalization
systemRoutes.post(
  "/finalize-eosy",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  executeSystemRollover,
);

export default systemRoutes;
