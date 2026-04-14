import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { earlyRegistrationSubmitSchema } from "@enrollpro/shared";
import * as ctrl from "./early-reg.controller.js";
import rateLimit from "express-rate-limit";

const router: Router = Router();

// Rate-limit public submission (15 per 15-min window per IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { message: "Too many submissions. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public ──
router.get("/check-lrn/:lrn", ctrl.checkLrn);

router.post(
  "/",
  submitLimiter,
  validate(earlyRegistrationSubmitSchema),
  ctrl.store,
);

// ── Registrar / Admin ──
router.post(
  "/f2f",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(earlyRegistrationSubmitSchema),
  ctrl.storeF2F,
);

router.get(
  "/",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.index,
);

router.get(
  "/:id",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  ctrl.show,
);

router.patch(
  "/:id/verify",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  ctrl.verify,
);

export default router;
