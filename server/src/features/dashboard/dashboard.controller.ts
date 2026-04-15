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
    earlyRegInPipeline,
    earlyRegTotal,
  ] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        status: "ENROLLED",
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        status: "PRE_REGISTERED",
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    // Count sections at capacity
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count FROM "sections" s
      WHERE (SELECT COUNT(*) FROM "enrollment_records" e WHERE e."section_id" = s.id) >= s."max_capacity"
    `,
    // ── Early Registration counts ──
    prisma.earlyRegistrationApplication.count({
      where: {
        status: "SUBMITTED",
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        status: "VERIFIED",
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        status: {
          in: [
            "UNDER_REVIEW",
            "ELIGIBLE",
            "ASSESSMENT_SCHEDULED",
            "ASSESSMENT_TAKEN",
          ],
        },
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
    prisma.earlyRegistrationApplication.count({
      where: {
        ...(schoolYearId ? { schoolYearId } : {}),
      },
    }),
  ]);

  res.json({
    stats: {
      totalPending,
      totalEnrolled,
      totalPreRegistered,
      sectionsAtCapacity: Number(sectionsAtCapacity[0]?.count ?? 0),
      earlyRegistration: {
        submitted: earlyRegSubmitted,
        verified: earlyRegVerified,
        inPipeline: earlyRegInPipeline,
        total: earlyRegTotal,
      },
    },
  });
}
