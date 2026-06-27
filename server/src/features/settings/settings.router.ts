import { selectAccentSchema, updateIdentitySchema } from "@enrollpro/shared";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { secureUpload } from "../../lib/multer.js";
import {
  getActiveAcademicPrograms,
  getPublicSettings,
  getScpConfig,
  removeLogo,
  selectAccentColor,
  updateIdentity,
  uploadLogo,
  updatePrograms,
  updateSystemPhase,
  updateAlgorithm,
} from "./settings.controller.js";
import { updateProgramsSchema, updateAlgorithmSchema } from "@enrollpro/shared";

const router: Router = Router();

// Public
router.get("/public", getPublicSettings);
router.get("/scp-config", getScpConfig);
router.get(
  "/programs",
  authenticate,
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  getActiveAcademicPrograms,
);

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
router.patch(
  "/programs",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  validate(updateProgramsSchema),
  updatePrograms,
);

router.patch(
  "/phase",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  updateSystemPhase,
);

router.patch(
  "/algorithm",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  validate(updateAlgorithmSchema),
  updateAlgorithm,
);

export default router;
