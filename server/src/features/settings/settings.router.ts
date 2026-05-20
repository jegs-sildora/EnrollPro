import { selectAccentSchema, updateIdentitySchema } from "@enrollpro/shared";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { secureUpload } from "../../lib/multer.js";
import {
  getPublicSettings,
  getScpConfig,
  removeLogo,
  selectAccentColor,
  updateIdentity,
  uploadLogo,
} from "./settings.controller.js";

const router: Router = Router();

// Public
router.get("/public", getPublicSettings);
router.get("/scp-config", getScpConfig);

// Protected - SYSTEM_ADMIN
router.put(
  "/identity",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  validate(updateIdentitySchema),
  updateIdentity,
);
router.post(
  "/logo",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  secureUpload.single("logo"),
  uploadLogo,
);
router.delete("/logo", authenticate, authorize("SYSTEM_ADMIN"), removeLogo);
router.put(
  "/accent",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  validate(selectAccentSchema),
  selectAccentColor,
);

export default router;
