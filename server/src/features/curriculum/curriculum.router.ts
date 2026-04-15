import { Router } from "express";
import {
  listGradeLevels,
  createGradeLevel,
  updateGradeLevel,
  deleteGradeLevel,
  listScpConfigs,
  updateScpConfigs,
} from "./curriculum.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { updateScpProgramConfigsSchema } from "@enrollpro/shared";

const router: Router = Router();

// Grade Levels
router.get(
  "/:ayId/grade-levels",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  listGradeLevels,
);
router.post(
  "/:ayId/grade-levels",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  createGradeLevel,
);
router.put(
  "/grade-levels/:id",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  updateGradeLevel,
);
router.delete(
  "/grade-levels/:id",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  deleteGradeLevel,
);

// SCP Configs
router.get(
  "/:ayId/scp-config",
  authenticate,
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  listScpConfigs,
);
router.put(
  "/:ayId/scp-config",
  authenticate,
  authorize("SYSTEM_ADMIN"),
  validate(updateScpProgramConfigsSchema),
  updateScpConfigs,
);

export default router;
