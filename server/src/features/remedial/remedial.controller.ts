import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/index.js";

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

    const where: Prisma.EnrollmentApplicationWhereInput = {
      academicStatus: "CONDITIONALLY_PROMOTED",
      isRemedialRequired: true,
      status: {
        in: ["OFFICIALLY_ENROLLED", "REMEDIAL_HOLD"],
      },
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
