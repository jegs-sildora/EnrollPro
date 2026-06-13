import type { Request, Response } from "express";
import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  parsePositiveInt,
  resolveSchoolYearScope,
} from "./integration.shared.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Local Prisma payload types — eliminates `any` throughout this file
// ---------------------------------------------------------------------------
type TeacherForDefault = Prisma.TeacherGetPayload<{
  include: {
    _count: { select: { advisoryHistory: true } };
    department: { select: { id: true; code: true; name: true } };
    teacherDesignations: {
      include: {
        advisorySection: {
          select: {
            id: true;
            name: true;
            gradeLevelId: true;
            gradeLevel: { select: { name: true } };
          };
        };
      };
    };
  };
}>;

// ---------------------------------------------------------------------------
// Staff roles exported by this feed
// ---------------------------------------------------------------------------

function buildStaffName(user: {
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
}): string {
  const middle = user.middleName ? ` ${user.middleName.charAt(0)}.` : "";
  const suffix = user.suffix ? ` ${user.suffix}` : "";
  return `${user.lastName}, ${user.firstName}${middle}${suffix}`;
}

function buildLearnerName(learner: {
  firstName: string;
  lastName: string;
  middleName: string | null;
  extensionName: string | null;
}): string {
  const middle = learner.middleName ? ` ${learner.middleName}` : "";
  const extension = learner.extensionName ? ` ${learner.extensionName}` : "";
  return `${learner.lastName}, ${learner.firstName}${middle}${extension}`;
}

// ---------------------------------------------------------------------------
// Shared learner fetch helpers — DPA-minimized per subsystem contract
// ---------------------------------------------------------------------------

/**
 * AIMS context rows — enrolled students only, no demographic PII.
 * Includes learnerType, applicantType, learningModalities, and remedial flag
 * needed by the LMS to build virtual classrooms and pre-assign remedial modules.
 */
async function fetchAimsLearnerRows(
  schoolYearId: number,
  skip = 0,
  take = MAX_PAGE_SIZE,
) {
  return prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: "ENROLLED",
      enrollmentRecord: { isNot: null },
    },
    include: {
      learner: {
        select: {
          id: true,
          externalId: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
          extensionName: true,
          userId: true,
          isPendingLrnCreation: true,
          status: true,
          user: {
            select: {
              accountName: true,
              isActive: true,
            },
          },
        },
      },
      gradeLevel: {
        select: { id: true, name: true, displayOrder: true },
      },
      enrollmentRecord: {
        select: {
          id: true,
          enrolledAt: true,
          section: {
            select: { id: true, name: true, programType: true },
          },
        },
      },
      // Include isRemedialRequired for remedial risk flag
    },
    orderBy: [{ gradeLevelId: "asc" }, { id: "asc" }],
    skip,
    take,
  });
}

/**
 * SMART roster rows — active + dropped students, minimum fields for grade encoding.
 * Excludes birthdate, sex, userId, portal account, and parent data per DPA minimization.
 */
async function fetchSmartLearnerRows(
  schoolYearId: number,
  skip = 0,
  take = MAX_PAGE_SIZE,
) {
  return prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      // Include dropped students so SMART can reflect their status in class records
      status: { in: ["ENROLLED", "SECTIONED"] },
      enrollmentRecord: { isNot: null },
    },
    include: {
      learner: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
          extensionName: true,
          isPendingLrnCreation: true,
        },
      },
      gradeLevel: {
        select: { id: true, name: true, displayOrder: true },
      },
      enrollmentRecord: {
        select: {
          id: true,
          enrolledAt: true,
          eosyStatus: true,
          dropOutDate: true,
          dropOutReason: true,
          section: {
            select: { id: true, name: true, programType: true },
          },
        },
      },
    },
    orderBy: [{ gradeLevelId: "asc" }, { id: "asc" }],
    skip,
    take,
  });
}

const STAFF_ROLES = [
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
  "CLASS_ADVISER",
  "TEACHER",
] as const;

