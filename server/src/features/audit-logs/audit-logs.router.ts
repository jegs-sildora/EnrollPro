import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as ctrl from "./audit-logs.controller.js";

const router: Router = Router();

router.get("/me", authenticate, ctrl.mine);
router.get("/me/filters", authenticate, ctrl.getMyFilters);
router.get("/", authenticate, authorize("SYSTEM_ADMIN"), ctrl.index);
router.get("/filters", authenticate, authorize("SYSTEM_ADMIN"), ctrl.getFilters);
router.get("/export", authenticate, authorize("SYSTEM_ADMIN"), ctrl.exportCsv);

router.post("/atlas-override", authenticate, authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN"), ctrl.atlasOverride);

export default router;
