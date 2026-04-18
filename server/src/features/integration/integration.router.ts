import { Router } from "express";
import { authenticateIntegration } from "../../middleware/authenticateIntegration.js";
import {
  integrationHealth,
  listIntegrationFaculty,
  listIntegrationLearners,
  listIntegrationSections,
  listSectionLearners,
} from "./integration.controller.js";
import {
  listDefaultAimsContext,
  listDefaultAtlasFaculty,
  listDefaultSmartStudents,
  listIntegrationStaff,
} from "./integration.default.controller.js";
import {
  listSampleStaff,
  listSampleStudents,
  listSampleTeachers,
} from "./integration.sample.controller.js";

const router: Router = Router();

// Public sample feeds for non-production teammate testing.
router.get("/sample/teachers", listSampleTeachers);
router.get("/sample/staff", listSampleStaff);
router.get("/sample/students", listSampleStudents);

router.use(authenticateIntegration);

router.get("/health", integrationHealth);
router.get("/learners", listIntegrationLearners);
router.get("/students", listIntegrationLearners);
router.get("/faculty", listIntegrationFaculty);
router.get("/teachers", listIntegrationFaculty);
router.get("/staff", listIntegrationStaff);
router.get("/sections", listIntegrationSections);
router.get("/sections/:sectionId/learners", listSectionLearners);
router.get("/default/atlas/faculty", listDefaultAtlasFaculty);
router.get("/default/smart/students", listDefaultSmartStudents);
router.get("/default/aims/context", listDefaultAimsContext);

export default router;
