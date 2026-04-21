import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getStudents,
  getStudentsSummary,
  getStudentById,
} from "./controllers/students.query.controller.js";
import {
  updateStudent,
  resetPortalPin,
} from "./controllers/students.profile.controller.js";
import {
  getHealthRecords as getStudentHealthRecords,
  addHealthRecord as createStudentHealthRecord,
  updateHealthRecord as updateStudentHealthRecord,
} from "./controllers/students.health.controller.js";
import { validate } from "../../middleware/validate.js";
import { updateStudentSchema, healthRecordSchema } from "@enrollpro/shared";

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// Get all students with search and filters
router.get("/", authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"), getStudents);

// Summary cards for enrolled learner reporting (school-year scoped)
router.get(
  "/summary",
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  getStudentsSummary,
);

// Get single student by ID
router.get(
  "/:id",
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  getStudentById,
);

// Update student information
router.put(
  "/:id",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(updateStudentSchema),
  updateStudent,
);

// Health Records
router.get(
  "/:id/health-records",
  authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"),
  getStudentHealthRecords,
);
router.post(
  "/:id/health-records",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(healthRecordSchema),
  createStudentHealthRecord,
);
router.put(
  "/:id/health-records/:recId",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(healthRecordSchema),
  updateStudentHealthRecord,
);

// Portal PIN Reset
router.post(
  "/:id/reset-portal-pin",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  resetPortalPin,
);

export default router;
