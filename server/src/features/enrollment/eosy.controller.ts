import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

export async function getEosySections(req: Request, res: Response, next: NextFunction) {
  try {
    const { schoolYearId } = req.query;
    const sections = await prisma.section.findMany({
      where: {
        gradeLevel: {
          schoolYearId: parseInt(String(schoolYearId))
        }
      },
      include: {
        gradeLevel: true,
        _count: {
          select: { enrollmentRecords: true }
        }
      },
      orderBy: [
        { gradeLevel: { name: 'asc' } },
        { name: 'asc' }
      ]
    });
    res.json({ sections });
  } catch (error) {
    next(error);
  }
}

export async function getSectionRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId: parseInt(id) },
      include: {
        enrollmentApplication: {
          include: {
            learner: true
          }
        }
      },
      orderBy: {
        enrollmentApplication: {
          learner: {
            lastName: 'asc'
          }
        }
      }
    });
    res.json({ records });
  } catch (error) {
    next(error);
  }
}

export async function updateEosyRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { eosyStatus, dropOutReason, transferOutDate } = req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: parseInt(id) },
      include: { section: true }
    });

    if (!record) throw new AppError(404, "Enrollment record not found.");
    if (record.section.isEosyFinalized) {
      throw new AppError(422, "Cannot update status. Section is already finalized.");
    }

    const updated = await prisma.enrollmentRecord.update({
      where: { id: parseInt(id) },
      data: {
        eosyStatus: eosyStatus as any,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate: eosyStatus === "TRANSFERRED_OUT" ? (transferOutDate ? new Date(transferOutDate) : null) : null
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function finalizeSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(id);

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: true }
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_FINALIZED",
      description: `Finalized EOSY for section ${updated.name}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function reopenSection(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(id);

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: false }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function finalizeSchoolYear(req: Request, res: Response, next: NextFunction) {
  try {
    const { schoolYearId } = req.body;
    const syId = parseInt(String(schoolYearId));

    // 1. Check if all sections are finalized
    const unfinalizedSections = await prisma.section.count({
      where: {
        gradeLevel: { schoolYearId: syId },
        isEosyFinalized: false
      }
    });

    if (unfinalizedSections > 0) {
      throw new AppError(422, `Cannot finalize school EOSY. There are still ${unfinalizedSections} unfinalized sections.`);
    }

    const updated = await prisma.schoolYear.update({
      where: { id: syId },
      data: { isEosyFinalized: true }
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_FINALIZED",
      description: `Master Finalized EOSY for school year ${updated.yearLabel}`,
      subjectType: "SchoolYear",
      recordId: syId,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}
