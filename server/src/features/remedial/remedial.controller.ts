import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * GET /api/remedial/pending
 * Returns all enrollment applications flagged as CONDITIONALLY_PROMOTED with remedial required.
 * Optionally scoped by ?schoolYearId=.
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function getRemedialPending(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = req.query.schoolYearId
      ? parsePositiveInt(req.query.schoolYearId, 0) || undefined
      : undefined;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 100);
    const skip = (page - 1) * limit;

    const where = {
      academicStatus: "CONDITIONALLY_PROMOTED" as const,
      isRemedialRequired: true,
      enrollment: schoolYearId ? { schoolYearId } : undefined,
    };

    const [total, checklists] = await Promise.all([
      prisma.applicationChecklist.count({ where }),
      prisma.applicationChecklist.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          enrollment: {
            include: {
              learner: {
                select: {
                  id: true,
                  lrn: true,
                  firstName: true,
                  lastName: true,
                  middleName: true,
                  sex: true,
                },
              },
              gradeLevel: { select: { id: true, name: true } },
              schoolYear: { select: { id: true, yearLabel: true } },
              enrollmentRecord: {
                select: { id: true, finalAverage: true, eosyStatus: true },
              },
            },
          },
        },
      }),
    ]);

    const items = checklists
      .filter((c) => c.enrollment !== null)
      .map((c) => {
        const app = c.enrollment!;
        return {
          checklistId: c.id,
          enrollmentApplicationId: app.id,
          learnerId: app.learnerId,
          lrn: app.learner.lrn,
          firstName: app.learner.firstName,
          lastName: app.learner.lastName,
          middleName: app.learner.middleName,
          sex: app.learner.sex,
          gradeLevel: app.gradeLevel,
          schoolYear: app.schoolYear,
          academicStatus: c.academicStatus,
          isRemedialRequired: c.isRemedialRequired,
          currentFinalAverage: app.enrollmentRecord?.finalAverage ?? null,
          eosyStatus: app.enrollmentRecord?.eosyStatus ?? null,
        };
      });

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/remedial/:learnerId/resolve
 * Resolves a remedial case after the learner passes the summer remedial exam.
 * Body: { schoolYearId: number, summerGrade: number }
 * Updates ApplicationChecklist.academicStatus → PROMOTED, isRemedialRequired → false.
 * Updates EnrollmentRecord.finalAverage = summerGrade, eosyStatus → PROMOTED.
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function resolveRemedial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const learnerId = parsePositiveInt(req.params.learnerId, 0);
    if (!learnerId) {
      res.status(400).json({ message: "Invalid learnerId." });
      return;
    }

    const schoolYearId = parsePositiveInt(req.body.schoolYearId, 0);
    if (!schoolYearId) {
      res.status(400).json({ message: "schoolYearId is required." });
      return;
    }

    const rawGrade = Number(req.body.summerGrade);
    if (!Number.isFinite(rawGrade) || rawGrade < 0 || rawGrade > 100) {
      res
        .status(400)
        .json({ message: "summerGrade must be a number between 0 and 100." });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.enrollmentApplication.findFirst({
        where: {
          learnerId,
          schoolYearId,
          status: "ENROLLED",
        },
        select: { id: true },
      });

      if (!application) {
        throw Object.assign(
          new Error(
            "No ENROLLED application found for this learner and school year.",
          ),
          { statusCode: 404 },
        );
      }

      const checklist = await tx.applicationChecklist.findUnique({
        where: { enrollmentId: application.id },
        select: { id: true, academicStatus: true, isRemedialRequired: true },
      });

      if (!checklist) {
        throw Object.assign(
          new Error("No checklist found for this enrollment application."),
          { statusCode: 404 },
        );
      }

      if (
        checklist.academicStatus !== "CONDITIONALLY_PROMOTED" ||
        !checklist.isRemedialRequired
      ) {
        throw Object.assign(
          new Error("This application is not pending remedial resolution."),
          { statusCode: 409 },
        );
      }

      const [updatedChecklist, updatedRecord] = await Promise.all([
        tx.applicationChecklist.update({
          where: { id: checklist.id },
          data: {
            academicStatus: "PROMOTED",
            isRemedialRequired: false,
            updatedById: req.user!.userId,
          },
        }),
        tx.enrollmentRecord.update({
          where: { enrollmentApplicationId: application.id },
          data: {
            finalAverage: rawGrade,
            eosyStatus: "PROMOTED",
          },
        }),
      ]);

      return { updatedChecklist, updatedRecord };
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "REMEDIAL_RESOLVED",
      description: `Resolved remedial for learner #${learnerId} (SY ${schoolYearId}); summerGrade=${rawGrade}`,
      subjectType: "Learner",
      recordId: learnerId,
      req,
    });

    res.json({
      message: "Remedial case resolved successfully.",
      checklistId: result.updatedChecklist.id,
      enrollmentRecordId: result.updatedRecord.id,
      finalAverage: result.updatedRecord.finalAverage,
      eosyStatus: result.updatedRecord.eosyStatus,
    });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    next(error);
  }
}
