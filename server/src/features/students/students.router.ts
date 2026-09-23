import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getStudents,
  getStudentsSummary,
  getStudentById,
  getStudentRecordHistory,
} from "./controllers/students.query.controller.js";
import {
  updateStudent,
  resetPortalPin,
  clearDeficiency,
  verifyPsa,
  updateLrn,
  markDropout,
  markTransferredOut,
  reactivateLearner,
  togglePortalAccess,
  resetPortalPassword,
} from "./controllers/students.profile.controller.js";
import {
  getHealthRecords as getStudentHealthRecords,
  addHealthRecord as createStudentHealthRecord,
  updateHealthRecord as updateStudentHealthRecord,
} from "./controllers/students.health.controller.js";
import { getStudentBackSubjects } from "./controllers/students.back-subjects.controller.js";
import { validate } from "../../middleware/validate.js";
import { updateStudentSchema, healthRecordSchema } from "@enrollpro/shared";
import { secureUpload } from "../../lib/multer.js";

import { prisma } from "../../lib/prisma.js";

const router: Router = Router();

router.param("id", async (req, res, next, id) => {
  if (id && id.length === 12 && /^\d+$/.test(id)) {
    try {
      const learner = await prisma.learner.findUnique({
        where: { lrn: id },
        select: { id: true }
      });
      if (learner) {
        req.params.id = learner.id.toString();
      }
    } catch (e) {
      return next(e);
    }
  }
  next();
});

// All routes require authentication
router.use(authenticate);

// Get all students with search and filters
router.get(
  "/",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "GRADE_LEVEL_COORDINATOR"),
  getStudents,
);

// Summary cards for enrolled learner reporting (school-year scoped)
router.get(
  "/summary",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "GRADE_LEVEL_COORDINATOR"),
  getStudentsSummary,
);

// Get single student by ID
router.get(
  "/:id",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "GRADE_LEVEL_COORDINATOR"),
  getStudentById,
);

router.get(
  "/:id/record-history",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  getStudentRecordHistory,
);

router.get(
  "/:id/back-subjects",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "GRADE_LEVEL_COORDINATOR"),
  getStudentBackSubjects,
);

// Update student information
router.put(
  "/:id",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  validate(updateStudentSchema),
  updateStudent,
);

// Health Records
router.get(
  "/:id/health-records",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "TEACHER", "GRADE_LEVEL_COORDINATOR"),
  getStudentHealthRecords,
);
router.post(
  "/:id/health-records",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  validate(healthRecordSchema),
  createStudentHealthRecord,
);
router.put(
  "/:id/health-records/:recId",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  validate(healthRecordSchema),
  updateStudentHealthRecord,
);

// Portal PIN Reset
router.post(
  "/:id/reset-portal-pin",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  resetPortalPin,
);

// Portal Access Toggle
router.patch(
  "/:id/portal-access",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  togglePortalAccess,
);

// Portal Password Reset
router.post(
  "/:id/reset-password",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  resetPortalPassword,
);

// Clear Deficiency
router.post(
  "/:id/clear-deficiency",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  clearDeficiency,
);

// Verify PSA
router.post(
  "/:id/verify-psa",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  verifyPsa,
);

// Lifecycle & LRN Management
router.post(
  "/:id/lifecycle/dropout",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  secureUpload.array("evidence", 3),
  markDropout,
);

router.post(
  "/:id/lifecycle/transfer-out",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  secureUpload.array("evidence", 3),
  markTransferredOut,
);

router.patch(
  "/:id/lifecycle/reactivate",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  reactivateLearner,
);

router.post(
  "/:id/lrn",
  authorize("HEAD_REGISTRAR", "SYSTEM_ADMIN", "GRADE_LEVEL_COORDINATOR"),
  updateLrn,
);

export default router;
