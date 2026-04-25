import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import os from "os";

export async function getSystemStatus(req: Request, res: Response) {
  try {
    const setting = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!setting?.activeSchoolYear) {
      res.json({ status: "NO_ACTIVE_YEAR" });
      return;
    }

    const [pendingCount, unsectionedCount, sectionedCount] = await Promise.all([
      prisma.enrollmentApplication.count({
        where: {
          schoolYearId: setting.activeSchoolYear.id,
          status: "SUBMITTED_BEEF",
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          schoolYearId: setting.activeSchoolYear.id,
          status: { in: ["READY_FOR_SECTIONING", "VERIFIED"] },
        },
      }),
      prisma.enrollmentApplication.count({
        where: {
          schoolYearId: setting.activeSchoolYear.id,
          status: { in: ["ENROLLED", "OFFICIALLY_ENROLLED"] },
        },
      }),
    ]);

    res.json({
      schoolYearId: setting.activeSchoolYear.id,
      yearLabel: setting.activeSchoolYear.yearLabel,
      status: setting.activeSchoolYear.status,
      bosyLockedAt: setting.activeSchoolYear.bosyLockedAt,
      bosyLockedById: setting.activeSchoolYear.bosyLockedById,
      preLockStats: {
        pendingCount,
        unsectionedCount,
        sectionedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function lockBosy(req: Request, res: Response) {
  try {
    const { pin, yearLabel } = req.body;
    const adminPin = process.env.ADMIN_BOSY_LOCK_PIN || "123456";

    if (pin !== adminPin) {
      res.status(403).json({ message: "Invalid Admin PIN" });
      return;
    }

    const setting = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!setting?.activeSchoolYear) {
      res.status(404).json({ message: "No active school year found" });
      return;
    }

    if (setting.activeSchoolYear.yearLabel !== yearLabel) {
      res.status(400).json({ message: "School year label mismatch" });
      return;
    }

    if (setting.activeSchoolYear.status === "BOSY_LOCKED") {
      res.status(400).json({ message: "BOSY is already locked" });
      return;
    }

    const lockedAt = new Date();
    const updated = await prisma.schoolYear.update({
      where: { id: setting.activeSchoolYear.id },
      data: {
        status: "BOSY_LOCKED",
        bosyLockedAt: lockedAt,
        bosyLockedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_LOCKED",
      description: `Admin locked Beginning of School Year (BOSY) for S.Y. ${yearLabel}`,
      req,
    });

    // Fire non-blocking webhooks
    void dispatchBosyReadyWebhooks(updated.id, lockedAt);

    res.json({
      message: "BOSY successfully locked. SF1 rosters finalized.",
      status: updated.status,
      lockedAt: updated.bosyLockedAt,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function unlockBosy(req: Request, res: Response) {
  try {
    const { justification } = req.body;

    if (!justification || justification.length < 10) {
      res.status(400).json({
        message: "A valid justification (min 10 chars) is required for emergency unlock",
      });
      return;
    }

    const setting = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!setting?.activeSchoolYear) {
      res.status(404).json({ message: "No active school year found" });
      return;
    }

    const updated = await prisma.schoolYear.update({
      where: { id: setting.activeSchoolYear.id },
      data: {
        status: "ENROLLMENT_OPEN",
        bosyLockedAt: null,
        bosyLockedById: null,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "BOSY_UNLOCKED",
      description: `Admin triggered EMERGENCY BOSY UNLOCK. Justification: ${justification}`,
      req,
    });

    res.json({
      message: "BOSY has been unlocked. Batch operations re-enabled.",
      status: updated.status,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function dispatchBosyReadyWebhooks(schoolYearId: number, lockedAt: Date) {
  const payload = {
    schoolYearId,
    lockedAt: lockedAt.toISOString(),
    status: "BOSY_LOCKED",
  };

  const targets = [
    "https://atlas.local/api/webhooks/bosy-ready",
    "https://smart.local/api/webhooks/bosy-ready",
  ];

  for (const url of targets) {
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Log failure but don't block
      console.warn(`Failed to dispatch BOSY webhook to ${url}`);
    });
  }
}

export async function health(req: Request, res: Response) {
  try {
    // Database connectivity check
    let dbStatus = "OK";
    let dbAvgQuery = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbAvgQuery = Date.now() - start;
    } catch {
      dbStatus = "DOWN";
    }

    // Record counts
    const counts = await getRecordCounts();

    // Server info
    const serverInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };

    res.json({
      database: { status: dbStatus, avgQueryMs: dbAvgQuery },
      storage: { status: "OK" },
      server: serverInfo,
      counts,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function dashboardStats(req: Request, res: Response) {
  try {
    const activeUsersCount = await prisma.user.count({
      where: { isActive: true },
    });
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      where: { isActive: true },
      _count: true,
    });

    let dbStatus = "OK";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "DOWN";
    }

    res.json({
      activeUsers: activeUsersCount,
      usersByRole: usersByRole.reduce((acc: any, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
      systemStatus: dbStatus,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getRecordCounts() {
  const [
    users,
    schoolYears,
    gradeLevels,
    sections,
    earlyRegistrations,
    applications,
    enrollments,
    auditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.schoolYear.count(),
    prisma.gradeLevel.count(),
    prisma.section.count(),
    prisma.earlyRegistrationApplication.count(),
    prisma.enrollmentApplication.count(),
    prisma.enrollmentRecord.count(),
    prisma.auditLog.count(),
  ]);

  return {
    users,
    schoolYears,
    gradeLevels,
    sections,
    earlyRegistrations,
    applications,
    enrollments,
    auditLogs,
  };
}
