import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { calculateTeacherWorkload } from "./services/workload-guard.service.js";
import { Prisma } from "../../generated/prisma/index.js";

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
        gradeLevel: s.gradeLevel.name,
        gradeLevelId: s.gradeLevelId,
        gradeLevelOrder: s.gradeLevel.displayOrder,
        programType: s.programType,
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
    const { gradeLevelId } = req.query;
    const schoolYearId = req.query.schoolYearId
      ? Number(req.query.schoolYearId)
      : req.schoolYearId;

    if (!schoolYearId) {
       return res.status(400).json({ message: "Active school year required." });
    }

    const where: Prisma.EnrollmentApplicationWhereInput = {
      schoolYearId,
      status: "READY_FOR_SECTIONING",
      enrollmentRecord: null, // Critical: Only students not yet assigned
    };

    if (gradeLevelId) where.gradeLevelId = Number(gradeLevelId);

    const applications = await prisma.enrollmentApplication.findMany({
      where,
      include: {
        learner: {
          select: {
            lrn: true,
            firstName: true,
            lastName: true,
            middleName: true,
            sex: true,
            previousGenAve: true,
            enrollmentRecords: {
              where: {
                schoolYearId: { not: schoolYearId },
                finalAverage: { not: null },
              },
              orderBy: { schoolYearId: "desc" },
              take: 1,
              select: { finalAverage: true },
            },
          },
        },
        gradeLevel: { select: { name: true, displayOrder: true } },
        previousSchool: { select: { generalAverage: true } },
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
      genAve:
        app.learner.enrollmentRecords?.[0]?.finalAverage ??
        app.previousSchool?.generalAverage ??
        app.learner.previousGenAve ??
        null,
      gradeLevel: app.gradeLevel.name,
      gradeLevelId: app.gradeLevelId,
      duplicateFlag: app.duplicateFlag,
      programType: app.assignedProgram ?? app.applicantType,
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

    // 1. Fetch Section Details and System Setting
    const [section, setting] = await Promise.all([
      prisma.section.findUnique({
        where: { id: sectionId },
        include: { 
          enrollmentRecords: { select: { id: true } },
          gradeLevel: { select: { displayOrder: true } }
        },
      }),
      prisma.schoolSetting.findFirst({ select: { systemPhase: true } })
    ]);

    if (!section) return res.status(404).json({ message: "Section not found." });

    // 2. Capacity Guard (Rule: Hard cap 50 students)
    const currentCount = section.enrollmentRecords.length;
    const requestedCount = applicationIds.length;
    if (currentCount + requestedCount > section.maxCapacity) {
      return res.status(409).json({ 
        message: `Section ${section.name} has ${section.maxCapacity - currentCount} available seat(s), but ${requestedCount} learner(s) were selected.`,
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
          message: `Application ${app.id} is not ready for section assignment.`,
        });
      }

      if (app.schoolYearId !== section.schoolYearId) {
        return res.status(422).json({
          message: "The learner and section belong to different school years.",
        });
      }

      // Grade Level Check
      if (app.gradeLevelId !== section.gradeLevelId) {
         return res.status(422).json({ message: "Grade Level Mismatch: Student grade level does not match section grade level." });
      }

      const effectiveProgram = app.assignedProgram ?? app.applicantType;
      if (effectiveProgram !== section.programType) {
        return res.status(422).json({
          message:
            `${app.learner.firstName} ${app.learner.lastName} belongs to ${effectiveProgram}, not ${section.programType}.`,
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
            dateSectioned: new Date(),
            isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
          }
        });

        // Finalize Application Status
        await tx.enrollmentApplication.update({
          where: { id: app.id },
          data: { status: "OFFICIALLY_ENROLLED" }
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


