import { Router } from "express";
import {
  listRegions,
  listProvinces,
  listCities,
  listBarangays,
} from "./address.controller.js";

const router: Router = Router();

// Public — no auth required; needed by unauthenticated online applicants
router.get("/regions", listRegions);
router.get("/provinces/:regionCode", listProvinces);
router.get("/cities/:provinceCode", listCities);
router.get("/barangays/:cityCode", listBarangays);

export default router;
