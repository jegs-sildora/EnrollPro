import { Router } from "express";
import {
  login,
  me,
  changePassword,
  logout,
  verifyCredentials,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  loginSchema,
  changePasswordSchema,
} from "@enrollpro/shared";
import { rateLimit } from "express-rate-limit";

const router: Router = Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    code: "TOO_MANY_LOGIN_ATTEMPTS",
    message: "Too many login attempts. Please try again after a minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/verify", loginLimiter, validate(loginSchema), verifyCredentials);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
