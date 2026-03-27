import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { prisma } from '../../lib/prisma.js';
import { auditLog } from '../audit-logs/audit-logs.service.js';

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function csvEscape(value: unknown): string {
  const raw = value == null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function index(req: Request, res: Response) {
  try {
    const { status, trigger, dateFrom, dateTo, page = '1', limit = '20' } = req.query;
    const pageNum = parsePositiveInt(page);
    const limitNum = parsePositiveInt(limit);
    if (!pageNum || !limitNum) {
      return res.status(400).json({ message: 'page and limit must be positive integers' });
    }
    const fromDate = parseOptionalDate(dateFrom);
    const toDate = parseOptionalDate(dateTo);
    if ((dateFrom && !fromDate) || (dateTo && !toDate)) {
      return res.status(400).json({ message: 'dateFrom/dateTo must be valid dates' });
    }
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status) where.status = status;
    if (trigger) where.trigger = trigger;
    if (fromDate || toDate) {
      where.attemptedAt = {};
      if (fromDate) where.attemptedAt.gte = fromDate;
      if (toDate) where.attemptedAt.lte = toDate;
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
        take: limitNum,
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({ logs, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function show(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: 'Invalid email log id' });
    }

    const log = await prisma.emailLog.findUnique({
      where: { id },
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
    const logId = parsePositiveInt(req.params.id);
    if (!logId) {
      return res.status(400).json({ message: 'Invalid email log id' });
    }

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
      recordId: newLog.id,
      req,
    });

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number.parseInt(process.env.SMTP_PORT ?? '', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromAddress = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpPort || !fromAddress || !smtpUser || !smtpPass) {
      await prisma.emailLog.update({
        where: { id: newLog.id },
        data: {
          status: 'FAILED',
          errorMessage: 'SMTP configuration missing',
        },
      });
      return res.status(503).json({
        message: 'Email service is not configured (missing SMTP settings)',
        newLogId: newLog.id,
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: originalLog.recipient,
        subject: originalLog.subject,
        text: `This is a resend for "${originalLog.subject}".`,
      });

      await prisma.emailLog.update({
        where: { id: newLog.id },
        data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
      });
    } catch (mailError: any) {
      await prisma.emailLog.update({
        where: { id: newLog.id },
        data: {
          status: 'FAILED',
          errorMessage: mailError?.message || 'Unknown email send failure',
        },
      });

      return res.status(502).json({
        message: 'Failed to resend email',
        newLogId: newLog.id,
      });
    }

    res.json({ message: 'Email resent successfully', newLogId: newLog.id });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const { status, trigger, dateFrom, dateTo } = req.query;
    const fromDate = parseOptionalDate(dateFrom);
    const toDate = parseOptionalDate(dateTo);
    if ((dateFrom && !fromDate) || (dateTo && !toDate)) {
      return res.status(400).json({ message: 'dateFrom/dateTo must be valid dates' });
    }

    const where: any = {};
    if (status) where.status = status;
    if (trigger) where.trigger = trigger;
    if (fromDate || toDate) {
      where.attemptedAt = {};
      if (fromDate) where.attemptedAt.gte = fromDate;
      if (toDate) where.attemptedAt.lte = toDate;
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
          csvEscape(log.recipient),
          csvEscape(log.subject),
          log.trigger,
          log.status,
          log.attemptedAt.toISOString(),
          log.sentAt?.toISOString() || '',
          csvEscape(log.applicant?.trackingNumber || ''),
          csvEscape(log.errorMessage || ''),
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
