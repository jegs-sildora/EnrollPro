import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export async function index(req: Request, res: Response) {
  try {
    const { actionType, dateFrom, dateTo, userId, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};

    // Filter out ADMIN_* action types for non-admin users
    if (req.user!.role !== 'SYSTEM_ADMIN') {
      where.actionType = { notIn: ['ADMIN_USER_CREATED', 'ADMIN_USER_UPDATED', 'ADMIN_USER_DEACTIVATED', 'ADMIN_USER_REACTIVATED', 'ADMIN_PASSWORD_RESET', 'ADMIN_EMAIL_RESENT'] };
    }

    if (actionType) where.actionType = actionType;
    if (userId && req.user!.role === 'SYSTEM_ADMIN') {
      where.userId = parseInt(userId as string);
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    if (req.user!.role !== 'SYSTEM_ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { actionType, dateFrom, dateTo, userId } = req.query;

    const where: any = {};
    if (actionType) where.actionType = actionType;
    if (userId) where.userId = parseInt(userId as string);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const csv = [
      'Timestamp,User,Role,Action Type,Description,IP Address,User Agent',
      ...logs.map((log) => {
        const userName = log.user 
          ? `"${log.user.lastName}, ${log.user.firstName}"`
          : '"System/Guest"';
        return [
          log.createdAt.toISOString(),
          userName,
          log.user?.role || '',
          log.actionType,
          `"${log.description}"`,
          log.ipAddress,
          `"${log.userAgent || ''}"`,
        ].join(',');
      }),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
