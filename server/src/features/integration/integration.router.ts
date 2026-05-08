import { Router } from "express";
import {
  integrationHealth,
  listIntegrationFaculty,
  listIntegrationLearners,
  listIntegrationSections,
  listSectionLearners,
} from "./integration.controller.js";
import {
  getEcosystemSyncStatus,
  getSyncJobProgress,
  printSectionCredentials,
  provisionTeacherAccounts,
  triggerSync,
} from "./ecosystem-sync.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { Role } from "../../generated/prisma/index.js";
import {
  listDefaultAimsContext,
  listDefaultFaculty,
  listDefaultSmartStudents,
  listIntegrationStaff,
} from "./integration.default.controller.js";
import {
  listSampleStaff,
  listSampleStudents,
  listSampleTeachers,
} from "./integration.sample.controller.js";

const router: Router = Router();

// Ecosystem Sync (Public Read-Only)
router.get("/ecosystem/status", getEcosystemSyncStatus);
router.get("/ecosystem/jobs/:jobId", getSyncJobProgress);
router.get("/ecosystem/credentials/print/:sectionId", printSectionCredentials);

// Ecosystem Sync (Protected Mutations)
router.post(
  "/ecosystem/sync",
  authenticate,
  authorize(Role.SYSTEM_ADMIN),
  triggerSync,
);

router.post(
  "/ecosystem/provision-teachers",
  authenticate,
  authorize(Role.SYSTEM_ADMIN),
  provisionTeacherAccounts,
);

// Integration feeds are public for teammate testing and ingestion.
router.get("/sample/teachers", listSampleTeachers);
router.get("/sample/staff", listSampleStaff);
router.get("/sample/students", listSampleStudents);

router.get("/health", integrationHealth);
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
