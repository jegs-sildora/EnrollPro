import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { saveBase64Image } from "../../lib/fileUploader.js";
import { SectionAdviserStatus } from "../../generated/prisma/index.js";

// Helper functions that were missing
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

function normalizeOptionalUpperText(val: any): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim().toUpperCase();
}

function normalizeOptionalText(val: any): string | null {
  if (val === undefined || val === null || val === "") return null;
  return String(val).trim();
}

function normalizeRequiredUpperText(val: any): string {
  if (val === undefined || val === null || val === "") return "";
  return String(val).trim().toUpperCase();
}

function normalizeContactNumber(val: any): string | null {
  if (!val) return null;
  return String(val).replace(/\D/g, "").slice(0, 11);
}

function isValidContactNumber(val: any): boolean {
  if (!val) return true;
  const normalized = String(val).replace(/\D/g, "");
  return normalized.length === 11 || normalized.length === 0;
}

function parseDateOnly(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const ALLOWED_TEACHER_SUBJECTS = new Set([
  "FIL",
  "ENG",
  "MATH",
  "SCI",
  "AP",
  "MAPEH",
  "VE",
  "TLE",
  "HG",
  "ESP",
  "ICT",
  "ARTS",
  "SPORTS",
  "JRNL",
  "FL",
  "TVL",
]);

function normalizeTeacherSubjectsList(subjects: unknown): string[] {
  if (!Array.isArray(subjects)) {
    return [];
  }
  return Array.from(
    new Set(
      subjects
        .map((s) => String(s).trim().toUpperCase())
        .filter(
          (subject: string) =>
            subject.length > 0 && ALLOWED_TEACHER_SUBJECTS.has(subject),
        ),
    ),
  );
}

async function getNextAutoEmployeeId(): Promise<string> {
  const teachers = await prisma.teacher.findMany({
    where: { employeeId: { startsWith: "T-" } },
    select: { employeeId: true },
  });

  const ids = teachers
    .map((t) => t.employeeId?.replace("T-", ""))
    .map((id) => parseInt(id || "0"))
    .filter((id) => !isNaN(id));

  const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return `T-${String(nextId).padStart(4, "0")}`;
}

export async function index(req: Request, res: Response) {
  try {
    const schoolYearId = req.query.schoolYearId
      ? parseInt(req.query.schoolYearId as string)
      : null;

    const teachers = await prisma.teacher.findMany({
      include: {
        subjects: true,
        teacherDesignations: schoolYearId
          ? {
              where: { schoolYearId },
              include: {
                advisorySection: {
                  include: {
                    gradeLevel: true,
                  },
                },
              },
            }
          : false,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const formatted = teachers.map((teacher) => {
      const designation = (teacher.teacherDesignations as any)?.[0] ?? null;
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
        department: teacher.department,
        plantillaPosition: teacher.plantillaPosition,
        photoPath: teacher.photoPath,
        subjects: teacher.subjects.map((s: any) => s.subject),
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
              advisoryEquivalentHoursPerWeek:
                designation.advisoryEquivalentHoursPerWeek,
              isTic: designation.isTic,
              isTeachingExempt: designation.isTeachingExempt,
              customTargetTeachingHoursPerWeek:
                designation.customTargetTeachingHoursPerWeek,
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
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
      designation,
      specialization,
      department,
      plantillaPosition,
      subjects,
      photo,
    } = req.body;

    const normalizedFirstName = normalizeRequiredUpperText(firstName);
    const normalizedLastName = normalizeRequiredUpperText(lastName);
    const normalizedContactNumber = normalizeContactNumber(contactNumber);

    if (!normalizedFirstName || !normalizedLastName) {
      return res
        .status(400)
        .json({ message: "First name and last name are required" });
    }

    if (!isValidContactNumber(normalizedContactNumber)) {
      return res
        .status(400)
        .json({ message: "Contact number must be exactly 11 digits" });
    }

    const normalizedSubjects = normalizeTeacherSubjectsList(subjects);
    const normalizedEmployeeId =
      normalizeOptionalUpperText(employeeId) || (await getNextAutoEmployeeId());

    let stagedPhotoPath: string | null = null;
    if (typeof photo === "string" && photo.trim().length > 0) {
      stagedPhotoPath = await saveBase64Image(photo, "teacher-photo");
    }

    const teacher = await prisma.teacher.create({
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        middleName: normalizeOptionalUpperText(middleName),
        email: normalizeOptionalText(email),
        employeeId: normalizedEmployeeId,
        contactNumber: normalizedContactNumber,
        designation: normalizeOptionalUpperText(designation),
        specialization: normalizeOptionalUpperText(specialization),
        department: normalizeOptionalUpperText(department),
        plantillaPosition: normalizeOptionalUpperText(plantillaPosition),
        photoPath: stagedPhotoPath,
        subjects: normalizedSubjects.length
          ? {
              createMany: {
                data: normalizedSubjects.map((subject) => ({ subject })),
              },
            }
          : undefined,
      },
      include: { subjects: true },
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
      include: { subjects: true },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      teacher: {
        ...teacher,
        designationTitle: teacher.designation,
        subjects: teacher.subjects.map((s: any) => s.subject),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
      designation,
      specialization,
      department,
      plantillaPosition,
      subjects,
      photo,
    } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects =
      subjects !== undefined ? normalizeTeacherSubjectsList(subjects) : undefined;
    const normalizedContactNumber =
      contactNumber !== undefined
        ? normalizeContactNumber(contactNumber)
        : undefined;

    if (
      contactNumber !== undefined &&
      !isValidContactNumber(normalizedContactNumber ?? null)
    ) {
      return res
        .status(400)
        .json({ message: "Contact number must be exactly 11 digits" });
    }

    let stagedPhotoPath: string | null | undefined;
    if (photo !== undefined) {
      if (photo === null) {
        stagedPhotoPath = null;
      } else if (typeof photo === "string" && photo.trim().length > 0) {
        stagedPhotoPath = await saveBase64Image(photo, "teacher-photo");
      }
    }

    const updatedTeacher = await prisma.$transaction(async (tx) => {
      if (normalizedSubjects !== undefined) {
        await tx.teacherSubject.deleteMany({ where: { teacherId: id } });
        if (normalizedSubjects.length > 0) {
          await tx.teacherSubject.createMany({
            data: normalizedSubjects.map((subject) => ({
              teacherId: id,
              subject,
            })),
          });
        }
      }

      return tx.teacher.update({
        where: { id },
        data: {
          ...(firstName !== undefined
            ? { firstName: normalizeRequiredUpperText(firstName) }
            : {}),
          ...(lastName !== undefined
            ? { lastName: normalizeRequiredUpperText(lastName) }
            : {}),
          ...(middleName !== undefined
            ? { middleName: normalizeOptionalUpperText(middleName) }
            : {}),
          ...(email !== undefined
            ? { email: normalizeOptionalText(email) }
            : {}),
          ...(employeeId !== undefined
            ? { employeeId: normalizeOptionalUpperText(employeeId) }
            : {}),
          ...(normalizedContactNumber !== undefined
            ? { contactNumber: normalizedContactNumber }
            : {}),
          ...(designation !== undefined
            ? { designation: normalizeOptionalUpperText(designation) }
            : {}),
          ...(specialization !== undefined
            ? { specialization: normalizeOptionalUpperText(specialization) }
            : {}),
          ...(department !== undefined
            ? { department: normalizeOptionalUpperText(department) }
            : {}),
          ...(plantillaPosition !== undefined
            ? {
                plantillaPosition:
                  normalizeOptionalUpperText(plantillaPosition),
              }
            : {}),
          ...(stagedPhotoPath !== undefined
            ? { photoPath: stagedPhotoPath }
            : {}),
        },
        include: { subjects: true },
      });
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
        subjects: updatedTeacher.subjects.map((s: any) => s.subject),
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  try {
    const teacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: false },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_DEACTIVATED",
      description: `Deactivated teacher: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function reactivate(req: Request, res: Response) {
  const idStr = String(req.params.id);
  const id = parseInt(idStr);
  try {
    const teacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: true },
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
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
                status: SectionAdviserStatus.ACTIVE
            }
        });

        if (currentActiveAdviser) {
            await tx.sectionAdviser.update({
                where: { id: currentActiveAdviser.id },
                data: {
                    status: SectionAdviserStatus.HANDED_OVER,
                    effectiveTo: new Date(),
                    handoverReason: "Administrative Handover (via Teacher Management)"
                }
            });
        }

        // 2. Relieve old adviser's designation workload
        await tx.teacherDesignation.update({
          where: { id: collision.id },
          data: {
            isClassAdviser: false,
            advisorySectionId: null,
            advisoryEquivalentHoursPerWeek: 0,
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
          advisoryEquivalentHoursPerWeek:
            payload.advisoryEquivalentHoursPerWeek || 0,
          isTic: payload.isTic,
          isTeachingExempt: payload.isTeachingExempt,
          customTargetTeachingHoursPerWeek:
            payload.customTargetTeachingHoursPerWeek ?? null,
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
          advisoryEquivalentHoursPerWeek:
            payload.advisoryEquivalentHoursPerWeek || 0,
          isTic: payload.isTic,
          isTeachingExempt: payload.isTeachingExempt,
          customTargetTeachingHoursPerWeek:
            payload.customTargetTeachingHoursPerWeek ?? null,
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
                status: SectionAdviserStatus.ACTIVE
            }
        });

        if (!alreadyActive) {
            await tx.sectionAdviser.create({
                data: {
                    sectionId: advisorySectionId,
                    teacherId: id,
                    schoolYearId: payload.schoolYearId,
                    status: SectionAdviserStatus.ACTIVE,
                    effectiveFrom: parseDateOnly(payload.effectiveFrom) || new Date()
                }
            });
        }
      } else if (!payload.isClassAdviser) {
          // If being relieved, close any active ledger
          await tx.sectionAdviser.updateMany({
              where: {
                  teacherId: id,
                  schoolYearId: payload.schoolYearId,
                  status: SectionAdviserStatus.ACTIVE
              },
              data: {
                  status: SectionAdviserStatus.REVOKED,
                  effectiveTo: new Date(),
                  handoverReason: "Designation Revoked"
              }
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
