import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';

export async function index(req: Request, res: Response) {
  try {
    const { search, gradeLevelId, status, applicantType, page = '1', limit = '15' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { lrn: { contains: String(search), mode: 'insensitive' } },
        { firstName: { contains: String(search), mode: 'insensitive' } },
        { lastName: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (gradeLevelId) where.gradeLevelId = parseInt(String(gradeLevelId));
    if (status) where.status = status;
    if (applicantType) where.applicantType = applicantType;

    const [applications, total] = await Promise.all([
      prisma.applicant.findMany({
        where,
        include: {
          gradeLevel: true,
          strand: true,
          enrollment: { include: { section: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.applicant.count({ where }),
    ]);

    res.json({ applications, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function show(req: Request, res: Response) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        gradeLevel: true,
        strand: true,
        academicYear: true,
        enrollment: { include: { section: true, enrolledBy: { select: { name: true } } } },
      },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function store(req: Request, res: Response) {
  try {
    const settings = await prisma.schoolSettings.findFirst();
    const activeYear = settings?.activeAcademicYearId
      ? await prisma.academicYear.findUnique({ where: { id: settings.activeAcademicYearId } })
      : null;

    if (!activeYear) {
      return res.status(400).json({ message: 'No active academic year configured' });
    }

    const year = new Date().getFullYear();
    const applicant = await prisma.applicant.create({
      data: {
        ...req.body,
        academicYearId: activeYear.id,
        trackingNumber: `HNS-${year}-TEMP`,
      },
    });

    const trackingNumber = `HNS-${year}-${String(applicant.id).padStart(5, '0')}`;
    const updated = await prisma.applicant.update({
      where: { id: applicant.id },
      data: { trackingNumber },
    });

    await auditLog({
      userId: null,
      actionType: 'APPLICATION_SUBMITTED',
      description: `Guest submitted application for ${updated.firstName} ${updated.lastName} (LRN: ${updated.lrn}). Tracking: ${trackingNumber}`,
      subjectType: 'Applicant',
      subjectId: updated.id,
      req,
    });

    res.status(201).json({ trackingNumber: updated.trackingNumber });

    // TODO: Send email asynchronously
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function track(req: Request, res: Response) {
  try {
    const application = await prisma.applicant.findUnique({
      where: { trackingNumber: String(req.params.trackingNumber) },
      include: {
        gradeLevel: true,
        strand: true,
        enrollment: { include: { section: true } },
      },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function approve(req: Request, res: Response) {
  try {
    const { sectionId } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const applicant = await prisma.applicant.findUnique({ where: { id: applicantId } });
    if (!applicant) {
      return res.status(404).json({ message: 'Applicant not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [section] = await tx.$queryRaw<any[]>`
        SELECT id, "maxCapacity" FROM "Section" WHERE id = ${sectionId} FOR UPDATE
      `;

      if (!section) throw new Error('Section not found');

      const enrolledCount = await tx.enrollment.count({ where: { sectionId } });
      if (enrolledCount >= section.maxCapacity) {
        throw new Error('This section has reached maximum capacity');
      }

      const enrollment = await tx.enrollment.create({
        data: {
          applicantId,
          sectionId,
          academicYearId: applicant.academicYearId,
          enrolledById: req.user!.userId,
        },
      });

      await tx.applicant.update({
        where: { id: applicantId },
        data: { status: 'APPROVED' },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'APPLICATION_APPROVED',
      description: `Approved application #${applicantId} and enrolled to section`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(result);
  } catch (error: any) {
    res.status(422).json({ message: error.message });
  }
}

export async function reject(req: Request, res: Response) {
  try {
    const { rejectionReason } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: 'REJECTED', rejectionReason: rejectionReason || undefined },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'APPLICATION_REJECTED',
      description: `Rejected application #${applicantId}. Reason: ${rejectionReason || 'N/A'}`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function scheduleExam(req: Request, res: Response) {
  try {
    const { examDate, assessmentType } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: 'EXAM_SCHEDULED', examDate, assessmentType },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'EXAM_SCHEDULED',
      description: `Scheduled ${assessmentType} for applicant #${applicantId} on ${examDate}`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function recordResult(req: Request, res: Response) {
  try {
    const { examScore, examResult, examNotes, interviewResult } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: 'EXAM_TAKEN', examScore, examResult, examNotes, interviewResult },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'EXAM_RESULT_RECORDED',
      description: `Recorded result for applicant #${applicantId}: ${examResult} (Score: ${examScore || 'N/A'})`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function pass(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: 'PASSED' },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'APPLICATION_PASSED',
      description: `Marked applicant #${applicantId} as PASSED - ready for section assignment`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function fail(req: Request, res: Response) {
  try {
    const { examNotes } = req.body;
    const applicantId = parseInt(String(req.params.id));

    const updated = await prisma.applicant.update({
      where: { id: applicantId },
      data: { status: 'FAILED', examNotes },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: 'APPLICATION_FAILED',
      description: `Marked applicant #${applicantId} as FAILED. Notes: ${examNotes || 'N/A'}`,
      subjectType: 'Applicant',
      subjectId: applicantId,
      req,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
