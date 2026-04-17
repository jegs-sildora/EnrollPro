import type { Request, Response } from "express";
import type { TeacherDesignationInput } from "@enrollpro/shared";
import { prisma } from "../../lib/prisma.js";
import {
  deleteUploadedFileByRelativePath,
  saveBase64Image,
} from "../../lib/fileUploader.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  getTeacherLatestAtlasSync,
  queueBulkTeacherAtlasSync,
  queueTeacherAtlasSync,
} from "./atlas-sync.service.js";

const DEFAULT_ADVISORY_EQUIVALENT_HOURS = 5;

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

function toDateOnlyString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapAtlasSync(
  sync: {
    status: "PENDING" | "SYNCED" | "FAILED" | "SKIPPED";
    eventRecordId: number | null;
    eventId: string | null;
    attemptCount: number;
    maxAttempts: number;
    httpStatus: number | null;
    errorMessage: string | null;
    nextRetryAt: string | null;
    acknowledgedAt: string | null;
  } | null,
) {
  if (!sync) {
    return null;
  }

  return {
    status: sync.status,
    eventRecordId: sync.eventRecordId,
    eventId: sync.eventId,
    attemptCount: sync.attemptCount,
    maxAttempts: sync.maxAttempts,
    httpStatus: sync.httpStatus,
    errorMessage: sync.errorMessage,
    nextRetryAt: sync.nextRetryAt,
    acknowledgedAt: sync.acknowledgedAt,
  };
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

function parseSchoolYearIdFromRequest(req: Request): ParsedSchoolYearId {
  const querySchoolYearId = parseSchoolYearIdFromQuery(req.query.schoolYearId);
  if (querySchoolYearId === "invalid") {
    return "invalid";
  }

  const bodySchoolYearId = parseSchoolYearIdFromQuery(
    (req.body as { schoolYearId?: unknown } | undefined)?.schoolYearId,
  );

  if (bodySchoolYearId === "invalid") {
    return "invalid";
  }

  return bodySchoolYearId ?? querySchoolYearId;
}

function parseTeacherIdsFromBody(value: unknown): number[] | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!Array.isArray(value)) {
    return [];
  }

  const parsed = value
    .map((entry) => parsePositiveInt(entry))
    .filter((entry): entry is number => entry !== null);

  return Array.from(new Set(parsed));
}

