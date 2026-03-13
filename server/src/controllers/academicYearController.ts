import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { auditLog } from '../services/auditLogger.js';
import {
  deriveAcademicYearScheduleFromOpeningDate,
  deriveNextAcademicYear,
  normalizeDateToUtcNoon,
} from '../services/academicYearService.js';

const MANILA_TIME_ZONE = 'Asia/Manila';

function parseDateInput(value: unknown): Date | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getCurrentManilaYear(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date());

  return Number(parts.find((part) => part.type === 'year')?.value ?? new Date().getFullYear());
}

export async function listAcademicYears(_req: Request, res: Response): Promise<void> {
  const years = await prisma.academicYear.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { gradeLevels: true, strands: true, applicants: true, enrollments: true } },
    },
  });
  res.json({ years });
}

export async function getNextDefaults(req: Request, res: Response): Promise<void> {
  const defaults = deriveNextAcademicYear(new Date());
  res.json(defaults);
}

export async function getAcademicYear(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const year = await prisma.academicYear.findUnique({
    where: { id },
    include: {
      gradeLevels: { orderBy: { displayOrder: 'asc' }, include: { sections: { include: { _count: { select: { enrollments: true } } } } } },
      strands: true,
      _count: { select: { applicants: true, enrollments: true } },
    },
  });
  if (!year) {
    res.status(404).json({ message: 'School year not found' });
    return;
  }
  res.json({ year });
}

export async function createAcademicYear(req: Request, res: Response): Promise<void> {
  const { 
    classOpeningDate, 
    classEndDate, 
    cloneFromId 
  } = req.body;

  const parsedOpeningDate = parseDateInput(classOpeningDate);
  if (!parsedOpeningDate) {
    res.status(400).json({ message: 'A valid classOpeningDate is required' });
    return;
  }

  const normalizedOpeningDate = normalizeDateToUtcNoon(parsedOpeningDate);
  const openingYear = normalizedOpeningDate.getUTCFullYear();
  const currentManilaYear = getCurrentManilaYear();

  if (openingYear < currentManilaYear || openingYear > currentManilaYear + 1) {
    res.status(400).json({
      message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
    });
    return;
  }

  const parsedClassEndDate = classEndDate ? parseDateInput(classEndDate) : null;
  if (classEndDate && !parsedClassEndDate) {
    res.status(400).json({ message: 'classEndDate must be a valid date' });
    return;
  }

  const schedule = deriveAcademicYearScheduleFromOpeningDate(
    normalizedOpeningDate,
    parsedClassEndDate ? normalizeDateToUtcNoon(parsedClassEndDate) : undefined
  );

  const existing = await prisma.academicYear.findUnique({ where: { yearLabel: schedule.yearLabel } });
  if (existing) {
    res.status(400).json({ message: 'A school year with this label already exists' });
    return;
  }

  // Deactivate others
  await prisma.academicYear.updateMany({
    where: { status: 'ACTIVE' },
    data: { status: 'ARCHIVED', isActive: false },
  });

  const year = await prisma.academicYear.create({
    data: {
      yearLabel: schedule.yearLabel,
      status: 'ACTIVE',
      isActive: true,
      classOpeningDate: schedule.classOpeningDate,
      classEndDate: schedule.classEndDate,
      earlyRegOpenDate: schedule.earlyRegOpenDate,
      earlyRegCloseDate: schedule.earlyRegCloseDate,
      enrollOpenDate: schedule.enrollOpenDate,
      enrollCloseDate: schedule.enrollCloseDate,
      clonedFromId: cloneFromId ?? null,
    },
  });

  const settings = await prisma.schoolSettings.findFirst();
  if (settings) {
    await prisma.schoolSettings.update({
      where: { id: settings.id },
      data: { activeAcademicYearId: year.id },
    });
  }

  // Clone structure if requested
  if (cloneFromId) {
    const source = await prisma.academicYear.findUnique({
      where: { id: cloneFromId },
      include: {
        gradeLevels: { include: { sections: true } },
        strands: true,
      },
    });

    if (source) {
      const gradeLevelIdMap = new Map<number, number>();

      for (const gl of source.gradeLevels) {
        const newGl = await prisma.gradeLevel.create({
          data: {
            name: gl.name,
            displayOrder: gl.displayOrder,
            academicYearId: year.id,
          },
        });
        gradeLevelIdMap.set(gl.id, newGl.id);

        for (const sec of gl.sections) {
          await prisma.section.create({
            data: {
              name: sec.name,
              maxCapacity: sec.maxCapacity,
              gradeLevelId: newGl.id,
            },
          });
        }
      }

      for (const strand of source.strands) {
        await prisma.strand.create({
          data: {
            name: strand.name,
            applicableGradeLevelIds: strand.applicableGradeLevelIds
              .map((id) => gradeLevelIdMap.get(id))
              .filter((id): id is number => id !== undefined),
            academicYearId: year.id,
          },
        });
      }
    }
  }

  await auditLog({
    userId: req.user!.userId,
    actionType: 'AY_CREATED',
    description: `Created and activated school year "${schedule.yearLabel}"${cloneFromId ? ` (cloned from ID ${cloneFromId})` : ''}`,
    subjectType: 'AcademicYear',
    subjectId: year.id,
    req,
  });

  const full = await prisma.academicYear.findUnique({
    where: { id: year.id },
    include: {
      gradeLevels: { orderBy: { displayOrder: 'asc' } },
      strands: true,
      _count: { select: { applicants: true, enrollments: true } },
    },
  });

  res.status(201).json({ year: full });
}

