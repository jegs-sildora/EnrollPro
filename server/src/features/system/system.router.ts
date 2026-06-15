import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { executeSystemRollover, getRolloverReadiness } from "./system.controller";

const systemRoutes: ExpressRouter = Router();

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
