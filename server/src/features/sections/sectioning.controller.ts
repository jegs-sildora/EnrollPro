import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { calculateTeacherWorkload } from "./services/workload-guard.service.js";

/**
 * TLE Sectioning Workspace: Returns sections with current M/F counts and TLE tracks.
 * GET /api/sectioning/sections-summary
 */
export async function getSectionsSummary(req: Request, res: Response) {
  try {
    const schoolYearId = req.query.schoolYearId
      ? Number(req.query.schoolYearId)
      : req.schoolYearId;

    if (!schoolYearId) {
      return res.status(400).json({ message: "Active school year not found." });
    }

    const sections = await prisma.section.findMany({
      where: { schoolYearId },
      include: {
        gradeLevel: { select: { name: true, displayOrder: true } },
        tleProgram: { select: { name: true } },
        advisers: {
          where: { status: "ACTIVE" },
          include: { teacher: { select: { firstName: true, lastName: true } } },
        },
        enrollmentRecords: {
          include: { learner: { select: { sex: true } } },
        },
      },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { name: "asc" }
      ],
    });

    const summary = sections.map((s) => {
      const boys = s.enrollmentRecords.filter((r) => r.learner.sex === "MALE").length;
      const girls = s.enrollmentRecords.filter((r) => r.learner.sex === "FEMALE").length;

      return {
        id: s.id,
        name: s.name,
        gradeLevel: { id: s.gradeLevelId, name: s.gradeLevel.name },
        gradeLevelOrder: s.gradeLevel.displayOrder,
        tleProgram: s.tleProgramId ? { id: s.tleProgramId, name: s.tleProgram?.name ?? "" } : null,
        tleProgramId: s.tleProgramId,
        maxCapacity: s.maxCapacity,
        currentCount: s.enrollmentRecords.length,
        boys,
        girls,
        adviser: s.advisers[0]?.teacher 
          ? `${s.advisers[0].teacher.lastName}, ${s.advisers[0].teacher.firstName}`
          : "No Adviser",
      };
    });

    return res.json(summary);
  } catch (error) {
    console.error("getSectionsSummary failed:", error);
    return res.status(500).json({ message: "Error fetching sections summary." });
  }
}

/**
 * TLE Sectioning Workspace: Returns students READY_FOR_TLE_SECTIONING who have no section assignment.
 * GET /api/sectioning/pool
 */
export async function getSectioningPool(req: Request, res: Response) {
  try {
    const { gradeLevelId, tleProgramId } = req.query;
    const schoolYearId = req.query.schoolYearId
      ? Number(req.query.schoolYearId)
      : req.schoolYearId;

    if (!schoolYearId) {
       return res.status(400).json({ message: "Active school year required." });
    }

    const where: any = {
      schoolYearId,
      tleStatus: "READY_FOR_TLE_SECTIONING",
      applicantType: "REGULAR", // SCP Guard: exclude STE, SPAS, SPS, SPIJ, SPFL, SPTVE
      enrollmentRecord: null, // Critical: Only students not yet assigned
    };

    if (gradeLevelId) where.gradeLevelId = Number(gradeLevelId);
    if (tleProgramId) where.tleProgramId = Number(tleProgramId);

    const applications = await prisma.enrollmentApplication.findMany({
      where,
      include: {
        learner: { select: { lrn: true, firstName: true, lastName: true, middleName: true, sex: true, previousGenAve: true } },
        gradeLevel: { select: { name: true, displayOrder: true } },
        tleProgram: { select: { name: true } },
      },
      orderBy: { learner: { lastName: "asc" } },
    });

    const pool = applications.map((app) => ({
      applicationId: app.id,
      lrn: app.learner.lrn,
      firstName: app.learner.firstName,
      lastName: app.learner.lastName,
      middleName: app.learner.middleName,
      sex: app.learner.sex,
      genAve: app.learner.previousGenAve,
      gradeLevel: app.gradeLevel.name,
      gradeLevelId: app.gradeLevelId,
      tleProgram: app.tleProgram?.name ?? null,
      tleProgramId: app.tleProgramId,
    }));

    return res.json(pool);
  } catch (error) {
    console.error("getSectioningPool failed:", error);
    return res.status(500).json({ message: "Error fetching sectioning pool." });
  }
}

/**
 * TLE Sectioning Workspace: Bulk Assignment with Track-Lock and Capacity Guards.
 * POST /api/sectioning/assign-bulk
 */
