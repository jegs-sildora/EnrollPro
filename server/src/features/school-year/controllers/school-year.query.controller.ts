import type { Request, Response } from "express";
import {
  createSchoolYearControllerDeps,
  SchoolYearControllerDeps,
} from "../services/school-year-controller.deps.js";

function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

function parseSchoolYearIdFromQuery(req: Request): number | null {
  const raw = req.query.schoolYearId;
  if (raw == null || raw === "") return null;

  const parsed = Number.parseInt(String(raw), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function createSchoolYearQueryController(
  deps: SchoolYearControllerDeps = createSchoolYearControllerDeps(),
) {
  async function listGradeLevels(req: Request, res: Response): Promise<void> {
    let schoolYearId = parseSchoolYearIdFromQuery(req);

    if (!schoolYearId) {
      const setting = await deps.prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      schoolYearId = setting?.activeSchoolYearId ?? null;
    }

    if (!schoolYearId) {
      const activeYear = await deps.prisma.schoolYear.findFirst({
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

    const gradeLevels = await deps.prisma.gradeLevel.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, displayOrder: true },
    });

    res.json({ gradeLevels, schoolYearId });
  }

  async function listSchoolYears(_req: Request, res: Response): Promise<void> {
    const years = await deps.prisma.schoolYear.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            sections: true,
            earlyRegistrationApplications: true,
            enrollmentApplications: true,
            enrollmentRecords: true,
          },
        },
      },
    });

    res.json({ years });
  }

  async function getNextDefaults(req: Request, res: Response): Promise<void> {
    const defaults = deps.deriveNextSchoolYear(new Date());
    res.json(defaults);
  }

  async function getSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const year = await deps.prisma.schoolYear.findUnique({
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
            earlyRegistrationApplications: true,
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

  return {
    listGradeLevels,
    listSchoolYears,
    getNextDefaults,
    getSchoolYear,
  };
}

const schoolYearQueryController = createSchoolYearQueryController();

export const {
  listGradeLevels,
  listSchoolYears,
  getNextDefaults,
  getSchoolYear,
} = schoolYearQueryController;
