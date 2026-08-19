import { prisma } from "../../../lib/prisma.js";
import type { Request, Response } from "express";
import { broadcastSchoolYearInvalidation } from "../../../lib/realtime-events.js";



function parseSchoolYearId(req: Request): number {
  return Number.parseInt(String(req.params.id ?? ""), 10);
}


  export async function transitionSchoolYear(
    req: Request,
    res: Response): Promise<void> {
    void req;
    res.status(409).json({
      code: "ROLLOVER_REQUIRED",
      message:
        "School year status cannot be changed directly. Initial setup uses activation; later years use atomic rollover.",
    });
  }

  export async function deleteSchoolYear(req: Request, res: Response): Promise<void> {
    const id = parseSchoolYearId(req);

    const year = await prisma.schoolYear.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sections: true,
            enrollmentApplications: true,
            enrollmentRecords: true,
            enrollmentHistories: true,
            sectionAdvisers: true,
            teacherDesignations: true,
            teacherSchedulePeriods: true,
            healthRecords: true,
            schoolFormArtifacts: true,
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

    if (Object.values(year._count).some((count) => count > 0)) {
      res
        .status(400)
        .json({ message: "Cannot delete a school year that contains operational or historical records." });
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

