import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getStudents,
  getStudentById,
  updateStudent,
  getHealthRecords,
  addHealthRecord,
  updateHealthRecord,
  resetPortalPin,
} from "./students.controller.js";
import { validate } from "../../middleware/validate.js";
import { updateStudentSchema, healthRecordSchema } from "@enrollpro/shared";

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// Get all students with search and filters
router.get("/", authorize("REGISTRAR", "SYSTEM_ADMIN", "TEACHER"), getStudents);

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
  getHealthRecords,
);
router.post(
  "/:id/health-records",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(healthRecordSchema),
  addHealthRecord,
);
router.put(
  "/:id/health-records/:recId",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  validate(healthRecordSchema),
  updateHealthRecord,
);

// Portal PIN Reset
router.post(
  "/:id/reset-portal-pin",
  authorize("REGISTRAR", "SYSTEM_ADMIN"),
  resetPortalPin,
);

export default router;
