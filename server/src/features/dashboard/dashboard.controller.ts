import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  const settings = await prisma.schoolSetting.findFirst();
  const schoolYearId = settings?.activeSchoolYearId;

  const [
    totalPending,
    totalEnrolled,
    totalPreRegistered,
    sectionsAtCapacity,
    earlyRegSubmitted,
    earlyRegVerified,
    earlyRegExamScheduled,
    earlyRegReadyForEnrollment,
    earlyRegTotal,
    totalSectionCapacity,
  ] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        status: {
          in: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING", "SUBMITTED"],
        },
        enrollmentRecord: { is: null },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        status: { in: ["OFFICIALLY_ENROLLED", "ENROLLED"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        status: { in: ["READY_FOR_SECTIONING", "READY_FOR_ENROLLMENT"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    // Count sections at capacity
    schoolYearId
      ? prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "sections" s
          JOIN "grade_levels" gl ON gl.id = s."grade_level_id"
          WHERE gl."school_year_id" = ${schoolYearId}
            AND (
              SELECT COUNT(*)
              FROM "enrollment_records" e
              WHERE e."section_id" = s.id
                AND e."school_year_id" = ${schoolYearId}
            ) >= s."max_capacity"
        `
      : prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count
          FROM "sections" s
          WHERE (
            SELECT COUNT(*)
            FROM "enrollment_records" e
            WHERE e."section_id" = s.id
          ) >= s."max_capacity"
        `,
    // ── Early Registration counts ──
    prisma.earlyRegistrationApplication.count({
      where: {
        status: { in: ["EARLY_REG_SUBMITTED", "SUBMITTED"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        status: { in: ["PRE_REGISTERED", "VERIFIED"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        status: "EXAM_SCHEDULED",
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        status: { in: ["PRE_REGISTERED", "READY_FOR_ENROLLMENT"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.section.aggregate({
      where: schoolYearId
        ? {
            gradeLevel: {
              schoolYearId,
            },
          }
        : undefined,
      _sum: { maxCapacity: true },
    }),
  ]);

  const sectionCapacityTarget = Number(
    totalSectionCapacity._sum.maxCapacity ?? 0,
  );
  const enrollmentProgressPercent =
    sectionCapacityTarget > 0
      ? Number(((totalEnrolled / sectionCapacityTarget) * 100).toFixed(1))
      : 0;

  res.json({
    stats: {
      totalPending,
      totalEnrolled,
      totalPreRegistered,
      sectionsAtCapacity: Number(sectionsAtCapacity[0]?.count ?? 0),
      enrollmentTarget: {
        current: totalEnrolled,
        target: sectionCapacityTarget,
        seatsRemaining: Math.max(sectionCapacityTarget - totalEnrolled, 0),
        progressPercent: enrollmentProgressPercent,
      },
      actions: {
        pendingReview: totalPending,
        sectionsAtCapacity: Number(sectionsAtCapacity[0]?.count ?? 0),
      },
      earlyRegistration: {
        submitted: earlyRegSubmitted,
        verified: earlyRegVerified,
        examScheduled: earlyRegExamScheduled,
        readyForEnrollment: earlyRegReadyForEnrollment,
        enrolled: totalEnrolled,
        inPipeline: earlyRegExamScheduled + earlyRegReadyForEnrollment,
        total: earlyRegTotal,
      },
    },
  });
}
