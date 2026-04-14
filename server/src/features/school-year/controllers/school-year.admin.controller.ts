import type { Request, Response } from "express";
import {
  createSchoolYearControllerDeps,
  SchoolYearControllerDeps,
} from "../services/school-year-controller.deps.js";
import {
  cloneSchoolYearStructure,
  ensureDefaultGradeLevels,
  getCurrentManilaYear,
  parseDateInput,
  setActiveSchoolYear,
} from "../services/school-year-controller-shared.service.js";

function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

export function createSchoolYearAdminController(
  deps: SchoolYearControllerDeps = createSchoolYearControllerDeps(),
) {
  async function createSchoolYear(req: Request, res: Response): Promise<void> {
    const { classOpeningDate, classEndDate, cloneFromId } = req.body;

    const parsedOpeningDate = parseDateInput(classOpeningDate);
    if (!parsedOpeningDate) {
      res.status(400).json({ message: "A valid classOpeningDate is required" });
      return;
    }

    const normalizedOpeningDate =
      deps.normalizeDateToUtcNoon(parsedOpeningDate);
    const openingYear = normalizedOpeningDate.getUTCFullYear();
    const currentManilaYear = getCurrentManilaYear();

    if (
      openingYear < currentManilaYear ||
      openingYear > currentManilaYear + 1
    ) {
      res.status(400).json({
        message: `Class opening year must be within ${currentManilaYear} and ${currentManilaYear + 1}`,
      });
      return;
    }

    const parsedClassEndDate = classEndDate
      ? parseDateInput(classEndDate)
      : null;
    if (classEndDate && !parsedClassEndDate) {
      res.status(400).json({ message: "classEndDate must be a valid date" });
      return;
    }

    const schedule = deps.deriveSchoolYearScheduleFromOpeningDate(
      normalizedOpeningDate,
      parsedClassEndDate
        ? deps.normalizeDateToUtcNoon(parsedClassEndDate)
        : undefined,
    );

    const existing = await deps.prisma.schoolYear.findUnique({
      where: { yearLabel: schedule.yearLabel },
    });
    if (existing) {
      res
        .status(400)
        .json({ message: "A school year with this label already exists" });
      return;
    }

    await deps.prisma.schoolYear.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const normalizedCloneFromId =
      cloneFromId === null || cloneFromId === undefined
        ? null
        : Number(cloneFromId);

    const year = await deps.prisma.schoolYear.create({
      data: {
        yearLabel: schedule.yearLabel,
        status: "ACTIVE",
        classOpeningDate: schedule.classOpeningDate,
        classEndDate: schedule.classEndDate,
        earlyRegOpenDate: schedule.earlyRegOpenDate,
        earlyRegCloseDate: schedule.earlyRegCloseDate,
        enrollOpenDate: schedule.enrollOpenDate,
        enrollCloseDate: schedule.enrollCloseDate,
        clonedFromId: normalizedCloneFromId,
      },
    });

    await setActiveSchoolYear(deps, year.id);

    if (normalizedCloneFromId) {
      await cloneSchoolYearStructure(deps, normalizedCloneFromId, year.id);
    }

    await ensureDefaultGradeLevels(deps, year.id);

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_CREATED",
      description: `Created and activated school year "${schedule.yearLabel}"${normalizedCloneFromId ? ` (cloned from ID ${normalizedCloneFromId})` : ""}`,
      subjectType: "SchoolYear",
      recordId: year.id,
      req,
    });

    const full = await deps.prisma.schoolYear.findUnique({
      where: { id: year.id },
      include: {
        gradeLevels: { orderBy: { displayOrder: "asc" } },
        _count: { select: { applicants: true, enrollments: true } },
      },
    });

    res.status(201).json({ year: full });
  }

  async function toggleOverride(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { isManualOverrideOpen } = req.body;

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: { isManualOverrideOpen },
    });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_OVERRIDE_TOGGLED",
      description: `Manual override set to ${isManualOverrideOpen ? "OPEN" : "OFF"} for year "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  async function updateDates(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const {
      earlyRegOpenDate,
      earlyRegCloseDate,
      enrollOpenDate,
      enrollCloseDate,
    } = req.body;

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: {
        ...(earlyRegOpenDate !== undefined
          ? {
              earlyRegOpenDate: earlyRegOpenDate
                ? deps.normalizeDateToUtcNoon(new Date(earlyRegOpenDate))
                : null,
            }
          : {}),
        ...(earlyRegCloseDate !== undefined
          ? {
              earlyRegCloseDate: earlyRegCloseDate
                ? deps.normalizeDateToUtcNoon(new Date(earlyRegCloseDate))
                : null,
            }
          : {}),
        ...(enrollOpenDate !== undefined
          ? {
              enrollOpenDate: enrollOpenDate
                ? deps.normalizeDateToUtcNoon(new Date(enrollOpenDate))
                : null,
            }
          : {}),
        ...(enrollCloseDate !== undefined
          ? {
              enrollCloseDate: enrollCloseDate
                ? deps.normalizeDateToUtcNoon(new Date(enrollCloseDate))
                : null,
            }
          : {}),
      },
    });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "ENROLLMENT_DATES_UPDATED",
      description: `Updated enrollment dates for "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  async function updateSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { yearLabel } = req.body;

    const year = await deps.prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (year.status === "ARCHIVED") {
      res.status(400).json({ message: "Cannot edit an archived school year" });
      return;
    }

    const updated = await deps.prisma.schoolYear.update({
      where: { id },
      data: {
        ...(yearLabel ? { yearLabel } : {}),
      },
    });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_UPDATED",
      description: `Updated school year "${updated.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ year: updated });
  }

  return {
    createSchoolYear,
    toggleOverride,
    updateDates,
    updateSchoolYear,
  };
}

const schoolYearAdminController = createSchoolYearAdminController();

export const {
  createSchoolYear,
  toggleOverride,
  updateDates,
  updateSchoolYear,
} = schoolYearAdminController;
