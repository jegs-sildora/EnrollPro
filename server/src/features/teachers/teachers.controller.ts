import type { Request, Response } from "express";
import {
  DEPED_TEACHER_SUBJECT_VALUES,
  DEPED_TEACHER_DEPARTMENT_VALUES,
  type TeacherDesignationInput,
} from "@enrollpro/shared";

const DEFAULT_MAX_WEEKLY_HOURS = 30;

function calculateMaxWeeklyHours(designation: any): number {
  if (designation?.isTeachingExempt) return 0;

  const base =
    designation?.customTargetTeachingHoursPerWeek ?? DEFAULT_MAX_WEEKLY_HOURS;
  const advisoryAdjustment = designation?.advisoryEquivalentHoursPerWeek ?? 0;

  return Math.max(0, base - advisoryAdjustment);
}
import { prisma } from "../../lib/prisma.js";
import {
  deleteUploadedFileByRelativePath,
  saveBase64Image,
} from "../../lib/fileUploader.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";

const DEFAULT_ADVISORY_EQUIVALENT_HOURS = 5;
const AUTO_EMPLOYEE_ID_PREFIX = "TCH-";
const AUTO_EMPLOYEE_ID_DIGITS = 4;
const AUTO_EMPLOYEE_ID_PATTERN = /^TCH-(\d+)$/;
const AUTO_EMPLOYEE_ID_MAX_RETRIES = 10;
const ALLOWED_TEACHER_SUBJECTS = new Set<string>(DEPED_TEACHER_SUBJECT_VALUES);

type ParsedSchoolYearId = number | null | "invalid";

interface SchoolContext {
  schoolId: number | null;
  schoolName: string | null;
  schoolYearId: number | null;
  schoolYearLabel: string | null;
}

interface SchoolContextError {
  error: {
    status: number;
    message: string;
  };
}

type SchoolContextResult = SchoolContext | SchoolContextError;

interface AdviserCollisionDetails {
  sectionId: number;
  sectionName: string;
  gradeLevelId: number;
  gradeLevelName: string | null;
  currentAdviserId: number;
  currentAdviserName: string;
}

function isSchoolContextError(
  value: SchoolContextResult,
): value is SchoolContextError {
  return "error" in value;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseSchoolYearIdFromQuery(value: unknown): ParsedSchoolYearId {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = parsePositiveInt(normalized);

  return parsed === null ? "invalid" : parsed;
}

function normalizeOptionalText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredUpperText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function normalizeOptionalUpperText(value?: string | null): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeContactNumber(value?: string | null): string | null {
  return normalizeOptionalText(value);
}

function isValidContactNumber(value: string | null): boolean {
  return value === null || /^\d{11}$/.test(value);
}

function isEmployeeIdUniqueViolation(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    meta?: {
      target?: unknown;
    };
  };

  if (candidate.code !== "P2002") {
    return false;
  }

  const target = candidate.meta?.target;
  if (Array.isArray(target)) {
    return target.some((entry) => String(entry).includes("employeeId"));
  }

  return String(target ?? "").includes("employeeId");
}

function normalizeTeacherSubjects(subjects: unknown): string[] {
  if (!Array.isArray(subjects)) {
    return [];
  }

  return Array.from(
    new Set(
      subjects
        .map((subject: unknown) => String(subject).trim().toUpperCase())
        .filter(
          (subject: string) =>
            subject.length > 0 && ALLOWED_TEACHER_SUBJECTS.has(subject),
        ),
    ),
  );
}

async function getNextAutoEmployeeId(): Promise<string> {
  const teachers = await prisma.teacher.findMany({
    where: {
      employeeId: {
        startsWith: AUTO_EMPLOYEE_ID_PREFIX,
      },
    },
    select: {
      employeeId: true,
    },
  });

  let maxSequence = 0;
  for (const teacher of teachers) {
    const employeeId = teacher.employeeId;
    if (!employeeId) {
      continue;
    }

    const match = employeeId.match(AUTO_EMPLOYEE_ID_PATTERN);
    if (!match) {
      continue;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      continue;
    }

    if (parsed > maxSequence) {
      maxSequence = parsed;
    }
  }

  return `${AUTO_EMPLOYEE_ID_PREFIX}${String(maxSequence + 1).padStart(AUTO_EMPLOYEE_ID_DIGITS, "0")}`;
}