export async function listIntegrationStaff(
  req: Request,
  res: Response,
): Promise<void> {
  const includeInactive =
    String(req.query.includeInactive ?? "false").toLowerCase() === "true";

  // Pagination
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const where = {
    roles: { hasSome: [...STAFF_ROLES] },
    ...(includeInactive ? {} : { isActive: true }),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      // DPA: omit mustChangePassword and lastLoginAt (operational security fields)
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        email: true,
        roles: true,
        isActive: true,
        employeeId: true,
        accountName: true,
        designation: true,
        mobileNumber: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: users.map((user) => ({
      id: user.id,
      employeeId: user.employeeId,
      accountName: user.accountName,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      suffix: user.suffix,
      fullName: buildStaffName(user),
      email: user.email,
      roles: user.roles,
      designation: user.designation,
      mobileNumber: user.mobileNumber,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
    meta: {
      generatedAt: new Date().toISOString(),
      includeInactive,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function listDefaultFaculty(
  req: Request,
  res: Response,
): Promise<void> {
  const scopeResult = await resolveSchoolYearScope(req);
  if ("status" in scopeResult) {
    res.status(scopeResult.status).json({
      error: {
        code: "VALIDATION_ERROR",
        message: scopeResult.message,
      },
    });
    return;
  }

  const { scope } = scopeResult;

  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { advisoryHistory: true } },
      department: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      teacherDesignations: {
        where: { schoolYearId: scope.schoolYearId },
        include: {
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

  const rows = teachers.map((teacher: TeacherForDefault) => {
    const designation = teacher.teacherDesignations[0] ?? null;

    // DPA: designationNotes is an internal HR field — excluded from external feeds.
    return {
      teacherId: teacher.id,
      employeeId: teacher.employeeId,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      middleName: teacher.middleName,
      fullName: buildTeacherName(teacher),
      email: teacher.email,
      contactNumber: teacher.contactNumber,
      specialization: teacher.specialization,
      isActive: teacher.isActive,
      departmentId: teacher.departmentId ?? null,
      departmentCode: teacher.department?.code ?? null,
      departmentName: teacher.department?.name ?? null,
      sectionCount: teacher._count.advisoryHistory,
      isClassAdviser: designation?.isClassAdviser ?? false,
      effectiveFrom: designation?.effectiveFrom ?? null,
      effectiveTo: designation?.effectiveTo ?? null,
      advisorySection: designation?.advisorySection
        ? {
            id: designation.advisorySection.id,
            name: designation.advisorySection.name,
            gradeLevelId: designation.advisorySection.gradeLevelId,
            gradeLevelName:
              designation.advisorySection.gradeLevel?.name ?? null,
          }
        : null,
    };
  });

  res.json({
    data: rows,
    meta: {
      sourceSystem: "ENROLLPRO",
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      totalRows: rows.length,
    },
  });
}

export async function listDefaultSmartStudents(
  req: Request,
  res: Response,
): Promise<void> {
  const scopeResult = await resolveSchoolYearScope(req);
  if ("status" in scopeResult) {
    res.status(scopeResult.status).json({
      error: {
        code: "VALIDATION_ERROR",
        message: scopeResult.message,
      },
    });
    return;
  }

  const { scope } = scopeResult;

  // Pagination
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  // Count only SMART-eligible statuses (ENROLLED, TEMPORARILY_ENROLLED, DROPPED)
  const [total, applications] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId: scope.schoolYearId,
        status: { in: ["ENROLLED", "SECTIONED"] },
        enrollmentRecord: { isNot: null },
      },
    }),
    fetchSmartLearnerRows(scope.schoolYearId, skip, limit),
  ]);

  // DPA: SMART is a grading system — birthdate, sex, userId, portal account
  // are NOT included. Only LRN, name, grade/section, and EOSY/drop-out status.
  res.json({
    data: applications.map((application) => ({
      enrollmentApplicationId: application.id,
      enrollmentStatus: application.status,
      lrn: application.learner.lrn,
      isPendingLrn: application.learner.isPendingLrnCreation,
      fullName: buildLearnerName(application.learner),
      firstName: application.learner.firstName,
      lastName: application.learner.lastName,
      middleName: application.learner.middleName,
      extensionName: application.learner.extensionName,
      gradeLevel: application.gradeLevel,
      section: application.enrollmentRecord?.section ?? null,
      enrolledAt: application.enrollmentRecord?.enrolledAt ?? null,
      eosyStatus: application.enrollmentRecord?.eosyStatus ?? null,
      dropOutDate: application.enrollmentRecord?.dropOutDate ?? null,
      dropOutReason: application.enrollmentRecord?.dropOutReason ?? null,
      schoolYear: {
        id: scope.schoolYearId,
        yearLabel: scope.schoolYearLabel,
      },
    })),
    meta: {
      sourceSystem: "SMART",
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function listDefaultAimsContext(
  req: Request,
  res: Response,
): Promise<void> {
  const scopeResult = await resolveSchoolYearScope(req);
  if ("status" in scopeResult) {
    res.status(scopeResult.status).json({
      error: {
        code: "VALIDATION_ERROR",
        message: scopeResult.message,
      },
    });
    return;
  }

  const { scope } = scopeResult;

  // Pagination
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const [total, applications] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId: scope.schoolYearId,
        status: "ENROLLED",
        enrollmentRecord: { isNot: null },
      },
    }),
    fetchAimsLearnerRows(scope.schoolYearId, skip, limit),
  ]);

  // DPA: AIMS is an LMS — birthdate and sex are NOT included.
  // isRemedialRequired IS included because AIMS must pre-assign remedial modules.
  res.json({
    data: applications.map((application) => ({
      enrollmentApplicationId: application.id,
      applicantType: application.applicantType,
      learnerType: application.learnerType,
      learningModalities: application.learningModalities,
      isRemedialRequired: application.isRemedialRequired ?? false,
      learner: {
        externalId: application.learner.externalId,
        lrn: application.learner.lrn,
        firstName: application.learner.firstName,
        lastName: application.learner.lastName,
        middleName: application.learner.middleName,
        extensionName: application.learner.extensionName,
        fullName: buildLearnerName(application.learner),
        userId: application.learner.userId ?? null,
        isPendingLrnCreation: application.learner.isPendingLrnCreation,
        learnerStatus: application.learner.status,
        portalAccount: application.learner.user
          ? {
              accountName: application.learner.user.accountName,
              isActive: application.learner.user.isActive,
            }
          : null,
      },
      context: {
        gradeLevel: application.gradeLevel,
        section: application.enrollmentRecord?.section ?? null,
        schoolYear: {
          id: scope.schoolYearId,
          yearLabel: scope.schoolYearLabel,
        },
      },
    })),
    meta: {
      sourceSystem: "AIMS",
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
