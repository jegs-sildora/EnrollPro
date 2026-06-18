import { Router } from "express";
import {
  integrationHealth,
  getActiveSchoolYear,
  listIntegrationFaculty,
  listIntegrationLearners,
  listIntegrationSections,
  listSectionLearners,
} from "./integration.controller.js";
import {
  listDefaultAimsContext,
  listDefaultFaculty,
  listDefaultSmartStudents,
  listIntegrationStaff,
} from "./integration.default.controller.js";


const router: Router = Router();

// Integration feeds are public for teammate testing and ingestion.

router.get("/health", integrationHealth);
router.get("/school-year", getActiveSchoolYear);
router.get("/learners", listIntegrationLearners);
router.get("/students", listIntegrationLearners);
router.get("/faculty", listIntegrationFaculty);
router.get("/teachers", listIntegrationFaculty);
router.get("/staff", listIntegrationStaff);
router.get("/sections", listIntegrationSections);
router.get("/sections/:sectionId/learners", listSectionLearners);
router.get("/default/faculty", listDefaultFaculty);
router.get("/default/smart/students", listDefaultSmartStudents);
router.get("/default/aims/context", listDefaultAimsContext);

export default router;