export async function assignBulk(req: Request, res: Response) {
  try {
    const { sectionId, applicationIds } = req.body as {
      sectionId: number;
      applicationIds: number[];
    };

    if (!sectionId || !applicationIds || !applicationIds.length) {
      return res.status(400).json({ message: "sectionId and applicationIds[] are required." });
    }

    const userId = req.user!.userId; // Authenticated user (Registrar)
    const schoolYearId = req.schoolYearId;

    // 1. Fetch Section Details
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { 
        enrollmentRecords: { select: { id: true } },
        gradeLevel: { select: { displayOrder: true } }
      },
    });

    if (!section) return res.status(404).json({ message: "Section not found." });

    // 2. Capacity Guard (Rule: Hard cap 50 students)
    const currentCount = section.enrollmentRecords.length;
    const requestedCount = applicationIds.length;
    const MAX_LIMIT = 50;

    if (currentCount + requestedCount > MAX_LIMIT) {
      return res.status(409).json({ 
        message: `Capacity Breach! Section '${section.name}' already has ${currentCount} students. Adding ${requestedCount} more exceeds the hard limit of ${MAX_LIMIT}.` 
      });
    }

    // 3. Fetch Applications for Validation
    const apps = await prisma.enrollmentApplication.findMany({
      where: { id: { in: applicationIds } },
      include: { 
        learner: { select: { firstName: true, lastName: true } },
        enrollmentRecord: { select: { id: true } }
      }
    });

    if (apps.length !== applicationIds.length) {
      return res.status(400).json({ message: "One or more applications not found." });
    }

    // 4. Track-Lock & Grade Level Guard (Rule 1 & 2)
    for (const app of apps) {
      // Avoid double assignment
      if (app.enrollmentRecord) {
        return res.status(409).json({ message: `Student ${app.learner.firstName} ${app.learner.lastName} is already assigned to a section.` });
      }

      // Stage Gate: only section learners cleared by Stage 2
      if (app.status !== "READY_FOR_SECTIONING") {
        return res.status(409).json({
          message: `Application ${app.id} is not READY_FOR_SECTIONING.`,
        });
      }

      // Grade Level Check
      if (app.gradeLevelId !== section.gradeLevelId) {
         return res.status(422).json({ message: "Grade Level Mismatch: Student grade level does not match section grade level." });
      }

      // TLE Track Lock (Grades 9 & 10)
      const isSpecGrade = section.gradeLevel.displayOrder === 9 || section.gradeLevel.displayOrder === 10;
      if (isSpecGrade && app.tleStatus !== "READY_FOR_TLE_SECTIONING") {
        return res.status(409).json({
          message: `Application ${app.id} is not READY_FOR_TLE_SECTIONING.`,
        });
      }
      if (isSpecGrade && !app.tleProgramId) {
        return res.status(422).json({
          message: `TLE Conflict: Student ${app.learner.firstName} ${app.learner.lastName} has no specialization track and cannot be sectioned.`
        });
      }
      if (isSpecGrade && section.tleProgramId !== app.tleProgramId) {
        return res.status(422).json({ 
          message: `TLE Conflict: Student ${app.learner.firstName} ${app.learner.lastName} cannot be assigned to '${section.name}' because their specialization track does not match the section's TLE requirement.` 
        });
      }
    }

    // 5. Atomic Transaction
    const results = await prisma.$transaction(async (tx) => {
      const records = [];
      for (const app of apps) {
        // Create Enrollment Record
        const record = await tx.enrollmentRecord.create({
          data: {
            enrollmentApplicationId: app.id,
            sectionId: section.id,
            learnerId: app.learnerId,
            schoolYearId: app.schoolYearId,
            enrolledById: userId,
            tleProgramId: app.tleProgramId,
            tleProgramChoice2Id: app.tleProgramChoice2Id,
            dateSectioned: new Date(),
          }
        });

        // Finalize Application Status
        await tx.enrollmentApplication.update({
          where: { id: app.id },
          data: {
            status: "OFFICIALLY_ENROLLED",
            tleStatus: "SECTIONED_FOR_TLE",
          }
        });

        records.push(record);
      }
      return records;
    });

    // 6. Audit Logging
    await auditLog({
      userId,
      actionType: "BULK_SECTION_ASSIGNMENT",
      description: `Bulk sectioned ${applicationIds.length} students into Section: ${section.name}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    return res.json({ 
      success: true, 
      message: `Successfully assigned ${applicationIds.length} students to ${section.name}.`,
      count: results.length 
    });

  } catch (error) {
    console.error("assignBulk failed:", error);
    return res.status(500).json({ message: "Internal server error during bulk sectioning." });
  }
}

/**
 * TLE Sectioning Endpoint: Zero-trust bulk assignment with atomic transaction.
 * Validates: Capacity, Track-lock (tleProgramId match), tleStatus = READY_FOR_TLE_SECTIONING.
 * POST /api/sectioning/tle/assign
 * Request: { sectionId: number, applicationIds: number[] }
 */
export async function tleSectioningAssign(req: Request, res: Response) {
  try {
    const { sectionId, applicationIds } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!sectionId || !applicationIds || !Array.isArray(applicationIds)) {
      return res.status(400).json({ message: "Missing or invalid sectionId or applicationIds." });
    }

    // 1. Fetch section with current TLE telemetry (use TLE relation for capacity)
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        enrollmentRecordsTle: { select: { id: true } },
        gradeLevel: true,
        tleProgram: true,
      },
    });

    if (!section) {
      return res.status(400).json({ message: "Section not found." });
    }

    // 2. Capacity verification using TLE-specific count
    const currentTleCount = section.enrollmentRecordsTle.length;
    const incomingCount = applicationIds.length;
    const maxCapacity = section.maxCapacity || 50;

    if (currentTleCount + incomingCount > maxCapacity) {
      return res.status(400).json({
        message: `Capacity exceeded. Section has ${currentTleCount}/${maxCapacity}. Cannot add ${incomingCount} more.`,
      });
    }

    // 3. Fetch all applications and validate
    const applications = await prisma.enrollmentApplication.findMany({
      where: { id: { in: applicationIds } },
    });

    if (applications.length !== applicationIds.length) {
      return res.status(400).json({ message: "One or more application IDs not found." });
    }

    // 4. Per-application validation loop
    for (const app of applications) {
      // 4a. Check tleStatus readiness
      if (app.tleStatus !== "READY_FOR_TLE_SECTIONING") {
        return res.status(409).json({
          message: `Application ${app.id} is not ready for TLE sectioning (tleStatus: ${app.tleStatus}).`,
        });
      }

      // 4b. STRICT TRACK-LOCK: Ensure tleProgramId matches section's tleProgramId
      if (app.tleProgramId !== section.tleProgramId) {
        return res.status(422).json({
          message: `Application ${app.id} TLE program (${app.tleProgramId}) does not match section program (${section.tleProgramId}). Track-lock violation.`,
          errorCode: "TRACK_LOCK_VIOLATION",
        });
      }
    }

    // 5. Pre-fetch existing enrollment records for all applications
    const existingRecords = await prisma.enrollmentRecord.findMany({
      where: { enrollmentApplicationId: { in: applicationIds } },
      select: { id: true, enrollmentApplicationId: true },
    });
    const existingMap = new Map(existingRecords.map((r) => [r.enrollmentApplicationId, r.id]));

    // 6. Atomic transaction: Update tleStatus + upsert tleSectionId on enrollment records
    await prisma.$transaction(async (tx) => {
      // 6a. Update all applications' tleStatus to SECTIONED_FOR_TLE
      await tx.enrollmentApplication.updateMany({
        where: { id: { in: applicationIds } },
        data: {
          tleStatus: "SECTIONED_FOR_TLE",
          status: "OFFICIALLY_ENROLLED",
          updatedAt: new Date(),
        },
      });

      // 6b. Update existing enrollment record's tleSectionId (students must already have a homeroom record)
      for (const appId of applicationIds) {
        const existingRecordId = existingMap.get(appId);
        if (existingRecordId) {
          await tx.enrollmentRecord.update({
            where: { id: existingRecordId },
            data: { tleSectionId: sectionId },
          });
        }
        // If no record exists, skip — TLE sectioning requires a prior homeroom assignment
      }
    });

    // 7. Audit Logging
    await auditLog({
      userId,
      actionType: "REGISTRAR_TLE_ASSIGNMENT",
      description: `TLE sectioned ${applicationIds.length} students into Section: ${section.name}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    return res.json({
      success: true,
      message: `Successfully TLE-assigned ${applicationIds.length} students to ${section.name}.`,
      count: applicationIds.length,
      sectionId,
    });

  } catch (error) {
    console.error("tleSectioningAssign failed:", error);
    return res.status(500).json({ message: "Internal server error during TLE assignment." });
  }
}
