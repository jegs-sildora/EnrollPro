import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

// ─── Grade Levels ─────────────────────────────────────────

export async function listGradeLevels(
  req: Request,
  res: Response,
): Promise<void> {
  const ayId = parseInt(req.params.ayId as string);
  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        where: { schoolYearId: ayId },
        include: { _count: { select: { enrollmentRecords: true } } },
      },
    },
  });
  res.json({ gradeLevels });
}

export async function createGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const { name, displayOrder } = req.body;
  if (!name) {
    res.status(400).json({ message: "Name is required" });
    return;
  }
  const count = await prisma.gradeLevel.count();
  const gl = await prisma.gradeLevel.create({
    data: { name, displayOrder: displayOrder ?? count + 1 },
  });
  await auditLog({
    userId: req.user!.userId,
    actionType: "GRADE_LEVEL_CREATED",
    description: `Created grade level "${name}"`,
    subjectType: "GradeLevel",
    recordId: gl.id,
    req,
  });
  res.status(201).json({ gradeLevel: gl });
}

export async function updateGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, displayOrder } = req.body;
  const gl = await prisma.gradeLevel.findUnique({ where: { id } });
  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }
  const updated = await prisma.gradeLevel.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
  });
  res.json({ gradeLevel: updated });
}

export async function deleteGradeLevel(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const gl = await prisma.gradeLevel.findUnique({
    where: { id },
    include: {
      _count: { select: { sections: true, enrollmentApplications: true } },
    },
  });
  if (!gl) {
    res.status(404).json({ message: "Grade level not found" });
    return;
  }
  if (gl._count.enrollmentApplications > 0) {
    res
      .status(400)
      .json({
        message: "Cannot delete a grade level with existing applicants",
      });
    return;
  }
  await prisma.gradeLevel.delete({ where: { id } });
  await auditLog({
    userId: req.user!.userId,
    actionType: "GRADE_LEVEL_DELETED",
    description: `Deleted grade level "${gl.name}"`,
    subjectType: "GradeLevel",
    recordId: id,
    req,
  });
  res.json({ message: "Grade level deleted" });
}
