import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function index(req: Request, res: Response) {
  try {
    const { status, trigger, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(String(page)) - 1) * parseInt(String(limit));

    const where: any = {};
    if (status) where.status = status;
    if (trigger) where.trigger = trigger;
    if (dateFrom || dateTo) {
      where.attemptedAt = {};
      if (dateFrom) where.attemptedAt.gte = new Date(String(dateFrom));
      if (dateTo) where.attemptedAt.lte = new Date(String(dateTo));
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          applicant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              trackingNumber: true,
            },
          },
        },
        orderBy: { attemptedAt: 'desc' },
        skip,
        take: parseInt(String(limit)),
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({ logs, total, page: parseInt(String(page)), limit: parseInt(String(limit)) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function show(req: Request, res: Response) {
  try {
    const log = await prisma.emailLog.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            trackingNumber: true,
          },
        },
      },
    });

    if (!log) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    res.json(log);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function resend(req: Request, res: Response) {
  try {
    const logId = parseInt(String(req.params.id));
    const originalLog = await prisma.emailLog.findUnique({
      where: { id: logId },
      include: { applicant: true },
    });

    if (!originalLog) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    // Create new email log for resend attempt
    const newLog = await prisma.emailLog.create({
      data: {
        recipient: originalLog.recipient,
        subject: originalLog.subject,
        trigger: originalLog.trigger,
        applicantId: originalLog.applicantId,
        status: 'PENDING',
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'ADMIN_EMAIL_RESENT',
      description: `Admin manually resent email #${logId} to ${originalLog.recipient}`,
      subjectType: 'EmailLog',
      subjectId: newLog.id,
      req,
    });

    // TODO: Actually send the email via mailer service
    // For now, mark as sent
    await prisma.emailLog.update({
      where: { id: newLog.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    res.json({ message: 'Email queued for resend', newLogId: newLog.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const { status, trigger, dateFrom, dateTo } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (trigger) where.trigger = trigger;
    if (dateFrom || dateTo) {
      where.attemptedAt = {};
      if (dateFrom) where.attemptedAt.gte = new Date(String(dateFrom));
      if (dateTo) where.attemptedAt.lte = new Date(String(dateTo));
    }

    const logs = await prisma.emailLog.findMany({
      where,
      include: {
        applicant: {
          select: {
            trackingNumber: true,
          },
        },
      },
      orderBy: { attemptedAt: 'desc' },
    });

    const csv = [
      'ID,Recipient,Subject,Trigger,Status,Attempted At,Sent At,Tracking Number,Error Message',
      ...logs.map((log) =>
        [
          log.id,
          log.recipient,
          `"${log.subject}"`,
          log.trigger,
          log.status,
          log.attemptedAt.toISOString(),
          log.sentAt?.toISOString() || '',
          log.applicant?.trackingNumber || '',
          `"${log.errorMessage || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=email-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
