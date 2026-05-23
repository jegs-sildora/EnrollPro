import { Router } from "express";
import {
  login,
  me,
  changePassword,
  logout,
  logoutLearner,
  verifyCredentials,
  learnerLogin,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, authenticateFromCookies } from "../../middleware/authenticate.js";
import {
  loginSchema,
  changePasswordSchema,
} from "@enrollpro/shared";
const router: Router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/learner-login", learnerLogin);
router.post("/verify", validate(loginSchema), verifyCredentials);
router.post("/logout", logout);
router.post("/logout-learner", logoutLearner);
router.get("/me", authenticate, me);
router.patch(
  "/change-password",
  authenticateFromCookies("learner_session", process.env.AUTH_COOKIE_NAME ?? "enrollpro_session"),
  validate(changePasswordSchema),
  changePassword,
);

export default router;
