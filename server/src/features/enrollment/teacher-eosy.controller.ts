import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { EosyStatus } from "../../generated/prisma/index.js";

/**
 * GET /api/teacher-eosy/advisory
 * Fetches the active advisory section for the logged-in teacher (by user ID)
 * and its enrolled learners.
 */
export async function getTeacherAdvisory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user!.userId;
    const schoolYearId = req.schoolYearId!;

    // Find the teacher profile associated with this user
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new AppError(404, "Teacher profile not found for this user.");
    }

    // Find their active advisory section for the current school year
    const sectionAdviser = await prisma.sectionAdviser.findFirst({
      where: {
        teacherId: teacher.id,
        status: "ACTIVE",
        section: {
          schoolYearId,
        },
      },
      include: {
        section: {
          include: {
            gradeLevel: true,
          },
        },
      },
    });

    if (!sectionAdviser) {
      return res.json({ section: null, records: [] });
    }

    const sectionId = sectionAdviser.sectionId;

    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      include: {
        enrollmentApplication: {
          include: {
            learner: true,
          },
        },
      },
      orderBy: [
        { enrollmentApplication: { learner: { sex: "asc" } } },
        { enrollmentApplication: { learner: { lastName: "asc" } } },
        { enrollmentApplication: { learner: { firstName: "asc" } } },
      ],
    });

    const mappedRecords = records.map((record) => ({
      ...record,
      finalAverage:
        record.finalAverage !== null && record.finalAverage !== undefined
          ? parseFloat(String(record.finalAverage))
          : null,
    }));

    res.json({
      section: sectionAdviser.section,
      records: mappedRecords,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/teacher-eosy/advisory/submit
 * Submits grades and statuses, and finalizes the section.
 */
export async function submitTeacherAdvisory(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user!.userId;
    const schoolYearId = req.schoolYearId!;
    const { updates } = req.body; // Array of { recordId, eosyStatus, finalAverage }

    if (!Array.isArray(updates)) {
      throw new AppError(400, "Updates array is required.");
    }

    for (const update of updates) {
      if (update.finalAverage !== undefined && update.finalAverage !== null) {
        const genAve = Number(update.finalAverage);
        if (!Number.isInteger(genAve) || genAve < 60 || genAve > 100) {
          throw new AppError(400, `Invalid general average: ${update.finalAverage}. Must be an integer between 60 and 100.`);
        }
      }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new AppError(404, "Teacher profile not found.");
    }

    const sectionAdviser = await prisma.sectionAdviser.findFirst({
      where: {
        teacherId: teacher.id,
        status: "ACTIVE",
        section: {
          schoolYearId,
        },
      },
      include: {
        section: {
          include: { gradeLevel: true },
        },
      },
    });

    if (!sectionAdviser) {
      throw new AppError(404, "Active advisory section not found for this teacher.");
    }

    const section = sectionAdviser.section;

    // Ensure the school year is not totally locked globally
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
    });
    if (schoolYear?.isEosyFinalized) {
      throw new AppError(422, "Cannot submit. School year EOSY is globally finalized.");
    }

    if (section.isEosyFinalized) {
      throw new AppError(403, "Forbidden: Cannot submit. Your section is already locked and finalized.");
    }

    // Process updates in transaction
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const record = await tx.enrollmentRecord.findFirst({
          where: {
            id: update.recordId,
            sectionId: section.id,
          },
          include: {
            enrollmentApplication: true,
          },
        });

        if (!record) continue;

        // Update the EnrollmentRecord
        await tx.enrollmentRecord.update({
          where: { id: update.recordId },
          data: {
            eosyStatus: update.eosyStatus as EosyStatus,
            finalAverage:
              update.finalAverage !== undefined && update.finalAverage !== null
                ? parseFloat(String(update.finalAverage))
                : undefined,
          },
        });

        // DepEd Cutoff Enforcer for Special Programs
        const finalAverage = update.finalAverage;
        const applicantType = record.enrollmentApplication.applicantType;

        if (
          update.eosyStatus === "PROMOTED" &&
          finalAverage !== null &&
          finalAverage !== undefined &&
          finalAverage < 85 &&
          applicantType !== "REGULAR" &&
          applicantType !== "LATE_ENROLLEE"
        ) {
          // They missed the cutoff for their special program (e.g. STE)
          // Strip the program assignment so they forward as REGULAR.
          await tx.enrollmentApplication.update({
            where: { id: record.enrollmentApplicationId },
            data: {
              applicantType: "REGULAR",
              assignedProgram: "REGULAR", // If using this field
            },
          });

          await tx.auditLog.create({
            data: {
              userId,
              actionType: "STE_CUTOFF_ENFORCED",
              description: `Learner dropped from special program due to final average ${finalAverage} < 85`,
              subjectType: "EnrollmentApplication",
              recordId: record.enrollmentApplicationId,
              ipAddress: req.ip ?? "0.0.0.0",
              userAgent: (req.headers["user-agent"] as string) ?? null,
            },
          });
        }
      }

      // Lock the section
      await tx.section.update({
        where: { id: section.id },
        data: { isEosyFinalized: true },
      });

      // Promotion of Grade 10 to Completers
      if (section.gradeLevel.displayOrder === 10 || section.gradeLevel.name.includes("10")) {
        const promotedRecords = await tx.enrollmentRecord.findMany({
          where: {
            sectionId: section.id,
            eosyStatus: "PROMOTED",
          },
          select: {
            enrollmentApplication: {
              select: { learnerId: true },
            },
          },
        });

        const learnerIds = promotedRecords.map((r) => r.enrollmentApplication.learnerId);

        if (learnerIds.length > 0) {
          await tx.learner.updateMany({
            where: { id: { in: learnerIds } },
            data: { status: "JHS_COMPLETER" },
          });

          await tx.auditLog.create({
            data: {
              userId,
              actionType: "LEARNERS_COMPLETED_JHS",
              description: `Marked ${learnerIds.length} learners from section ${section.name} as JHS Completers via Teacher EOSY`,
              subjectType: "Section",
              recordId: section.id,
              ipAddress: req.ip ?? "0.0.0.0",
              userAgent: (req.headers["user-agent"] as string) ?? null,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId,
          actionType: "TEACHER_EOSY_SUBMITTED",
          description: `Teacher finalized EOSY for section ${section.name}`,
          subjectType: "Section",
          recordId: section.id,
          ipAddress: req.ip ?? "0.0.0.0",
          userAgent: (req.headers["user-agent"] as string) ?? null,
        },
      });
    });

    res.json({ success: true, message: "EOSY Grades and Statuses submitted successfully." });
  } catch (error) {
    next(error);
  }
}
