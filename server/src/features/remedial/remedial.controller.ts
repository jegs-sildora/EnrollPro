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
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), 1000000);
    const skip = (page - 1) * limit;

    const where = {
      academicStatus: "CONDITIONALLY_PROMOTED" as const,
      isRemedialRequired: true,
      ...(schoolYearId ? { schoolYearId } : {}),
    };

    const [total, applications] = await Promise.all([
      prisma.enrollmentApplication.count({ where }),
      prisma.enrollmentApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: "desc" },
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
      }),
    ]);

    const items = applications.map((app) => ({
      checklistId: app.id,
      enrollmentApplicationId: app.id,
      learnerId: app.learnerId,
      lrn: app.learner.lrn,
      firstName: app.learner.firstName,
      lastName: app.learner.lastName,
      middleName: app.learner.middleName,
      sex: app.learner.sex,
      gradeLevel: app.gradeLevel,
      schoolYear: app.schoolYear,
      academicStatus: app.academicStatus,
      isRemedialRequired: app.isRemedialRequired,
      currentFinalAverage: app.enrollmentRecord?.finalAverage ?? null,
      eosyStatus: app.enrollmentRecord?.eosyStatus ?? null,
    }));

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
        select: { id: true, academicStatus: true, isRemedialRequired: true },
      });

      if (!application) {
        throw Object.assign(
          new Error(
            "No ENROLLED application found for this learner and school year.",
          ),
          { statusCode: 404 },
        );
      }

      if (
        application.academicStatus !== "CONDITIONALLY_PROMOTED" ||
        !application.isRemedialRequired
      ) {
        throw Object.assign(
          new Error("This application is not pending remedial resolution."),
          { statusCode: 409 },
        );
      }

      const [updatedApplication, updatedRecord] = await Promise.all([
        tx.enrollmentApplication.update({
          where: { id: application.id },
          data: {
            academicStatus: "PROMOTED",
            isRemedialRequired: false,
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

      return { updatedApplication, updatedRecord };
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
      checklistId: result.updatedApplication.id,
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
