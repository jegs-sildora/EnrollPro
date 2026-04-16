import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

const VALID_PROGRAM_TYPES = new Set([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);

export async function listSections(req: Request, res: Response): Promise<void> {
  const ayId = req.params.ayId ? parseInt(req.params.ayId as string) : null;
  const { gradeLevelId, programType } = req.query;

  const normalizedProgramType =
    typeof programType === "string" ? programType : undefined;
  if (
    normalizedProgramType &&
    !VALID_PROGRAM_TYPES.has(normalizedProgramType)
  ) {
    res.status(400).json({ message: "Invalid programType filter" });
    return;
  }

  if (gradeLevelId) {
    const where: Record<string, any> = {
      gradeLevelId: parseInt(gradeLevelId as string),
    };
    if (normalizedProgramType) {
      where.programType = normalizedProgramType;
    }

    const sections = await prisma.section.findMany({
      where,
      include: {
        advisingTeacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        _count: { select: { enrollmentRecords: true } },
      },
      orderBy: { name: "asc" },
    });
    // Format teacher names
    const formatted = sections.map((s) => ({
      ...s,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    }));
    res.json({ sections: formatted });
    return;
  }

  if (!ayId) {
    res
      .status(400)
      .json({ message: "School Year ID or Grade Level ID is required" });
    return;
  }

  const whereClause: any = { schoolYearId: ayId };

  const gradeLevels = await prisma.gradeLevel.findMany({
    where: whereClause,
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        ...(normalizedProgramType
          ? { where: { programType: normalizedProgramType as any } }
          : {}),
        orderBy: { name: "asc" },
        include: {
          advisingTeacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
          _count: { select: { enrollmentRecords: true } },
        },
      },
    },
  });

  const result = gradeLevels.map((gl) => ({
    gradeLevelId: gl.id,
    gradeLevelName: gl.name,
    displayOrder: gl.displayOrder,
    sections: gl.sections.map((s) => ({
      id: s.id,
      name: s.name,
      programType: s.programType,
      maxCapacity: s.maxCapacity,
      enrolledCount: s._count.enrollmentRecords,
      fillPercent:
        s.maxCapacity > 0
          ? Math.round((s._count.enrollmentRecords / s.maxCapacity) * 100)
          : 0,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    })),
  }));

  res.json({ gradeLevels: result });
}

export async function listTeachers(req: Request, res: Response): Promise<void> {
  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      employeeId: true,
    },
    orderBy: { lastName: "asc" },
  });
  // Format the name for display in dropdowns
  const formatted = teachers.map((t) => ({
    id: t.id,
    name: `${t.lastName}, ${t.firstName}${t.middleName ? ` ${t.middleName.charAt(0)}.` : ""}`,
    employeeId: t.employeeId,
  }));
  res.json({ teachers: formatted });
}

export async function createSection(
  req: Request,
  res: Response,
): Promise<void> {
  const { name, maxCapacity, gradeLevelId, programType, advisingTeacherId } =
    req.body;

  if (!name || !gradeLevelId) {
    res.status(400).json({ message: "name and gradeLevelId are required" });
    return;
  }

  const section = await prisma.section.create({
    data: {
      name,
      maxCapacity: maxCapacity ?? 40,
      gradeLevelId,
      programType: programType ?? "REGULAR",
      advisingTeacherId: advisingTeacherId ?? null,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_CREATED",
    description: `Created section "${name}"`,
    subjectType: "Section",
    recordId: section.id,
    req,
  });

  res.status(201).json({ section });
}

export async function updateSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const { name, maxCapacity, programType, advisingTeacherId } = req.body;

  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const updated = await prisma.section.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(maxCapacity !== undefined ? { maxCapacity } : {}),
      ...(programType !== undefined ? { programType } : {}),
      ...(advisingTeacherId !== undefined
        ? { advisingTeacherId: advisingTeacherId || null }
        : {}),
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_UPDATED",
    description: `Updated section "${updated.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ section: updated });
}

export async function deleteSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);

  const section = await prisma.section.findUnique({
    where: { id },
    include: { _count: { select: { enrollmentRecords: true } } },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  if (section._count.enrollmentRecords > 0) {
    res
      .status(400)
      .json({ message: "Cannot delete a section with enrolled students" });
    return;
  }

  await prisma.section.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_DELETED",
    description: `Deleted section "${section.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ message: "Section deleted" });
}
