import type { Request, Response } from "express";
import {
  createSchoolYearControllerDeps,
  SchoolYearControllerDeps,
} from "../services/school-year-controller.deps.js";
import {
  clearActiveSchoolYearIfMatches,
  ensureDefaultGradeLevels,
  setActiveSchoolYear,
} from "../services/school-year-controller-shared.service.js";

function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}

export function createSchoolYearLifecycleController(
  deps: SchoolYearControllerDeps = createSchoolYearControllerDeps(),
) {
  async function transitionSchoolYear(
    req: Request,
    res: Response,
  ): Promise<void> {
    const id = parseSchoolYearId(req);
    const { status } = req.body;

    const validStatuses = ["DRAFT", "UPCOMING", "ACTIVE", "ARCHIVED"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const year = await deps.prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (status === "ACTIVE") {
      await deps.prisma.schoolYear.updateMany({
        where: { status: "ACTIVE", id: { not: id } },
        data: { status: "ARCHIVED" },
      });

      await deps.prisma.schoolYear.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      await ensureDefaultGradeLevels(deps, id);
      await setActiveSchoolYear(deps, id);
    } else {
      await deps.prisma.schoolYear.update({
        where: { id },
        data: { status },
      });

      if (year.status === "ACTIVE") {
        await clearActiveSchoolYearIfMatches(deps, id);
      }
    }

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_STATUS_CHANGED",
      description: `School year "${year.yearLabel}" status changed to ${status}`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    const updated = await deps.prisma.schoolYear.findUnique({ where: { id } });
    res.json({ year: updated });
  }

  async function deleteSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);

    const year = await deps.prisma.schoolYear.findUnique({
      where: { id },
      include: {
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

    if (year.status === "ACTIVE") {
      res.status(400).json({
        message:
          "Active school year cannot be deleted. Complete EOSY and use rollover instead.",
      });
      return;
    }

    if (
      year._count.earlyRegistrationApplications > 0 ||
      year._count.enrollmentApplications > 0 ||
      year._count.enrollmentRecords > 0
    ) {
      res
        .status(400)
        .json({ message: "Cannot delete a school year with existing records" });
      return;
    }

    await deps.prisma.schoolYear.delete({ where: { id } });

    await deps.auditLog({
      userId: req.user!.userId,
      actionType: "SY_DELETED",
      description: `Deleted school year "${year.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      req,
    });

    res.json({ message: "School year deleted" });
  }

  return {
    transitionSchoolYear,
    deleteSchoolYear,
  };
}

const schoolYearLifecycleController = createSchoolYearLifecycleController();

export const { transitionSchoolYear, deleteSchoolYear } =
  schoolYearLifecycleController;
