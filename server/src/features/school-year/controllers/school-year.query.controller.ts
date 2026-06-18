import { clearActiveSchoolYearIfMatches, ensureDefaultGradeLevels, setActiveSchoolYear, cloneSchoolYearStructure, getCurrentManilaYear, parseDateInput } from "../services/school-year-controller-shared.service.js";

import { normalizeDateToUtcNoon, deriveNextSchoolYear } from "../school-year.service.js";
import { prisma } from "../../../lib/prisma.js";
import type { Request, Response } from "express";


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
    let schoolYearId = parseSchoolYearIdFromQuery(req);

    if (!schoolYearId) {
      const setting = await prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      schoolYearId = setting?.activeSchoolYearId ?? null;
    }

    if (!schoolYearId) {
      const activeYear = await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      schoolYearId = activeYear?.id ?? null;
    }

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

