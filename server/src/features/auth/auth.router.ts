import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  login,
  me,
  changePassword,
  changeExternalDefaultPassword,
  logout,
  verifyCredentials,
} from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, authenticateFromCookies } from "../../middleware/authenticate.js";
import {
  loginSchema,
  externalCredentialVerificationSchema,
  changePasswordSchema,
  externalPasswordChangeSchema,
  companionSsoExchangeSchema,
} from "@enrollpro/shared";
import {
  companionSsoCatalog,
  exchangeCompanionSso,
  launchCompanionSso,
} from "./companion-sso.controller.js";
const router: Router = Router();

const companionSsoLaunchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "COMPANION_SSO_RATE_LIMITED",
    message: "Too many integrated-system sign-in attempts. Try again shortly.",
  },
});

const companionSsoExchangeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: "COMPANION_SSO_RATE_LIMITED",
    message: "Too many SSO exchange attempts. Try again shortly.",
  },
});

router.post("/login", validate(loginSchema), login);
router.post(
  "/verify",
  validate(externalCredentialVerificationSchema),
  verifyCredentials,
);
router.post("/logout", logout);
router.get("/me", authenticate, me);
router.get(
  "/companion-sso/catalog",
  authenticate,
  companionSsoCatalog,
);
router.post(
  "/companion-sso/:system/launch",
  companionSsoLaunchLimiter,
  authenticate,
  launchCompanionSso,
);
router.post(
  "/companion-sso/:system/exchange",
  companionSsoExchangeLimiter,
  validate(companionSsoExchangeSchema),
  exchangeCompanionSso,
);
router.patch(
  "/change-password",
  authenticateFromCookies(process.env.AUTH_COOKIE_NAME ?? "enrollpro_session"),
  validate(changePasswordSchema),
  changePassword,
);
router.patch(
  "/external/change-password",
  validate(externalPasswordChangeSchema),
  changeExternalDefaultPassword,
);

export default router;
