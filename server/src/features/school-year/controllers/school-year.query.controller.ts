import { deriveNextSchoolYear } from "../school-year.service.js";
import { prisma } from "../../../lib/prisma.js";
import type { Request, Response } from "express";
import { getSystemDate } from "../../../lib/date-wrapper.js";


function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

function parseSchoolYearIdFromQuery(req: Request): number | null {
  const raw = req.query.schoolYearId;
  if (raw == null || raw === "") return null;

  const parsed = Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) ? parsed : null;
}


  export async function listGradeLevels(req: Request, res: Response): Promise<void> {
    const schoolYearId = parseSchoolYearIdFromQuery(req) ?? req.schoolYearId ?? null;

    if (!schoolYearId) {
      res.status(422).json({ message: "No active school year found." });
      return;
    }

    const gradeLevels = await prisma.gradeLevel.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, displayOrder: true },
    });

    res.json({ gradeLevels, schoolYearId });
  }

  export async function listSchoolYears(_req: Request, res: Response): Promise<void> {
    const years = await prisma.schoolYear.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sections: true,
            enrollmentApplications: true,
            enrollmentRecords: true,
          },
        },
        sections: {
          where: { isEosyFinalized: false },
          select: { id: true },
        },
      },
    });

    res.json({ years });
  }

  export async function getNextDefaults(req: Request, res: Response): Promise<void> {
    const defaults = deriveNextSchoolYear(new Date());
    res.json(defaults);
  }

  export async function getSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const year = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: [{ gradeLevel: { displayOrder: "asc" } }, { sortOrder: "asc" }],
          include: {
            gradeLevel: true,
            _count: { select: { enrollmentRecords: true } },
          },
        },
        _count: {
          select: {
            enrollmentApplications: true,
            enrollmentRecords: true,
          },
        },
      },
    });

    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    res.json({ year });
  }

  export async function getActiveSchoolYearTerm(req: Request, res: Response): Promise<void> {
    const schoolYearId = parseSchoolYearIdFromQuery(req) ?? req.schoolYearId;
    if (!schoolYearId) {
      res.status(422).json({ message: "No active school year found." });
      return;
    }

    const year = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
    });

    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    try {
      const { buildOrderedTermContract, resolveActiveTermEntry } = await import("../services/term-contract.service.js");
      const terms = buildOrderedTermContract({
        termFormat: year.termFormat as any,
        term1Start: year.term1Start,
        term1End: year.term1End,
        term2Start: year.term2Start,
        term2End: year.term2End,
        term3Start: year.term3Start,
        term3End: year.term3End,
        term4Start: year.term4Start,
        term4End: year.term4End,
        term1Label: year.term1Label,
        term2Label: year.term2Label,
        term3Label: year.term3Label,
        term4Label: year.term4Label,
      });

      const activeTerm = resolveActiveTermEntry(terms, getSystemDate(req));
      res.json({ 
        activeTerm: activeTerm.identity, 
        activeTermLabel: activeTerm.displayLabel,
        isGradingLocked: activeTerm.isGradingLocked,
      });
    } catch (error) {
      // If terms are not fully configured yet, we can safely return null or default to T1
      res.json({ activeTerm: "T1", activeTermLabel: "Term 1", isGradingLocked: false });
    }
  }