function toDateOnlyString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function formatTeacherName(teacher: {
  firstName: string;
  lastName: string;
  middleName: string | null;
}): string {
  return `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

function mapDesignation(designation: any, schoolId: number | null) {
  const updatedByName = designation.updatedBy
    ? `${designation.updatedBy.lastName}, ${designation.updatedBy.firstName}`
    : null;

  return {
    id: designation.id,
    schoolId,
    schoolYearId: designation.schoolYearId,
    isClassAdviser: designation.isClassAdviser,
    advisorySectionId: designation.advisorySectionId,
    advisorySection: designation.advisorySection
      ? {
          id: designation.advisorySection.id,
          name: designation.advisorySection.name,
          gradeLevelId: designation.advisorySection.gradeLevelId,
          gradeLevelName: designation.advisorySection.gradeLevel?.name ?? null,
        }
      : null,
    advisoryEquivalentHoursPerWeek: designation.advisoryEquivalentHoursPerWeek,
    isTic: designation.isTic,
    isTeachingExempt: designation.isTeachingExempt,
    customTargetTeachingHoursPerWeek:
      designation.customTargetTeachingHoursPerWeek,
    computedMaxWeeklyHours: calculateMaxWeeklyHours(designation),
    designationNotes: designation.designationNotes,
    effectiveFrom: toDateOnlyString(designation.effectiveFrom),
    effectiveTo: toDateOnlyString(designation.effectiveTo),
    updateReason: designation.updateReason,
    updatedById: designation.updatedById,
    updatedByName,
    updatedAt: toIsoString(designation.updatedAt),
  };
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

async function findAdvisorySectionForSchoolYear(
  advisorySectionId: number,
  schoolYearId: number,
) {
  return prisma.section.findFirst({
    where: {
      id: advisorySectionId,
      schoolYearId,
    },
    select: {
      id: true,
      name: true,
      gradeLevelId: true,
      gradeLevel: {
        select: {
          name: true,
        },
      },
      advisingTeacherId: true,
      advisingTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
    },
  });
}

function getAdviserCollision(
  section: {
    id: number;
    name: string;
    gradeLevelId: number;
    gradeLevel: { name: string };
    advisingTeacherId: number | null;
    advisingTeacher: {
      id: number;
      firstName: string;
      lastName: string;
      middleName: string | null;
    } | null;
  },
  teacherId: number,
): AdviserCollisionDetails | null {
  if (!section.advisingTeacherId || section.advisingTeacherId === teacherId) {
    return null;
  }

  if (!section.advisingTeacher) {
    return null;
  }

  return {
    sectionId: section.id,
    sectionName: section.name,
    gradeLevelId: section.gradeLevelId,
    gradeLevelName: section.gradeLevel?.name ?? null,
    currentAdviserId: section.advisingTeacher.id,
    currentAdviserName: formatTeacherName(section.advisingTeacher),
  };
}

async function resolveSchoolContext(
  schoolYearIdQuery: number | null,
): Promise<SchoolContextResult> {
  const schoolSetting = await prisma.schoolSetting.findFirst({
    select: { id: true, schoolName: true, activeSchoolYearId: true },
  });

  const schoolId = schoolSetting?.id ?? null;
  const schoolName = schoolSetting?.schoolName ?? null;
  const resolvedSchoolYearId =
    schoolYearIdQuery ?? schoolSetting?.activeSchoolYearId ?? null;

  let schoolYearLabel: string | null = null;
  if (resolvedSchoolYearId) {
    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: resolvedSchoolYearId },
      select: { yearLabel: true },
    });
    if (!schoolYear) {
      return {
        error: {
          status: 404,
          message: "School year not found",
        },
      };
    }
    schoolYearLabel = schoolYear.yearLabel;
  }

  return {
    schoolId,
    schoolName,
    schoolYearId: resolvedSchoolYearId,
    schoolYearLabel,
  };
}

export async function index(req: Request, res: Response) {
  try {
    const schoolYearIdQuery = parseSchoolYearIdFromQuery(
      req.query.schoolYearId,
    );
    if (schoolYearIdQuery === "invalid") {
      return res
        .status(400)
        .json({ message: "schoolYearId must be a positive integer" });
    }

    const schoolContext = await resolveSchoolContext(schoolYearIdQuery);
    if (isSchoolContextError(schoolContext)) {
      return res
        .status(schoolContext.error.status)
        .json({ message: schoolContext.error.message });
    }

    const teachers = await prisma.teacher.findMany({
      orderBy: { lastName: "asc" },
      include: {
        subjects: true,
        _count: { select: { sections: true } },
        teacherDesignations: {
          where: schoolContext.schoolYearId
            ? { schoolYearId: schoolContext.schoolYearId }
            : { id: -1 },
          include: {
            updatedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            advisorySection: {
              select: {
                id: true,
                name: true,
                gradeLevelId: true,
                gradeLevel: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          take: 1,
        },
      },
    });

    const formatted = teachers.map((teacher) => {
      const designation = teacher.teacherDesignations[0] ?? null;

      return {
        id: teacher.id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        specialization: teacher.specialization,
        department: teacher.department,
        plantillaPosition: teacher.plantillaPosition,
        photoPath: teacher.photoPath,
        isActive: teacher.isActive,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
        subjects: teacher.subjects.map((subject) => subject.subject),
        sectionCount: teacher._count.sections,
        designation: designation
          ? mapDesignation(designation, schoolContext.schoolId)
          : null,
      };
    });

    res.json({
      scope: {
        schoolId: schoolContext.schoolId,
        schoolYearId: schoolContext.schoolYearId,
        schoolYearLabel: schoolContext.schoolYearLabel,
      },
      teachers: formatted,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function show(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        subjects: true,
        sections: {
          include: {
            gradeLevel: true,
            _count: { select: { enrollmentRecords: true } },
          },
        },
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({ teacher });
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

    const normalizedSubjects = normalizeTeacherSubjects(subjects);
    const normalizedEmployeeId = normalizeOptionalUpperText(employeeId);

    let stagedPhotoPath: string | null = null;
    if (typeof photo === "string" && photo.trim().length > 0) {
      stagedPhotoPath = await saveBase64Image(photo, "teacher-photo");
      if (!stagedPhotoPath) {
        return res.status(400).json({ message: "Invalid teacher photo data" });
      }
    }

    const teacher = await (async () => {
      try {
        const createTeacher = async (resolvedEmployeeId: string | null) => {
          return prisma.teacher.create({
            data: {
              firstName: normalizedFirstName,
              lastName: normalizedLastName,
              middleName: normalizeOptionalUpperText(middleName),
              email: normalizeOptionalText(email),
              employeeId: resolvedEmployeeId,
              contactNumber: normalizedContactNumber,
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
        };

        if (normalizedEmployeeId) {
          return createTeacher(normalizedEmployeeId);
        }

        for (
          let attempt = 0;
          attempt < AUTO_EMPLOYEE_ID_MAX_RETRIES;
          attempt++
        ) {
          const generatedEmployeeId = await getNextAutoEmployeeId();

          try {
            return await createTeacher(generatedEmployeeId);
          } catch (error) {
            if (!isEmployeeIdUniqueViolation(error)) {
              throw error;
            }
          }
        }

        throw new Error(
          "Unable to auto-generate a unique Employee ID. Please try again.",
        );
      } catch (error) {
        if (stagedPhotoPath) {
          deleteUploadedFileByRelativePath(stagedPhotoPath);
        }
        throw error;
      }
    })();

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_CREATED",
      description: `Created teacher profile: ${normalizedLastName}, ${normalizedFirstName}`,
      subjectType: "Teacher",
      recordId: teacher.id,
      req,
    });

    res.status(201).json({ teacher });
  } catch (error: any) {
    if (isEmployeeIdUniqueViolation(error)) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

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
      photo,
    } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects =
      subjects !== undefined ? normalizeTeacherSubjects(subjects) : undefined;

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
        if (!stagedPhotoPath) {
          return res
            .status(400)
            .json({ message: "Invalid teacher photo data" });
        }
      } else {
        return res.status(400).json({ message: "Invalid teacher photo data" });
      }
    }

    const teacher = await (async () => {
      try {
        return await prisma.$transaction(async (tx) => {
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
      } catch (error) {
        if (
          typeof stagedPhotoPath === "string" &&
          stagedPhotoPath !== existing.photoPath
        ) {
          deleteUploadedFileByRelativePath(stagedPhotoPath);
        }
        throw error;
      }
    })();

    if (
      stagedPhotoPath !== undefined &&
      existing.photoPath &&
      existing.photoPath !== teacher.photoPath
    ) {
      deleteUploadedFileByRelativePath(existing.photoPath);
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_UPDATED",
      description: `Updated teacher profile: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: "Teacher",
      recordId: id,
      req,
    });

    res.json({ teacher });
  } catch (error: any) {
    if (isEmployeeIdUniqueViolation(error)) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(500).json({ message: error.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

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
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

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
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const schoolYearIdQuery = parseSchoolYearIdFromQuery(
      req.query.schoolYearId,
    );
    if (schoolYearIdQuery === "invalid") {
      return res
        .status(400)
        .json({ message: "schoolYearId must be a positive integer" });
    }

    const schoolContext = await resolveSchoolContext(schoolYearIdQuery);
    if (isSchoolContextError(schoolContext)) {
      return res
        .status(schoolContext.error.status)
        .json({ message: schoolContext.error.message });
    }

    if (!schoolContext.schoolYearId) {
      return res.status(400).json({
        message:
          "No schoolYearId provided and no active school year configured",
      });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        employeeId: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const designation = await prisma.teacherDesignation.findUnique({
      where: {
        uq_teacher_designations_teacher_sy: {
          teacherId: id,
          schoolYearId: schoolContext.schoolYearId,
        },
      },
      include: {
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        advisorySection: {
          select: {
            id: true,
            name: true,
            gradeLevelId: true,
            gradeLevel: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    res.json({
      scope: {
        schoolId: schoolContext.schoolId,
        schoolYearId: schoolContext.schoolYearId,
        schoolYearLabel: schoolContext.schoolYearLabel,
      },
      teacher: {
        ...teacher,
        name: formatTeacherName(teacher),
      },
      designation: designation
        ? mapDesignation(designation, schoolContext.schoolId)
        : {
            id: null,
            schoolId: schoolContext.schoolId,
            schoolYearId: schoolContext.schoolYearId,
            isClassAdviser: false,
            advisorySectionId: null,
            advisorySection: null,
            advisoryEquivalentHoursPerWeek: 0,
            isTic: false,
            isTeachingExempt: false,
            customTargetTeachingHoursPerWeek: null,
            designationNotes: null,
            effectiveFrom: null,
            effectiveTo: null,
            updateReason: null,
            updatedById: null,
            updatedByName: null,
            updatedAt: null,
          },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function validateDesignation(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const payload = req.body as TeacherDesignationInput;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: payload.schoolYearId },
      select: {
        id: true,
      },
    });

    if (!schoolYear) {
      return res.status(404).json({ message: "School year not found" });
    }

    const advisorySectionId = payload.isClassAdviser
      ? (payload.advisorySectionId ?? null)
      : null;

    if (!advisorySectionId) {
      return res.json({
        valid: true,
        hasCollision: false,
        collision: null,
        section: null,
        canOverride: false,
      });
    }

    const section = await findAdvisorySectionForSchoolYear(
      advisorySectionId,
      payload.schoolYearId,
    );

    if (!section) {
      return res.status(404).json({
        message: "Advisory section not found in selected school year",
      });
    }

    const collision = getAdviserCollision(section, id);

    return res.json({
      valid: true,
      hasCollision: Boolean(collision),
      collision,
      section: {
        id: section.id,
        name: section.name,
        gradeLevelId: section.gradeLevelId,
        gradeLevelName: section.gradeLevel?.name ?? null,
      },
      canOverride: Boolean(collision),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function upsertDesignation(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const payload = req.body as TeacherDesignationInput;

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: payload.schoolYearId },
      select: { id: true, yearLabel: true },
    });

    if (!schoolYear) {
      return res.status(404).json({ message: "School year not found" });
    }

    const advisoryEquivalentHoursPerWeek = payload.isClassAdviser
      ? (payload.advisoryEquivalentHoursPerWeek ??
        DEFAULT_ADVISORY_EQUIVALENT_HOURS)
      : 0;

    const advisorySectionId = payload.isClassAdviser
      ? (payload.advisorySectionId ?? null)
      : null;

    const advisorySection = advisorySectionId
      ? await findAdvisorySectionForSchoolYear(
          advisorySectionId,
          payload.schoolYearId,
        )
      : null;

    if (advisorySectionId && !advisorySection) {
      return res.status(404).json({
        message: "Advisory section not found in selected school year",
      });
    }

    const collision = advisorySection
      ? getAdviserCollision(advisorySection, id)
      : null;

    if (collision && !payload.allowAdviserOverride) {
      return res.status(409).json({
        message:
          "The selected advisory section is already assigned to another teacher",
        collision,
        canOverride: true,
      });
    }

    const designation = await prisma.$transaction(async (tx) => {
      if (payload.isClassAdviser && advisorySectionId) {
        await tx.section.updateMany({
          where: {
            advisingTeacherId: id,
            NOT: { id: advisorySectionId },
            schoolYearId: payload.schoolYearId,
          },
          data: {
            advisingTeacherId: null,
          },
        });

        if (payload.allowAdviserOverride) {
          await tx.teacherDesignation.updateMany({
            where: {
              schoolYearId: payload.schoolYearId,
              advisorySectionId,
              teacherId: { not: id },
            },
            data: {
              advisorySectionId: null,
              isClassAdviser: false,
              advisoryEquivalentHoursPerWeek: 0,
              updatedById: req.user!.userId,
            },
          });
        }

        await tx.section.update({
          where: { id: advisorySectionId },
          data: {
            advisingTeacherId: id,
          },
        });
      } else if (!payload.isClassAdviser) {
        await tx.section.updateMany({
          where: {
            advisingTeacherId: id,
            schoolYearId: payload.schoolYearId,
          },
          data: {
            advisingTeacherId: null,
          },
        });
      }

      return tx.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: id,
            schoolYearId: payload.schoolYearId,
          },
        },
        update: {
          isClassAdviser: payload.isClassAdviser,
          advisorySectionId,
          advisoryEquivalentHoursPerWeek,
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
          advisoryEquivalentHoursPerWeek,
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
          updatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          advisorySection: {
            select: {
              id: true,
              name: true,
              gradeLevelId: true,
              gradeLevel: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    const schoolSetting = await prisma.schoolSetting.findFirst({
      select: { id: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_DESIGNATION_UPDATED",
      description: `Updated designation for ${formatTeacherName(teacher)} in school year ${schoolYear.yearLabel}`,
      subjectType: "Teacher",
      recordId: teacher.id,
      req,
    });

    res.json({
      designation: mapDesignation(designation, schoolSetting?.id ?? null),
      collisionOverrideApplied: Boolean(
        collision && payload.allowAdviserOverride,
      ),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
