import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = req.schoolYearId;
    
    // Fetch systemPhase
    const setting = await prisma.schoolSetting.findFirst();
    const systemPhase = setting?.systemPhase || "OFFICIAL_ENROLLMENT";

    if (!schoolYearId) {
      res.json({
        stats: {
          systemPhase: "OFFICIAL_ENROLLMENT",
          kpiHeader: {
            pendingTotal: 0,
            unassignedTotal: 0,
            deficientTotal: 0,
            enrolledTotal: 0,
          },
          gradeLevelBreakdown: [],
          criticalSections: [],
          totalSections: 0,
        },
      });
      return;
    }

    const gradeLevels = await prisma.gradeLevel.findMany({
      orderBy: { displayOrder: 'asc' }
    });

    const currentMonth = new Date().getMonth() + 1;

    const [
      enrolledTotal,
      pendingTotal,
      unassignedTotal,
      deficientTotal,
      lateIntakeCount,
      pendingSF10Count,
      overdueDocumentsCount,
      activeSchoolTallyBOSY,
      activeSchoolTallyLate,
      transferredIn,
      transferredOut,
      droppedOut,
      eosyFinalizedSections,
      eosyPendingSections,
      promotedTotal,
      retainedTotal,
      irregularTotal
    ] = await Promise.all([
      prisma.enrollmentRecord.count({ where: { schoolYearId } }),
      prisma.enrollmentApplication.count({ where: { status: "PENDING_VERIFICATION", schoolYearId } }),
      prisma.enrollmentApplication.count({ where: { status: "VERIFIED", enrollmentRecord: { is: null }, schoolYearId } }),
      prisma.enrollmentApplication.count({ where: { complianceStatus: "PENDING", schoolYearId } }),
      
      // V8.5 Queries (Classes Ongoing)
      prisma.enrollmentApplication.count({ 
        where: { status: "PENDING_VERIFICATION", isLateEnrollee: true, schoolYearId } 
      }),
      prisma.enrollmentRecord.count({ 
        where: { sf10Status: { in: ["PENDING", "REQUESTED"] }, schoolYearId } 
      }),
      prisma.learner.count({ 
        where: { 
          OR: [
            { isConditionallyEnrolled: true },
            { missingRequirements: { isEmpty: false } }
          ]
        } 
      }),
      prisma.enrollmentRecord.count({ 
        where: { isLateEnrollee: false, schoolYearId } 
      }),
      prisma.enrollmentRecord.count({ 
        where: { isLateEnrollee: true, schoolYearId } 
      }),
      prisma.sF4Log.count({ 
        where: { movementType: "TRANSFER_IN", month: currentMonth } 
      }),
      prisma.sF4Log.count({ 
        where: { movementType: "TRANSFER_OUT", month: currentMonth } 
      }),
      prisma.sF4Log.count({ 
        where: { movementType: "DROPPED_OUT", month: currentMonth } 
      }),
      
      // EOSY Queries
      prisma.section.count({ where: { schoolYearId, isEosyFinalized: true } }),
      prisma.section.count({ where: { schoolYearId, isEosyFinalized: false } }),
      prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "PROMOTED" } }),
      prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "RETAINED" } }),
      prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" } })
    ]);

    const sections = await prisma.section.findMany({
      where: { schoolYearId },
      include: {
        gradeLevel: true,
        _count: {
          select: { enrollmentRecords: true }
        }
      }
    });

    const criticalSections = sections
      .map(s => ({
        id: s.id,
        name: `${s.gradeLevel.name} - ${s.name}`,
        capacity: s.maxCapacity || 45,
        enrolled: s._count.enrollmentRecords
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 3);

    const totalSections = sections.length;


    const breakdownMap: Record<number, { male: number; female: number; current: number; late: number; dropped: number }> = {};
    gradeLevels.forEach(gl => {
      breakdownMap[gl.id] = { male: 0, female: 0, current: 0, late: 0, dropped: 0 };
    });

    const records = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId },
      select: {
        isLateEnrollee: true,
        dropOutDate: true,
        enrollmentApplication: {
          select: { gradeLevelId: true }
        },
        learner: {
          select: { sex: true }
        }
      }
    });

    records.forEach(r => {
      const glId = r.enrollmentApplication?.gradeLevelId;
      const sex = r.learner?.sex;
      if (glId && breakdownMap[glId]) {
        breakdownMap[glId].current += 1;
        if (r.isLateEnrollee) breakdownMap[glId].late += 1;
        if (r.dropOutDate) breakdownMap[glId].dropped += 1;
        
        if (sex === 'MALE') breakdownMap[glId].male += 1;
        else if (sex === 'FEMALE') breakdownMap[glId].female += 1;
      }
    });

    const gradeLevelBreakdown = gradeLevels.map(gl => ({
      id: gl.id,
      name: gl.name,
      current: breakdownMap[gl.id]?.current || 0,
      male: breakdownMap[gl.id]?.male || 0,
      female: breakdownMap[gl.id]?.female || 0,
      late: breakdownMap[gl.id]?.late || 0,
      dropped: breakdownMap[gl.id]?.dropped || 0,
    }));

    const baseStats = {
      systemPhase,
      kpiHeader: {
        pendingTotal,
        unassignedTotal,
        deficientTotal,
        enrolledTotal,
      },
      v85Stats: {
        lateIntakeCount,
        pendingSF10Count,
        overdueDocumentsCount,
        activeSchoolTallyBOSY,
        activeSchoolTallyLate,
        sf4Vitals: {
          transferredIn,
          transferredOut,
          droppedOut
        }
      },
      eosyStats: {
        eosyFinalizedSections,
        eosyPendingSections,
        promotedTotal,
        retainedTotal,
        irregularTotal
      },
      criticalSections,
      totalSections,
      gradeLevelBreakdown,
    };

    res.json({ stats: baseStats });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats" });
  }
}

export async function lockPhaseAndExportSF1(req: Request, res: Response): Promise<void> {
  try {
    const schoolYearId = req.schoolYearId;
    if (!schoolYearId) {
      res.status(400).json({ message: "No active school year" });
      return;
    }

    const userId = req.user?.userId;

    await prisma.schoolYear.update({
      where: { id: schoolYearId },
      data: { 
        status: "BOSY_LOCKED",
        bosyLockedAt: new Date(),
        bosyLockedById: userId || null
      }
    });

    // Mock an excel file buffer for the SF1 Baseline
    const dummyExcelContent = Buffer.from("DUMMY_EXCEL_FILE_CONTENT_FOR_SF1");
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="SF1_BOSY_BASELINE.xlsx"');
    res.send(dummyExcelContent);
  } catch (error) {
    console.error("Failed to lock phase:", error);
    res.status(500).json({ message: "Failed to lock phase and export" });
  }
}

export async function getAdminStats(req: Request, res: Response) {
  res.json({
    activeUsers: 42,
    usersByRole: { REGISTRAR: 2, ADMIN: 1, PRINCIPAL: 1, TEACHER: 38 },
    emailDeliveryRate: "99.9%",
    systemStatus: "ACTIVE",
  });
}

export async function getDemographics(req: Request, res: Response) {
  res.json({
    ageGroups: [{ name: "11-12", value: 30 }, { name: "13-14", value: 45 }, { name: "15-16", value: 25 }],
    genderRatio: [{ name: "Male", value: 48 }, { name: "Female", value: 52 }],
    municipalityDistribution: [{ name: "City Center", value: 60 }, { name: "Suburbs", value: 40 }]
  });
}

export async function getRecentActivity(req: Request, res: Response) {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { email: true, roles: true } }
      }
    });
    res.json({ activity: logs });
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
}
