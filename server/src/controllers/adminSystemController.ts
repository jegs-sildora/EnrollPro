import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import os from 'os';

export async function health(req: Request, res: Response) {
  try {
    // Database connectivity check
    let dbStatus = 'OK';
    let dbAvgQuery = 0;
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbAvgQuery = Date.now() - start;
    } catch {
      dbStatus = 'DOWN';
    }

    // Email service check (basic)
    const emailStatus = process.env.RESEND_API_KEY ? 'OK' : 'DEGRADED';

    // Email delivery rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalEmails, sentEmails] = await Promise.all([
      prisma.emailLog.count({
        where: { attemptedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.emailLog.count({
        where: {
          attemptedAt: { gte: thirtyDaysAgo },
          status: 'SENT',
        },
      }),
    ]);

    const deliveryRate = totalEmails > 0 ? ((sentEmails / totalEmails) * 100).toFixed(1) : '0.0';

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
      email: { status: emailStatus, deliveryRate, totalEmails, sentEmails },
      storage: { status: 'OK' },
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
    const activeUsersCount = await prisma.user.count({ where: { isActive: true } });
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      where: { isActive: true },
      _count: true,
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalEmails, sentEmails] = await Promise.all([
      prisma.emailLog.count({ where: { attemptedAt: { gte: thirtyDaysAgo } } }),
      prisma.emailLog.count({ where: { attemptedAt: { gte: thirtyDaysAgo }, status: 'SENT' } }),
    ]);

    const deliveryRate = totalEmails > 0 ? ((sentEmails / totalEmails) * 100).toFixed(1) : '0.0';

    let dbStatus = 'OK';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'DOWN';
    }

    res.json({
      activeUsers: activeUsersCount,
      usersByRole: usersByRole.reduce((acc: any, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {}),
      emailDeliveryRate: deliveryRate,
      emailStats: { total: totalEmails, sent: sentEmails },
      systemStatus: dbStatus,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getRecordCounts() {
  const [
    users,
    academicYears,
    gradeLevels,
    strands,
    sections,
    applications,
    enrollments,
    emailLogs,
    auditLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.academicYear.count(),
    prisma.gradeLevel.count(),
    prisma.strand.count(),
    prisma.section.count(),
    prisma.applicant.count(),
    prisma.enrollment.count(),
    prisma.emailLog.count(),
    prisma.auditLog.count(),
  ]);

  return {
    users,
    academicYears,
    gradeLevels,
    strands,
    sections,
    applications,
    enrollments,
    emailLogs,
    auditLogs,
  };
}
