import { Router } from "express";
import {
  integrationHealth,
  getActiveSchoolYear,
  getActiveTerm,
  listIntegrationFaculty,
  listIntegrationLearners,
  listIntegrationSections,
  listSectionLearners,
} from "./integration.controller.js";
import {
  listDefaultAimsContext,
  listDefaultFaculty,
  listDefaultMrfIdentities,
  listDefaultSmartStudents,
  listDefaultSmartTransferees,
  listIntegrationStaff,
} from "./integration.default.controller.js";
import { requireIntegrationApiKey } from "./integration-api-key.middleware.js";


const router: Router = Router();

// Integration feeds are protected with machine integration keys.
const requireAnyKey = requireIntegrationApiKey(
  "ATLAS_INTEGRATION_API_KEY",
  "SMART_INTEGRATION_API_KEY",
  "AIMS_INTEGRATION_API_KEY",
  "MRF_INTEGRATION_API_KEY"
);

router.get("/health", integrationHealth);
router.get("/school-year", requireAnyKey, getActiveSchoolYear);
router.get("/active-term", requireAnyKey, getActiveTerm);
router.get("/learners", requireAnyKey, listIntegrationLearners);
router.get("/students", requireAnyKey, listIntegrationLearners);
router.get("/faculty", requireAnyKey, listIntegrationFaculty);
router.get("/teachers", requireAnyKey, listIntegrationFaculty);
router.get("/staff", requireAnyKey, listIntegrationStaff);
router.get("/sections", requireAnyKey, listIntegrationSections);
router.get("/sections/:sectionId/learners", requireAnyKey, listSectionLearners);
router.get("/default/faculty", requireAnyKey, listDefaultFaculty);
router.get("/default/smart/students", requireAnyKey, listDefaultSmartStudents);
router.get("/default/smart/transferees", requireAnyKey, listDefaultSmartTransferees);
router.get("/default/aims/context", requireAnyKey, listDefaultAimsContext);
router.get(
  "/default/mrf/identities",
  requireIntegrationApiKey("MRF_INTEGRATION_API_KEY"),
  listDefaultMrfIdentities,
);

export default router;
