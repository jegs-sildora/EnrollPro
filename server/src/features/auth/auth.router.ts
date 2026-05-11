import { Router } from "express";
import {
  login,
  me,
  changePassword,
  logout,
  verifyCredentials,
  learnerLogin,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  loginSchema,
  changePasswordSchema,
} from "@enrollpro/shared";
const router: Router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/learner-login", learnerLogin);
router.post("/verify", validate(loginSchema), verifyCredentials);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
