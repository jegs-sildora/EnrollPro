import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = req.schoolYearId;

    // STRICT SCOPING: If no SY context, return empty stats to prevent cross-SY leakage.
    if (!schoolYearId) {
      res.json({
        stats: {
          totalPending: 0,
          totalEnrolled: 0,
          totalPreRegistered: 0,
          sectionsAtCapacity: 0,
          enrollmentTarget: {
            current: 0,
            target: 0,
            seatsRemaining: 0,
            progressPercent: 0,
          },
          gradeLevelBreakdown: [],
          capacityAlerts: [],
          actions: {
            pendingReview: 0,
            sectionsAtCapacity: 0,
          },
          earlyRegistration: {
            submitted: 0,
            verified: 0,
            examScheduled: 0,
            readyForEnrollment: 0,
            enrolled: 0,
            inPipeline: 0,
            total: 0,
          },
        },
      });
      return;
    }

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
      gradeLevels,
    ] = await Promise.all([
      prisma.enrollmentApplication.count({
        where: {
          status: {
            in: ["UNDER_REVIEW", "READY_FOR_ENROLLMENT", "SUBMITTED_BEEF"],
          },
          enrollmentRecord: { is: null },
          schoolYearId,
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          status: "ENROLLED",
          schoolYearId,
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          status: "READY_FOR_ENROLLMENT",
          schoolYearId,
        },
      }),
      // Count sections at capacity
      prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "sections" s
      WHERE s."school_year_id" = ${schoolYearId}
        AND (
          SELECT COUNT(*)
          FROM "enrollment_records" e
          WHERE e."section_id" = s.id
            AND e."school_year_id" = ${schoolYearId}
        ) >= s."max_capacity"
    `,
      // ── Early Registration counts ──
      prisma.earlyRegistrationApplication.count({
        where: {
          status: "SUBMITTED_BEERF",
          schoolYearId,
        },
      }),
      prisma.earlyRegistrationApplication.count({
        where: {
          status: { in: ["READY_FOR_ENROLLMENT", "VERIFIED"] },
          schoolYearId,
        },
      }),
      prisma.earlyRegistrationApplication.count({
        where: {
          status: "EXAM_SCHEDULED",
          schoolYearId,
        },
      }),
      prisma.earlyRegistrationApplication.count({
        where: {
          status: "READY_FOR_ENROLLMENT",
          schoolYearId,
        },
      }),
      prisma.earlyRegistrationApplication.count({
        where: {
          schoolYearId,
        },
      }),
      prisma.section.aggregate({
        where: { schoolYearId },
        _sum: { maxCapacity: true },
      }),
      prisma.gradeLevel.findMany({
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              enrollmentApplications: {
                where: {
                  status: "ENROLLED",
                  schoolYearId,
                },
              },
            },
          },
          sections: {
            where: { schoolYearId },
            select: {
              id: true,
              name: true,
              maxCapacity: true,
              enrollmentRecords: {
                where: { schoolYearId },
                select: { id: true },
              },
            },
          },
        },
      }),
    ]);

    const gradeLevelBreakdown = gradeLevels.map((gl) => {
      const current = gl._count.enrollmentApplications;
      const target = gl.sections.reduce((sum, s) => sum + s.maxCapacity, 0);
      return {
        id: gl.id,
        name: gl.name,
        current,
        target,
        progressPercent:
          target > 0 ? Number(((current / target) * 100).toFixed(1)) : 0,
      };
    });

    const capacityAlerts = gradeLevels.flatMap((gl) =>
      gl.sections
        .map((s) => ({
          sectionId: s.id,
          sectionName: s.name,
          gradeLevelName: gl.name,
          current: s.enrollmentRecords.length,
          target: s.maxCapacity,
        }))
        .filter((s) => s.current >= s.target * 0.9)
        .map((s) => ({
          message: `${s.gradeLevelName} '${s.sectionName}' is ${s.current >= s.target ? "at FULL" : "approaching max"} capacity (${s.current}/${s.target})`,
          severity: s.current >= s.target ? ("CRITICAL" as const) : ("WARNING" as const),
        })),
    );

    const sectionCapacityTarget = Number(
      totalSectionCapacity?._sum?.maxCapacity ?? 0,
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
        gradeLevelBreakdown,
        capacityAlerts,
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
  } catch (error: any) {
    console.error("[DashboardController] Error fetching stats:", error);
    res.status(500).json({
      message: error.message || "Failed to fetch dashboard statistics",
    });
  }
}
