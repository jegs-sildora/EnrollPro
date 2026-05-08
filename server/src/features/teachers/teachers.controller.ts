import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { SectionAdviserStatus } from "../../generated/prisma/index.js";

// Helper functions for data normalization
function formatTeacherName(teacher: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
}): string {
  const middleInitial = teacher.middleName
    ? ` ${teacher.middleName.charAt(0)}.`
    : "";
  return `${teacher.lastName}, ${teacher.firstName}${middleInitial}`;
}

function normalizeOptionalUpperText(val: unknown): string | null {
  if (val === undefined || val === null || val === "" || val === "__NONE__")
    return null;
  return String(val).trim().toUpperCase();
}

function normalizeOptionalText(val: unknown): string | null {
  if (val === undefined || val === null || val === "" || val === "__NONE__")
    return null;
  return String(val).trim();
}

function normalizeRequiredUpperText(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  return String(val).trim().toUpperCase();
}

function normalizeRequiredLowerEmail(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  return String(val).trim().toLowerCase();
}

function normalizeContactNumber(val: unknown): string | null {
  if (!val) return null;
  return String(val).replace(/\D/g, "").slice(0, 11);
}

function isValidContactNumber(val: unknown): boolean {
  if (!val) return true;
  const normalized = String(val).replace(/\D/g, "");
  return normalized.length === 11 || normalized.length === 0;
}

function parseDateOnly(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

type TeacherIdentityConflictField = "employeeId" | "email";

function getTeacherIdentityConflictField(
  error: unknown,
): TeacherIdentityConflictField | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const prismaLikeError = error as {
    code?: unknown;
    meta?: {
      target?: unknown;
    };
  };

  if (prismaLikeError.code !== "P2002") {
    return null;
  }

  const rawTarget = prismaLikeError.meta?.target;
  const targetTokens: string[] = Array.isArray(rawTarget)
    ? rawTarget.filter((value): value is string => typeof value === "string")
    : typeof rawTarget === "string"
      ? [rawTarget]
      : [];

  if (
    targetTokens.some(
      (token) =>
        token.includes("employee_id") || token.includes("uq_teachers_employee"),
    )
  ) {
    return "employeeId";
  }

  if (
    targetTokens.some(
      (token) => token.includes("email") || token.includes("uq_teachers_email"),
    )
  ) {
    return "email";
  }

  return null;
}

