import type { Request, Response } from "express";
import os from "os";
import { prisma } from "../../lib/prisma.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected system error";
}

export async function health(_req: Request, res: Response) {
  try {
    let dbStatus = "OK";
    let dbAvgQuery = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbAvgQuery = Date.now() - start;
    } catch {
      dbStatus = "DOWN";
    }

    const counts = await getRecordCounts();
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
  } catch (error: unknown) {
    res.status(500).json({ message: errorMessage(error) });
  }
}

export async function dashboardStats(_req: Request, res: Response) {
  try {
    const activeUsersCount = await prisma.user.count({
      where: { isActive: true },
    });
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { roles: true },
    });

    const usersByRole: Record<string, number> = {};
    for (const user of activeUsers) {
      for (const role of user.roles) {
        usersByRole[role] = (usersByRole[role] || 0) + 1;
      }
    }

    let dbStatus = "OK";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "DOWN";
    }

    res.json({
      activeUsers: activeUsersCount,
      usersByRole,
      systemStatus: dbStatus,
    });
  } catch (error: unknown) {
    res.status(500).json({ message: errorMessage(error) });
  }
}

async function getRecordCounts() {
  const [
    users,
    schoolYears,
    gradeLevels,
    sections,
    applications,
    enrollments,
    auditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.schoolYear.count(),
    prisma.gradeLevel.count(),
    prisma.section.count(),
    prisma.enrollmentApplication.count(),
    prisma.enrollmentRecord.count(),
    prisma.auditLog.count(),
  ]);

  return {
    users,
    schoolYears,
    gradeLevels,
    sections,
    applications,
    enrollments,
    auditLogs,
  };
}
