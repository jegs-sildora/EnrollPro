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

    const schoolYearObj = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { status: true }
    });
    const isArchived = schoolYearObj?.status === "ARCHIVED";

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
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId } }) : prisma.enrollmentRecord.count({ where: { schoolYearId } }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentApplication.count({ where: { status: "PENDING_VERIFICATION", schoolYearId } }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentApplication.count({ where: { status: "VERIFIED", enrollmentRecord: { is: null }, schoolYearId } }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentApplication.count({ where: { complianceStatus: "PENDING", schoolYearId } }),
      
      // V8.5 Queries (Classes Ongoing)
      isArchived ? Promise.resolve(0) : prisma.enrollmentApplication.count({ 
        where: { status: "PENDING_VERIFICATION", isLateEnrollee: true, schoolYearId } 
      }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentRecord.count({ 
        where: { sf10Status: { in: ["PENDING", "REQUESTED"] }, schoolYearId } 
      }),
      isArchived ? Promise.resolve(0) : prisma.learner.count({ 
        where: { 
          OR: [
            { isConditionallyEnrolled: true },
            { missingRequirements: { isEmpty: false } }
          ]
        } 
      }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentRecord.count({ 
        where: { isLateEnrollee: false, schoolYearId } 
      }),
      isArchived ? Promise.resolve(0) : prisma.enrollmentRecord.count({ 
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
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "PROMOTED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "PROMOTED" } }),
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "RETAINED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "RETAINED" } }),
      isArchived ? prisma.enrollmentHistory.count({ where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" } }) : prisma.enrollmentRecord.count({ where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" } })
    ]);

    const sections = await prisma.section.findMany({
      where: { schoolYearId },
      include: {
        gradeLevel: true,
        _count: {
          select: isArchived ? { enrollmentHistories: true } : { enrollmentRecords: true }
        }
      }
    });

    const criticalSections = sections
      .map(s => ({
        id: s.id,
        name: `${s.gradeLevel.name} - ${s.name}`,
        capacity: s.maxCapacity || 45,
        enrolled: isArchived ? s._count.enrollmentHistories : s._count.enrollmentRecords
      }))
      .sort((a, b) => b.enrolled - a.enrolled)
      .slice(0, 3);

    const totalSections = sections.length;


    const breakdownMap = new Map();
    gradeLevels.forEach(gl => {
      breakdownMap.set(gl.id, {
        male: 0,
        female: 0,
        current: 0,
        late: 0,
        dropped: 0,
        feeder: 0,
        transferee: 0,
        balikAral: 0,
      });
    });

    if (isArchived) {
      const histRecords = await prisma.enrollmentHistory.findMany({
        where: { schoolYearId },
        select: {
          eosyStatus: true,
          gradeLevelId: true,
          learner: {
            select: { sex: true }
          }
        }
      });

      histRecords.forEach(r => {
        const glId = r.gradeLevelId;
        const sex = r.learner?.sex;
        if (glId && breakdownMap.has(glId)) {
          const item = breakdownMap.get(glId);
          item.current += 1;
          if (r.eosyStatus === "DROPPED_OUT") item.dropped += 1;
          
          if (sex === "MALE") item.male += 1;
          else if (sex === "FEMALE") item.female += 1;
        }
      });
    } else {
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
        if (glId && breakdownMap.has(glId)) {
          const item = breakdownMap.get(glId);
          item.current += 1;
          if (r.isLateEnrollee) item.late += 1;
          if (r.dropOutDate) item.dropped += 1;
          
          if (sex === "MALE") item.male += 1;
          else if (sex === "FEMALE") item.female += 1;
        }
      });
    }

    const applications = await prisma.enrollmentApplication.findMany({
      where: { schoolYearId },
      select: {
        gradeLevelId: true,
        learnerType: true,
      }
    });

    applications.forEach(app => {
      const glId = app.gradeLevelId;
      if (glId && breakdownMap.has(glId)) {
        const item = breakdownMap.get(glId);
        if (app.learnerType === "NEW_ENROLLEE") item.feeder += 1;
        else if (app.learnerType === "TRANSFEREE") item.transferee += 1;
        else if (app.learnerType === "RETURNING") item.balikAral += 1;
      }
    });

    const gradeLevelBreakdown = gradeLevels.map(gl => {
      const item = breakdownMap.get(gl.id);
      return {
        id: gl.id,
        name: gl.name,
        current: item?.current || 0,
        male: item?.male || 0,
        female: item?.female || 0,
        late: item?.late || 0,
        dropped: item?.dropped || 0,
        feeder: item?.feeder || 0,
        transferee: item?.transferee || 0,
        balikAral: item?.balikAral || 0,
      };
    });

    const sectionsList = await prisma.section.findMany({
      where: { schoolYearId },
      select: { maxCapacity: true }
    });
    const totalCapacity = sectionsList.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);
    const classroomDeficitDetected = enrolledTotal > totalCapacity;

    const getManilaDateString = (date: Date): string => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find((part) => part.type === "year")?.value ?? "0";
      const month = parts.find((part) => part.type === "month")?.value ?? "0";
      const day = parts.find((part) => part.type === "day")?.value ?? "0";
      return `${year}-${month}-${day}`;
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 15);
    const recentApps = await prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId,
        createdAt: { gte: startDate }
      },
      select: {
        createdAt: true,
        admissionChannel: true,
      }
    });

    const dailyMap = new Map();
    recentApps.forEach(app => {
      const dateStr = getManilaDateString(app.createdAt);
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, { online: 0, f2f: 0 });
      }
      const counts = dailyMap.get(dateStr);
      if (app.admissionChannel === "ONLINE") counts.online += 1;
      else counts.f2f += 1;
    });

    const dailyIntakeVelocity = new Array();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getManilaDateString(d);
      const counts = dailyMap.get(dateStr) || { online: 0, f2f: 0 };
      const monthNamesFull = Array.of(
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      );
      const displayDate = `${monthNamesFull.at(d.getMonth())} ${d.getDate()}`;
      dailyIntakeVelocity.push({
        date: displayDate,
        online: counts.online,
        f2f: counts.f2f,
      });
    }

    let feederCount = 0;
    let transfereeCount = 0;
    let alsCount = 0;
    let peptCount = 0;
    let balikAralCount = 0;
    applications.forEach(app => {
      if (app.learnerType === "NEW_ENROLLEE") feederCount += 1;
      else if (app.learnerType === "TRANSFEREE") transfereeCount += 1;
      else if (app.learnerType === "ALS") alsCount += 1;
      else if (app.learnerType === "RETURNING") balikAralCount += 1;
    });

    const intakeDemographics = Array.of(
      { category: "Feeder Elementary Graduates", count: feederCount },
      { category: "External Transferees In", count: transfereeCount },
      { category: "ALS Passers", count: alsCount },
      { category: "PEPT Passers", count: peptCount },
      { category: "Balik-Aral", count: balikAralCount }
    );

    let hasSectionLoadDisparity = false;
    const gradeSectionsMap = new Map();
    sections.forEach(s => {
      const glId = s.gradeLevelId;
      if (!gradeSectionsMap.has(glId)) {
        gradeSectionsMap.set(glId, new Array());
      }
      gradeSectionsMap.get(glId).push(isArchived ? s._count.enrollmentHistories : s._count.enrollmentRecords);
    });

    for (const [glId, counts] of gradeSectionsMap.entries()) {
      if (counts.length > 1) {
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        if (max - min > 5) {
          hasSectionLoadDisparity = true;
        }
      }
    }

    const expiredTemporaryAdmissionsCount = await prisma.enrollmentApplication.count({
      where: { schoolYearId, isTemporarilyEnrolled: true }
    });
    const now = new Date();
    const currentYear = now.getFullYear();
    const deadline = new Date(currentYear, 9, 31, 23, 59, 59);
    const isTemporaryAdmissionExpired = now > deadline;

    const logs = await prisma.sF4Log.findMany({
      where: {
        year: { gte: currentYear - 1 }
      },
      select: {
        movementType: true,
        month: true,
        year: true,
      }
    });

    const monthNamesShort = Array.of(
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    );
    const schoolYearMonths = Array.of(6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4);

    const movementTrend = schoolYearMonths.map(m => {
      let trIn = 0;
      let trOut = 0;
      let drOut = 0;
      logs.forEach(log => {
        if (log.month === m) {
          if (log.movementType === "TRANSFER_IN") trIn += 1;
          else if (log.movementType === "TRANSFER_OUT") trOut += 1;
          else if (log.movementType === "DROPPED_OUT") drOut += 1;
        }
      });
      return {
        month: monthNamesShort.at(m - 1) || "Unknown",
        transferredIn: trIn,
        transferredOut: trOut,
        droppedOut: drOut,
      };
    });

    const dropOutRecords = isArchived 
      ? await prisma.enrollmentHistory.findMany({
          where: { schoolYearId, eosyStatus: "DROPPED_OUT" },
          select: { eosyStatus: true } // We don't have dropOutReason in History
        })
      : await prisma.enrollmentRecord.findMany({
          where: { schoolYearId, dropOutDate: { not: null } },
          select: { dropOutReason: true }
        });

    const reasonsMap = new Map();
    const standardReasons = Array.of(
      "Financial", "Illness", "Family Matters", "Relocation", "Bullying", "Child Labor", "Unknown"
    );
    standardReasons.forEach(r => reasonsMap.set(r, 0));

    dropOutRecords.forEach(rec => {
      const r = (rec as any).dropOutReason || "Unknown";
      const currentVal = reasonsMap.get(r) || 0;
      reasonsMap.set(r, currentVal + 1);
    });

    const dropoutDistribution = Array.from(reasonsMap.entries()).map(([reason, count]) => ({
      reason,
      count,
    }));

    const complianceApps = await prisma.enrollmentApplication.findMany({
      where: { schoolYearId },
      select: {
        isMissingSf9: true,
        learner: {
          select: {
            hasPsaBirthCertificate: true,
          }
        }
      }
    });

    let completeCount = 0;
    let missingPsaCount = 0;
    let missingSf9Count = 0;

    complianceApps.forEach(app => {
      const hasPsa = app.learner?.hasPsaBirthCertificate ?? false;
      const isMissingSf9 = app.isMissingSf9;
      if (!hasPsa) {
        missingPsaCount += 1;
      } else if (isMissingSf9) {
        missingSf9Count += 1;
      } else {
        completeCount += 1;
      }
    });

    const documentCompliance = Array.of(
      { name: "Complete Verified Records", value: completeCount },
      { name: "Missing PSA Birth Certificate", value: missingPsaCount },
      { name: "Missing SF9 Report Card", value: missingSf9Count }
    );

    const activeEnrolledCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: { notIn: ["DROPPED_OUT", "TRANSFERRED_OUT"] } }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, dropOutDate: null, transferOutDate: null }
        });

    const cumulativeTransferredCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: "TRANSFERRED_OUT" }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, transferOutDate: { not: null } }
        });

    const cumulativeDroppedCount = isArchived
      ? await prisma.enrollmentHistory.count({
          where: { schoolYearId, eosyStatus: "DROPPED_OUT" }
        })
      : await prisma.enrollmentRecord.count({
          where: { schoolYearId, dropOutDate: { not: null } }
        });

    const learnerRetention = Array.of(
      { name: "Officially Enrolled Active Tally", value: activeEnrolledCount },
      { name: "Cumulative Transferred Out", value: cumulativeTransferredCount },
      { name: "Cumulative Dropped Out", value: cumulativeDroppedCount }
    );

    const gradeLevelFinalization = gradeLevels.map(gl => {
      const glSections = sections.filter(s => s.gradeLevelId === gl.id);
      const totalCount = glSections.length;
      const finalizedCount = glSections.filter(s => s.isEosyFinalized).length;
      const percent = totalCount === 0 ? 0 : Math.round((finalizedCount / totalCount) * 100);
      return {
        id: gl.id,
        name: gl.name,
        total: totalCount,
        finalized: finalizedCount,
        percent,
      };
    });

    const activeLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: { notIn: ["DROPPED_OUT", "TRANSFERRED_OUT"] } } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, dropOutDate: null, transferOutDate: null } } }
        });

    const transferredLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: "TRANSFERRED_OUT" } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, transferOutDate: { not: null } } } }
        });

    const droppedLearnersCount = isArchived
      ? await prisma.learner.count({
          where: { enrollmentHistories: { some: { schoolYearId, eosyStatus: "DROPPED_OUT" } } }
        })
      : await prisma.learner.count({
          where: { enrollmentRecords: { some: { schoolYearId, dropOutDate: { not: null } } } }
        });

    const baseStats = {
      systemPhase,
      classroomDeficitDetected,
      dailyIntakeVelocity,
      intakeDemographics,
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
        hasSectionLoadDisparity,
        isTemporaryAdmissionExpired,
        expiredTemporaryAdmissionsCount,
        movementTrend,
        dropoutDistribution,
        documentCompliance,
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
        irregularTotal,
        learnerRetention,
        gradeLevelFinalization,
        activeLearnersCount,
        transferredLearnersCount,
        droppedLearnersCount
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