export async function toggleOverride(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { manualOverrideOpen } = req.body;

  const updated = await prisma.academicYear.update({
    where: { id },
    data: { manualOverrideOpen },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'ENROLLMENT_OVERRIDE_TOGGLED',
    description: `Manual override set to ${manualOverrideOpen ? 'OPEN' : 'OFF'} for year "${updated.yearLabel}"`,
    subjectType: 'AcademicYear',
    subjectId: id,
    req,
  });

  res.json({ year: updated });
}

export async function updateDates(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { earlyRegOpenDate, earlyRegCloseDate, enrollOpenDate, enrollCloseDate } = req.body;

  const updated = await prisma.academicYear.update({
    where: { id },
    data: {
      ...(earlyRegOpenDate !== undefined ? { earlyRegOpenDate: earlyRegOpenDate ? new Date(earlyRegOpenDate) : null } : {}),
      ...(earlyRegCloseDate !== undefined ? { earlyRegCloseDate: earlyRegCloseDate ? new Date(earlyRegCloseDate) : null } : {}),
      ...(enrollOpenDate !== undefined ? { enrollOpenDate: enrollOpenDate ? new Date(enrollOpenDate) : null } : {}),
      ...(enrollCloseDate !== undefined ? { enrollCloseDate: enrollCloseDate ? new Date(enrollCloseDate) : null } : {}),
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'ENROLLMENT_DATES_UPDATED',
    description: `Updated enrollment dates for "${updated.yearLabel}"`,
    subjectType: 'AcademicYear',
    subjectId: id,
    req,
  });

  res.json({ year: updated });
}

export async function updateAcademicYear(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { yearLabel } = req.body;

  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) {
    res.status(404).json({ message: 'School year not found' });
    return;
  }

  if (year.status === 'ARCHIVED') {
    res.status(400).json({ message: 'Cannot edit an archived school year' });
    return;
  }

  const updated = await prisma.academicYear.update({
    where: { id },
    data: {
      ...(yearLabel ? { yearLabel } : {}),
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'AY_UPDATED',
    description: `Updated school year "${updated.yearLabel}"`,
    subjectType: 'AcademicYear',
    subjectId: id,
    req,
  });

  res.json({ year: updated });
}

export async function transitionAcademicYear(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { status } = req.body;

  const validStatuses = ['DRAFT', 'UPCOMING', 'ACTIVE', 'ARCHIVED'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    return;
  }

  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) {
    res.status(404).json({ message: 'School year not found' });
    return;
  }

  // If setting to ACTIVE, deactivate all others and update settings
  if (status === 'ACTIVE') {
    await prisma.academicYear.updateMany({
      where: { status: 'ACTIVE', id: { not: id } },
      data: { status: 'ARCHIVED', isActive: false },
    });

    await prisma.academicYear.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });

    // Also update SchoolSettings
    const settings = await prisma.schoolSettings.findFirst();
    if (settings) {
      await prisma.schoolSettings.update({
        where: { id: settings.id },
        data: { activeAcademicYearId: id },
      });
    }
  } else {
    await prisma.academicYear.update({
      where: { id },
      data: {
        status,
        isActive: false,
      },
    });

    // If was active, clear settings
    if (year.isActive) {
      const settings = await prisma.schoolSettings.findFirst();
      if (settings && settings.activeAcademicYearId === id) {
        await prisma.schoolSettings.update({
          where: { id: settings.id },
          data: { activeAcademicYearId: null },
        });
      }
    }
  }

  await auditLog({
    userId: req.user!.userId,
    actionType: 'AY_STATUS_CHANGED',
    description: `School year "${year.yearLabel}" status changed to ${status}`,
    subjectType: 'AcademicYear',
    subjectId: id,
    req,
  });

  const updated = await prisma.academicYear.findUnique({ where: { id } });
  res.json({ year: updated });
}

export async function deleteAcademicYear(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id as string);

  const year = await prisma.academicYear.findUnique({
    where: { id },
    include: { _count: { select: { applicants: true, enrollments: true } } },
  });

  if (!year) {
    res.status(404).json({ message: 'School year not found' });
    return;
  }

  if (year.status === 'ACTIVE') {
    res.status(400).json({ message: 'Cannot delete the active school year' });
    return;
  }

  if (year._count.applicants > 0 || year._count.enrollments > 0) {
    res.status(400).json({ message: 'Cannot delete a school year with existing records' });
    return;
  }

  await prisma.academicYear.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: 'AY_DELETED',
    description: `Deleted school year "${year.yearLabel}"`,
    subjectType: 'AcademicYear',
    subjectId: id,
    req,
  });

  res.json({ message: 'School year deleted' });
}
