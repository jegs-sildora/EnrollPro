import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { getRemedialPending, resolveRemedial } from "./remedial.controller.js";

const router: Router = Router();

router.get(
  "/pending",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  getRemedialPending,
);

router.patch(
  "/:learnerId/resolve",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"),
  resolveRemedial,
);

export default router;
