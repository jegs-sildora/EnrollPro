import { Router } from "express";
import {
  login,
  me,
  changePassword,
  logout,
  verifyCredentials,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, authenticateFromCookies } from "../../middleware/authenticate.js";
import {
  loginSchema,
  changePasswordSchema,
} from "@enrollpro/shared";
const router: Router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/verify", validate(loginSchema), verifyCredentials);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch(
  "/change-password",
  authenticateFromCookies(process.env.AUTH_COOKIE_NAME ?? "enrollpro_session"),
  validate(changePasswordSchema),
  changePassword,
);

export default router;