export async function index(req: Request, res: Response) {
  try {
    const schoolYearId = req.query.schoolYearId
      ? parseInt(req.query.schoolYearId as string)
      : null;

    const teachers = await prisma.teacher.findMany({
      include: {
        subjects: true,
        department: true,
        teacherDesignations: {
          where: schoolYearId ? { schoolYearId } : { id: -1 },
          include: {
            advisorySection: {
              include: {
                gradeLevel: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const formatted = teachers.map((teacher) => {
      const designation = teacher.teacherDesignations?.[0] ?? null;
      return {
        id: teacher.id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        designationTitle: teacher.designation,
        specialization: teacher.specialization,
        department: teacher.department?.code || null,
        plantillaPosition: teacher.plantillaPosition,
        photoPath: teacher.photoPath,
        subjects: teacher.subjects.map((s) => s.subject),
        isActive: teacher.isActive,
        createdAt: teacher.createdAt,
        designation: designation
          ? {
              id: designation.id,
              isClassAdviser: designation.isClassAdviser,
              advisorySectionId: designation.advisorySectionId,
              advisorySection: designation.advisorySection
                ? {
                    id: designation.advisorySection.id,
                    name: designation.advisorySection.name,
                    gradeLevelId: designation.advisorySection.gradeLevelId,
                    gradeLevelName: designation.advisorySection.gradeLevel.name,
                  }
                : null,
              ancillaryRoles: designation.ancillaryRoles,
              effectiveFrom: designation.effectiveFrom,
              effectiveTo: designation.effectiveTo,
            }
          : null,
      };
    });

    let scopeData = null;
    if (schoolYearId) {
      const sy = await prisma.schoolYear.findUnique({
        where: { id: schoolYearId },
        select: { classOpeningDate: true, classEndDate: true },
      });
      if (sy) {
        scopeData = {
          classOpeningDate: sy.classOpeningDate,
          classEndDate: sy.classEndDate,
        };
      }
    }

    res.json({ teachers: formatted, scope: scopeData });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function show(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid teacher ID" });
  }

  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { subjects: true, department: true },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      teacher: {
        ...teacher,
        designationTitle: teacher.designation,
        subjects: teacher.subjects.map((s) => s.subject),
        department: teacher.department?.code || null,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

interface TeacherUpsertPayload {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  email: string;
  employeeId: string;
  contactNumber?: string | null;
  specialization?: string | null;
  departmentCode?: string | null;
  plantillaPosition?: string | null;
  subjects?: string[];
}

export async function store(req: Request, res: Response) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      email,
      employeeId,
      contactNumber,
      specialization,
      department,
      plantillaPosition,
      subjects,
    } = req.body;

    const normalizedFirstName = normalizeRequiredUpperText(firstName);
    const normalizedLastName = normalizeRequiredUpperText(lastName);
    const normalizedEmployeeId = normalizeRequiredUpperText(employeeId);
    const normalizedEmail = normalizeRequiredLowerEmail(email);
    const normalizedContactNumber = normalizeContactNumber(contactNumber);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedEmployeeId ||
      !normalizedEmail
    ) {
      return res.status(400).json({
        message:
          "First name, last name, employee ID, and DepEd email are required",
      });
    }

    if (!isValidContactNumber(normalizedContactNumber)) {
      return res
        .status(400)
        .json({ message: "Contact number must be exactly 11 digits" });
    }

    const deptCode = normalizeOptionalUpperText(department);

    const teacher = await prisma.$transaction(async (tx) => {
      // 1. Create/Upsert the User record for system login
      // We use upsert in case a User with the same employeeId already exists
      const defaultPasswordHash = await bcrypt.hash("DepEd2026!", 10);
      
      await tx.user.upsert({
        where: { employeeId: normalizedEmployeeId },
        update: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          middleName: normalizeOptionalUpperText(middleName),
          email: normalizedEmail,
          isActive: true, // Reactivate user if profile is recreated
        },
        create: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          middleName: normalizeOptionalUpperText(middleName),
          email: normalizedEmail,
          employeeId: normalizedEmployeeId,
          password: defaultPasswordHash,
          role: "TEACHER",
          isActive: true,
          mustChangePassword: true,
        },
      });

      // 2. Create the Teacher profile
      const t = await tx.teacher.create({
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          middleName: normalizeOptionalUpperText(middleName),
          email: normalizedEmail,
          employeeId: normalizedEmployeeId,
          contactNumber: normalizedContactNumber,
          specialization: normalizeOptionalUpperText(specialization),
          department: deptCode ? { connect: { code: deptCode } } : undefined,
          plantillaPosition: normalizeOptionalUpperText(plantillaPosition),
        },
      });

      if (Array.isArray(subjects) && subjects.length > 0) {
        await tx.teacherSubject.createMany({
          data: subjects.map((sub) => ({
            teacherId: t.id,
            subject: sub.trim().toUpperCase(),
          })),
        });
      }

      return t;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_CREATED",
      description: `Created teacher profile: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: "Teacher",
      recordId: teacher.id,
      req,
    });

    res.json({ teacher });
  } catch (error: unknown) {
    const conflictField = getTeacherIdentityConflictField(error);
    if (conflictField === "employeeId") {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    if (conflictField === "email") {
      return res
        .status(409)
        .json({ message: "DepEd email address already exists" });
    }

    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function update(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid teacher ID" });
  }

  try {
    const {
      firstName,
      lastName,
      middleName,
      email,
      employeeId,
      contactNumber,
      specialization,
      department,
      plantillaPosition,
      subjects,
    } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedFirstName = normalizeRequiredUpperText(firstName);
    const normalizedLastName = normalizeRequiredUpperText(lastName);
    const normalizedEmployeeId = normalizeRequiredUpperText(employeeId);
    const normalizedEmail = normalizeRequiredLowerEmail(email);
    const normalizedContactNumber = normalizeContactNumber(contactNumber);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedEmployeeId ||
      !normalizedEmail
    ) {
      return res.status(400).json({
        message:
          "First name, last name, employee ID, and DepEd email are required",
      });
    }

    if (!isValidContactNumber(normalizedContactNumber)) {
      return res
        .status(400)
        .json({ message: "Contact number must be exactly 11 digits" });
    }

    const deptCode = normalizeOptionalUpperText(department);

    const updatedTeacher = await prisma.$transaction(async (tx) => {
      // 1. Update the User record if it exists (linked by employeeId)
      await tx.user.updateMany({
        where: { employeeId: existing.employeeId },
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          middleName: normalizeOptionalUpperText(middleName),
          email: normalizedEmail,
          employeeId: normalizedEmployeeId,
        },
      });

      // 2. Update the Teacher profile
      const t = await tx.teacher.update({
        where: { id },
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          middleName: normalizeOptionalUpperText(middleName),
          email: normalizedEmail,
          employeeId: normalizedEmployeeId,
          contactNumber: normalizedContactNumber,
          specialization: normalizeOptionalUpperText(specialization),
          department: deptCode
            ? { connect: { code: deptCode } }
            : { disconnect: true },
          plantillaPosition: normalizeOptionalUpperText(plantillaPosition),
        },
      });

      // Sync subjects
      await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
      if (Array.isArray(subjects) && subjects.length > 0) {
        await tx.teacherSubject.createMany({
          data: subjects.map((sub) => ({
            teacherId: id,
            subject: sub.trim().toUpperCase(),
          })),
        });
      }

      return t;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_UPDATED",
      description: `Updated teacher profile: ${updatedTeacher.lastName}, ${updatedTeacher.firstName}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({
      teacher: {
        ...updatedTeacher,
      },
    });
  } catch (error: unknown) {
    const conflictField = getTeacherIdentityConflictField(error);
    if (conflictField === "employeeId") {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    if (conflictField === "email") {
      return res
        .status(409)
        .json({ message: "DepEd email address already exists" });
    }

    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  const { reason } = req.body;

  try {
    // Check for active adviser assignments across all school years that are not ARCHIVED
    const activeAssignments = await prisma.teacherDesignation.findMany({
      where: {
        teacherId: id,
        schoolYear: {
          status: { not: "ARCHIVED" },
        },
        OR: [{ isClassAdviser: true }],
      },
      include: {
        schoolYear: true,
        advisorySection: true,
      },
    });

    if (activeAssignments.length > 0) {
      const assignment = activeAssignments[0];
      const advisorySectionName =
        assignment.advisorySection?.name ?? "an assigned section";
      const context = `active advisory assignment for ${advisorySectionName}`;

      return res.status(409).json({
        message: `Cannot deactivate: This teacher has an ${context} in ${assignment.schoolYear.yearLabel}. You must reassign the advisory assignment before deactivating the account.`,
      });
    }

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher = await prisma.$transaction(async (tx) => {
      // 1. Deactivate the User record
      await tx.user.updateMany({
        where: { employeeId: existing.employeeId },
        data: { isActive: false },
      });

      // 2. Deactivate the Teacher profile
      return await tx.teacher.update({
        where: { id },
        data: { isActive: false },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_DEACTIVATED",
      description: `Deactivated teacher: ${teacher.lastName}, ${teacher.firstName}. Reason: ${reason}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function reactivate(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  try {
    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacher = await prisma.$transaction(async (tx) => {
      // 1. Reactivate the User record
      await tx.user.updateMany({
        where: { employeeId: existing.employeeId },
        data: { isActive: true },
      });

      // 2. Reactivate the Teacher profile
      return await tx.teacher.update({
        where: { id },
        data: { isActive: true },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_REACTIVATED",
      description: `Reactivated teacher: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function showDesignation(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  const { schoolYearId } = req.query;

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid teacher ID" });
  }

  try {
    const schoolContext = await prisma.schoolSetting.findFirst({
      include: {
        activeSchoolYear: true,
      },
    });

    if (!schoolContext?.activeSchoolYear) {
      return res.status(400).json({ message: "No active school year set" });
    }

    const syId = schoolYearId
      ? parseInt(schoolYearId as string)
      : schoolContext.activeSchoolYearId!;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        employeeId: true,
        designation: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const designation = await prisma.teacherDesignation.findUnique({
      where: {
        uq_teacher_designations_teacher_sy: {
          teacherId: id,
          schoolYearId: syId,
        },
      },
      include: {
        advisorySection: {
          include: { gradeLevel: true },
        },
        updatedBy: true,
      },
    });

    res.json({
      scope: {
        schoolId: schoolContext.id,
        schoolYearId: syId,
        schoolYearLabel: schoolContext.activeSchoolYear.yearLabel,
      },
      teacher: {
        ...teacher,
        designationTitle: teacher.designation,
        name: formatTeacherName(teacher),
      },
      designation: designation
        ? {
            ...designation,
            updatedByName: designation.updatedBy
              ? `${designation.updatedBy.lastName}, ${designation.updatedBy.firstName}`
              : null,
          }
        : null,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function validateDesignation(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  const { advisorySectionId, schoolYearId } = req.body;

  if (!advisorySectionId) {
    return res.json({ hasCollision: false });
  }

  try {
    const collision = await prisma.teacherDesignation.findFirst({
      where: {
        advisorySectionId,
        schoolYearId,
        teacherId: { not: id },
      },
      include: {
        teacher: true,
        advisorySection: { include: { gradeLevel: true } },
      },
    });

    if (collision) {
      return res.json({
        hasCollision: true,
        collision: {
          sectionId: collision.advisorySectionId,
          sectionName: collision.advisorySection?.name,
          gradeLevelName: collision.advisorySection?.gradeLevel.name,
          currentAdviserId: collision.teacherId,
          currentAdviserName: formatTeacherName(collision.teacher),
        },
      });
    }

    res.json({ hasCollision: false });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function upsertDesignation(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  const payload = req.body;

  try {
    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: payload.schoolYearId },
    });
    if (!schoolYear)
      return res.status(404).json({ message: "School year not found" });

    const advisorySectionId = payload.advisorySectionId
      ? parseInt(payload.advisorySectionId)
      : null;

    const collision = advisorySectionId
      ? await prisma.teacherDesignation.findFirst({
          where: {
            advisorySectionId,
            schoolYearId: payload.schoolYearId,
            teacherId: { not: id },
          },
        })
      : null;

    if (collision && !payload.allowAdviserOverride) {
      return res.status(409).json({ message: "Adviser collision detected" });
    }

    const designation = await prisma.$transaction(async (tx) => {
      if (collision && payload.allowAdviserOverride) {
        // 1. Close active ledger for current section adviser
        const currentActiveAdviser = await tx.sectionAdviser.findFirst({
          where: {
            sectionId: advisorySectionId!,
            schoolYearId: payload.schoolYearId,
            status: SectionAdviserStatus.ACTIVE,
          },
        });

        if (currentActiveAdviser) {
          await tx.sectionAdviser.update({
            where: { id: currentActiveAdviser.id },
            data: {
              status: SectionAdviserStatus.HANDED_OVER,
              effectiveTo: new Date(),
              handoverReason:
                "Administrative Handover (via Teacher Management)",
            },
          });
        }

        // 2. Relieve old adviser's designation
        await tx.teacherDesignation.update({
          where: { id: collision.id },
          data: {
            isClassAdviser: false,
            advisorySectionId: null,
          },
        });
      }

      // 3. Update/Create teacher designation
      const d = await tx.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: id,
            schoolYearId: payload.schoolYearId,
          },
        },
        update: {
          isClassAdviser: payload.isClassAdviser,
          advisorySectionId,
          ancillaryRoles: payload.ancillaryRoles || [],
          designationNotes: normalizeOptionalText(payload.designationNotes),
          effectiveFrom: parseDateOnly(payload.effectiveFrom),
          effectiveTo: parseDateOnly(payload.effectiveTo),
          updateReason: normalizeOptionalText(payload.reason),
          updatedById: req.user!.userId,
        },
        create: {
          teacherId: id,
          schoolYearId: payload.schoolYearId,
          isClassAdviser: payload.isClassAdviser,
          advisorySectionId,
          ancillaryRoles: payload.ancillaryRoles || [],
          designationNotes: normalizeOptionalText(payload.designationNotes),
          effectiveFrom: parseDateOnly(payload.effectiveFrom),
          effectiveTo: parseDateOnly(payload.effectiveTo),
          updateReason: normalizeOptionalText(payload.reason),
          updatedById: req.user!.userId,
        },
        include: {
          updatedBy: true,
          advisorySection: { include: { gradeLevel: true } },
        },
      });

      // 4. Update section adviser ledger if becoming class adviser
      if (payload.isClassAdviser && advisorySectionId) {
        // Ensure this teacher doesn't already have an active ledger for this section
        const alreadyActive = await tx.sectionAdviser.findFirst({
          where: {
            sectionId: advisorySectionId,
            teacherId: id,
            schoolYearId: payload.schoolYearId,
            status: SectionAdviserStatus.ACTIVE,
          },
        });

        if (!alreadyActive) {
          await tx.sectionAdviser.create({
            data: {
              sectionId: advisorySectionId,
              teacherId: id,
              schoolYearId: payload.schoolYearId,
              status: SectionAdviserStatus.ACTIVE,
              effectiveFrom: parseDateOnly(payload.effectiveFrom) || new Date(),
            },
          });
        }
      } else if (!payload.isClassAdviser) {
        // If being relieved, close any active ledger
        await tx.sectionAdviser.updateMany({
          where: {
            teacherId: id,
            schoolYearId: payload.schoolYearId,
            status: SectionAdviserStatus.ACTIVE,
          },
          data: {
            status: SectionAdviserStatus.REVOKED,
            effectiveTo: new Date(),
            handoverReason: "Designation Revoked",
          },
        });
      }

      return d;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_DESIGNATION_UPDATED",
      description: `Updated designation for ${formatTeacherName(teacher)} in school year ${schoolYear.yearLabel}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({
      designation: {
        ...designation,
        updatedByName: designation.updatedBy
          ? `${designation.updatedBy.lastName}, ${designation.updatedBy.firstName}`
          : null,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}
