import { clearActiveSchoolYearIfMatches, ensureDefaultGradeLevels, setActiveSchoolYear, cloneSchoolYearStructure, getCurrentManilaYear, parseDateInput } from "../services/school-year-controller-shared.service.js";

import { normalizeDateToUtcNoon } from "../school-year.service.js";
import { prisma } from "../../../lib/prisma.js";
import type { Request, Response } from "express";
import { broadcastSchoolYearInvalidation } from "../../../lib/realtime-events.js";



function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}


  export async function transitionSchoolYear(
    req: Request,
    res: Response): Promise<void> {
    const id = parseSchoolYearId(req);
    const { status } = req.body;

    const validStatuses = [
      "ACTIVE",
      "ARCHIVED",
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
      return;
    }

    const year = await prisma.schoolYear.findUnique({ where: { id } });
    if (!year) {
      res.status(404).json({ message: "School year not found" });
      return;
    }

    if (status === "ACTIVE") {
      await prisma.schoolYear.updateMany({
        where: { status: "ACTIVE", id: { not: id } },
        data: { status: "ARCHIVED" },
      });

      await prisma.schoolYear.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      await ensureDefaultGradeLevels();
      await setActiveSchoolYear( id);
    } else {
      await prisma.schoolYear.update({
        where: { id },
        data: { status },
      });

      if (year.status === "ACTIVE") {
        await clearActiveSchoolYearIfMatches( id);
      }
    }

    await prisma.auditLog.create({ data: { ipAddress: req.ip || "unknown", userAgent: req.headers["user-agent"] || null, userId: req.user!.userId,
      actionType: "SY_STATUS_CHANGED",
      description: `School year "${year.yearLabel}" status changed to ${status}`,
      subjectType: "SchoolYear",
      recordId: id,
      } });

    const updated = await prisma.schoolYear.findUnique({ where: { id } });
    broadcastSchoolYearInvalidation(id);
    res.json({ year: updated });
  }

  export async function deleteSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);

    const year = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
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

    if (year.status === "ACTIVE") {
      res.status(400).json({
        message:
          "Active school year cannot be deleted. Complete EOSY and use rollover instead.",
      });
      return;
    }

    if (
      year._count.enrollmentApplications > 0 ||
      year._count.enrollmentRecords > 0
    ) {
      res
        .status(400)
        .json({ message: "Cannot delete a school year with existing records" });
      return;
    }

    await prisma.schoolYear.delete({ where: { id } });

    await prisma.auditLog.create({ data: { ipAddress: req.ip || "unknown", userAgent: req.headers["user-agent"] || null, userId: req.user!.userId,
      actionType: "SY_DELETED",
      description: `Deleted school year "${year.yearLabel}"`,
      subjectType: "SchoolYear",
      recordId: id,
      } });

    broadcastSchoolYearInvalidation(id);

    res.json({ message: "School year deleted" });
  }