async function findAdvisorySectionForSchoolYear(
  advisorySectionId: number,
  schoolYearId: number,
) {
  return prisma.section.findFirst({
    where: {
      id: advisorySectionId,
      gradeLevel: {
        schoolYearId,
      },
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
        atlasSyncEvents: {
          where: schoolContext.schoolYearId
            ? { schoolYearId: schoolContext.schoolYearId }
            : undefined,
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const formatted = teachers.map((teacher) => {
      const designation = teacher.teacherDesignations[0] ?? null;
      const atlasSync = teacher.atlasSyncEvents[0] ?? null;

      return {
        id: teacher.id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        specialization: teacher.specialization,
        photoPath: teacher.photoPath,
        isActive: teacher.isActive,
        createdAt: teacher.createdAt,
        updatedAt: teacher.updatedAt,
        subjects: teacher.subjects.map((subject) => subject.subject),
        sectionCount: teacher._count.sections,
        designation: designation
          ? mapDesignation(designation, schoolContext.schoolId)
          : null,
        atlasSync: atlasSync
          ? mapAtlasSync({
              status: atlasSync.status,
              eventRecordId: atlasSync.id,
              eventId: atlasSync.eventId,
              attemptCount: atlasSync.attemptCount,
              maxAttempts: atlasSync.maxAttempts,
              httpStatus: atlasSync.httpStatus,
              errorMessage: atlasSync.errorMessage,
              nextRetryAt: toIsoString(atlasSync.nextRetryAt),
              acknowledgedAt: toIsoString(atlasSync.acknowledgedAt),
            })
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

    const normalizedSubjects = Array.isArray(subjects)
      ? Array.from(
          new Set(
            subjects
              .map((subject: unknown) => String(subject).trim().toUpperCase())
              .filter((subject: string) => subject.length > 0),
          ),
        )
      : [];

    let stagedPhotoPath: string | null = null;
    if (typeof photo === "string" && photo.trim().length > 0) {
      stagedPhotoPath = await saveBase64Image(photo, "teacher-photo");
      if (!stagedPhotoPath) {
        return res.status(400).json({ message: "Invalid teacher photo data" });
      }
    }

    const teacher = await (async () => {
      try {
        return await prisma.teacher.create({
          data: {
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
            middleName: normalizeOptionalUpperText(middleName),
            email: normalizeOptionalText(email),
            employeeId: normalizeOptionalUpperText(employeeId),
            contactNumber: normalizedContactNumber,
            specialization: normalizeOptionalUpperText(specialization),
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

    const atlasSync = await queueTeacherAtlasSync({
      teacherId: teacher.id,
      eventType: "teacher.created",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.store",
    });

    res.status(201).json({ teacher, atlasSync: mapAtlasSync(atlasSync) });
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("employeeId")) {
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
      subjects,
      photo,
    } = req.body;

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const normalizedSubjects = Array.isArray(subjects)
      ? Array.from(
          new Set(
            subjects
              .map((subject: unknown) => String(subject).trim().toUpperCase())
              .filter((subject: string) => subject.length > 0),
          ),
        )
      : undefined;

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

    const atlasSync = await queueTeacherAtlasSync({
      teacherId: id,
      eventType: "teacher.updated",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.update",
    });

    res.json({ teacher, atlasSync: mapAtlasSync(atlasSync) });
  } catch (error: any) {
    if (error.code === "P2002" && error.meta?.target?.includes("employeeId")) {
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

    const atlasSync = await queueTeacherAtlasSync({
      teacherId: id,
      eventType: "teacher.deactivated",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.deactivate",
    });

    res.json({ teacher, atlasSync: mapAtlasSync(atlasSync) });
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

    const atlasSync = await queueTeacherAtlasSync({
      teacherId: id,
      eventType: "teacher.reactivated",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.reactivate",
    });

    res.json({ teacher, atlasSync: mapAtlasSync(atlasSync) });
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

    const latestSync = await getTeacherLatestAtlasSync(
      id,
      schoolContext.schoolYearId,
    );

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
      atlasSync: mapAtlasSync(latestSync),
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
            gradeLevel: {
              schoolYearId: payload.schoolYearId,
            },
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
            gradeLevel: {
              schoolYearId: payload.schoolYearId,
            },
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

    const atlasSync = await queueTeacherAtlasSync({
      teacherId: teacher.id,
      schoolYearId: payload.schoolYearId,
      eventType: "teacher.designation.updated",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.upsertDesignation",
      force: Boolean(payload.allowAdviserOverride),
      reason: normalizeOptionalText(payload.reason),
    });

    res.json({
      designation: mapDesignation(designation, schoolSetting?.id ?? null),
      collisionOverrideApplied: Boolean(
        collision && payload.allowAdviserOverride,
      ),
      atlasSync: mapAtlasSync(atlasSync),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function atlasFacultySync(req: Request, res: Response) {
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

    if (!schoolContext.schoolYearId) {
      return res.status(400).json({
        message:
          "No schoolYearId provided and no active school year configured",
      });
    }

    const teachers = await prisma.teacher.findMany({
      orderBy: { lastName: "asc" },
      include: {
        _count: { select: { sections: true } },
        teacherDesignations: {
          where: { schoolYearId: schoolContext.schoolYearId },
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
        atlasSyncEvents: {
          where: { schoolYearId: schoolContext.schoolYearId },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const rows = teachers.map((teacher) => {
      const designation = teacher.teacherDesignations[0] ?? null;
      const latestSync = teacher.atlasSyncEvents[0] ?? null;

      return {
        schoolId: schoolContext.schoolId,
        schoolName: schoolContext.schoolName,
        schoolYearId: schoolContext.schoolYearId,
        schoolYearLabel: schoolContext.schoolYearLabel,
        teacherId: teacher.id,
        employeeId: teacher.employeeId,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        fullName: formatTeacherName(teacher),
        isActive: teacher.isActive,
        sectionCount: teacher._count.sections,
        isClassAdviser: designation?.isClassAdviser ?? false,
        advisorySectionId: designation?.advisorySectionId ?? null,
        advisorySectionName: designation?.advisorySection?.name ?? null,
        advisorySectionGradeLevelId:
          designation?.advisorySection?.gradeLevelId ?? null,
        advisorySectionGradeLevelName:
          designation?.advisorySection?.gradeLevel?.name ?? null,
        advisoryEquivalentHoursPerWeek:
          designation?.advisoryEquivalentHoursPerWeek ?? 0,
        isTic: designation?.isTic ?? false,
        isTIC: designation?.isTic ?? false,
        isTeachingExempt: designation?.isTeachingExempt ?? false,
        customTargetTeachingHoursPerWeek:
          designation?.customTargetTeachingHoursPerWeek ?? null,
        designationNotes: designation?.designationNotes ?? null,
        effectiveFrom: toDateOnlyString(designation?.effectiveFrom ?? null),
        effectiveTo: toDateOnlyString(designation?.effectiveTo ?? null),
        updateReason: designation?.updateReason ?? null,
        updatedById: designation?.updatedById ?? null,
        updatedByName: designation?.updatedBy
          ? `${designation.updatedBy.lastName}, ${designation.updatedBy.firstName}`
          : null,
        updatedAt: toIsoString(designation?.updatedAt ?? null),
        atlasSync: latestSync
          ? mapAtlasSync({
              status: latestSync.status,
              eventRecordId: latestSync.id,
              eventId: latestSync.eventId,
              attemptCount: latestSync.attemptCount,
              maxAttempts: latestSync.maxAttempts,
              httpStatus: latestSync.httpStatus,
              errorMessage: latestSync.errorMessage,
              nextRetryAt: toIsoString(latestSync.nextRetryAt),
              acknowledgedAt: toIsoString(latestSync.acknowledgedAt),
            })
          : null,
      };
    });

    res.json({
      scope: {
        schoolId: schoolContext.schoolId,
        schoolName: schoolContext.schoolName,
        schoolYearId: schoolContext.schoolYearId,
        schoolYearLabel: schoolContext.schoolYearLabel,
      },
      generatedAt: new Date().toISOString(),
      teachers: rows,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function forceAtlasSync(req: Request, res: Response) {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid teacher ID" });
    }

    const schoolYearIdQuery = parseSchoolYearIdFromRequest(req);
    if (schoolYearIdQuery === "invalid") {
      return res
        .status(400)
        .json({ message: "schoolYearId must be a positive integer" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const sync = await queueTeacherAtlasSync({
      teacherId: id,
      schoolYearId: schoolYearIdQuery,
      eventType: "teacher.force_sync",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.forceAtlasSync",
      force: true,
      reason: normalizeOptionalText(
        (req.body as { reason?: string | null } | undefined)?.reason,
      ),
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_ATLAS_SYNC_FORCED",
      description: `Forced ATLAS sync for teacher: ${teacher.lastName}, ${teacher.firstName}`,
      subjectType: "Teacher",
      recordId: teacher.id,
      req,
    });

    return res.json({
      teacherId: id,
      atlasSync: mapAtlasSync(sync),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function forceAtlasSyncBatch(req: Request, res: Response) {
  try {
    const schoolYearIdQuery = parseSchoolYearIdFromRequest(req);
    if (schoolYearIdQuery === "invalid") {
      return res
        .status(400)
        .json({ message: "schoolYearId must be a positive integer" });
    }

    const teacherIdsFromBody = parseTeacherIdsFromBody(
      (req.body as { teacherIds?: unknown } | undefined)?.teacherIds,
    );

    if (teacherIdsFromBody && teacherIdsFromBody.length === 0) {
      return res
        .status(400)
        .json({ message: "teacherIds must contain positive integers" });
    }

    const targetTeacherIds =
      teacherIdsFromBody ??
      (
        await prisma.teacher.findMany({
          where: { isActive: true },
          select: { id: true },
          orderBy: { id: "asc" },
        })
      ).map((teacher) => teacher.id);

    if (targetTeacherIds.length === 0) {
      return res.status(404).json({ message: "No teachers found for sync" });
    }

    const batchResult = await queueBulkTeacherAtlasSync({
      teacherIds: targetTeacherIds,
      schoolYearId: schoolYearIdQuery,
      eventType: "teacher.force_sync.bulk",
      triggerUserId: req.user?.userId ?? null,
      triggerSource: "teacher.forceAtlasSyncBatch",
      force: true,
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "TEACHER_ATLAS_SYNC_BULK_FORCED",
      description: `Forced ATLAS sync for ${batchResult.total} teacher records`,
      subjectType: "Teacher",
      recordId: null,
      req,
    });

    return res.json({
      schoolYearId: schoolYearIdQuery,
      summary: {
        total: batchResult.total,
        queued: batchResult.queued,
        synced: batchResult.synced,
        failed: batchResult.failed,
        skipped: batchResult.skipped,
      },
      results: batchResult.results.map((entry) => ({
        teacherId: entry.teacherId,
        atlasSync: mapAtlasSync(entry.sync),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
