import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

interface SectionInfo {
  id: number;
  name: string;
  maxCapacity: number;
  enrollmentRecords: { id: number }[];
}

interface GradeLevelInfo {
  id: number;
  name: string;
  _count: {
    enrollmentApplications: number;
  };
  sections: SectionInfo[];
}

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
          kpiHeader: {
            pendingTotal: 0,
            pendingIncomingG7: 0,
            pendingTransferees: 0,
            enrolledTotal: 0,
            enrolledNew: 0,
            enrolledContinuing: 0,
            unassignedTotal: 0,
            unassignedCriticalG7: 0,
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
      totalSectionCapacity,
      gradeLevels,
      pendingTotal,
      pendingIncomingG7,
      pendingTransferees,
      enrolledTotal,
      enrolledNew,
      enrolledContinuing,
      unassignedTotal,
      unassignedCriticalG7,
    ] = await Promise.all([
      prisma.enrollmentApplication.count({
        where: {
          status: {
            in: ["VERIFIED", "VERIFIED", "VERIFIED"],
          },
          enrollmentRecord: { is: null },
          schoolYearId,
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          status: { in: ["ENROLLED", "ENROLLED", "VERIFIED"] },
          schoolYearId,
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          status: "VERIFIED",
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
                  status: { in: ["ENROLLED", "ENROLLED", "VERIFIED"] },
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
      // KPI Header 1: Pending Verifications
      prisma.enrollmentApplication.count({
        where: { status: "PENDING_VERIFICATION", schoolYearId },
      }),
      prisma.enrollmentApplication.count({
        where: { status: "PENDING_VERIFICATION", schoolYearId, learnerType: "NEW_ENROLLEE", gradeLevel: { name: "Grade 7" } },
      }),
      prisma.enrollmentApplication.count({
        where: { status: "PENDING_VERIFICATION", schoolYearId, learnerType: "TRANSFEREE" },
      }),
      // KPI Header 2: Officially Enrolled
      prisma.enrollmentApplication.count({
        where: { status: "ENROLLED", schoolYearId },
      }),
      prisma.enrollmentApplication.count({
        where: { status: "ENROLLED", schoolYearId, learnerType: "NEW_ENROLLEE" },
      }),
      prisma.enrollmentApplication.count({
        where: { status: "ENROLLED", schoolYearId, learnerType: "CONTINUING" },
      }),
      // KPI Header 3: Unassigned Learners
      prisma.enrollmentApplication.count({
        where: { status: "VERIFIED", schoolYearId, enrollmentRecord: { is: null } },
      }),
      prisma.enrollmentApplication.count({
        where: { status: "VERIFIED", schoolYearId, enrollmentRecord: { is: null }, gradeLevel: { name: "Grade 7" } },
      }),
    ]);

    const gradeLevelBreakdown = (gradeLevels as GradeLevelInfo[]).map((gl) => {
      const current = gl._count.enrollmentApplications;
      const target = gl.sections.reduce((sum: number, s: SectionInfo) => sum + s.maxCapacity, 0);
      return {
        id: gl.id,
        name: gl.name,
        current,
        target,
        progressPercent:
          target > 0 ? Number(((current / target) * 100).toFixed(1)) : 0,
      };
    });

    const capacityAlerts = (gradeLevels as GradeLevelInfo[]).flatMap((gl) =>
      gl.sections
        .map((s: SectionInfo) => ({
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
        kpiHeader: {
          pendingTotal,
          pendingIncomingG7,
          pendingTransferees,
          enrolledTotal,
          enrolledNew,
          enrolledContinuing,
          unassignedTotal,
          unassignedCriticalG7,
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
