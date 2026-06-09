import { Router } from "express";
import * as geographyController from "./geography.controller.js";

const router: Router = Router();

router.get("/regions", geographyController.getRegions);
router.get("/provinces", geographyController.getProvinces);
router.get("/municipalities", geographyController.getCitiesMunicipalities);
router.get("/barangays", geographyController.getBarangays);

export { router as geographyRouter };
