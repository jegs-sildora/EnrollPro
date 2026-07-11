import type { Request, Response } from "express";
import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  OFFICIAL_ENROLLMENT_STATUSES,
  parsePositiveInt,
  readSnapshotNumber,
  readSnapshotString,
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
      status: { in: OFFICIAL_ENROLLMENT_STATUSES },
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
 * SMART masterlist rows — active + dropped students, minimum fields for grade encoding.
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
      status: { in: OFFICIAL_ENROLLMENT_STATUSES },
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

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: scope.schoolYearId },
    select: { status: true },
  });

  if (schoolYear?.status === "ARCHIVED") {
    const [total, histories] = await Promise.all([
      prisma.enrollmentHistory.count({
        where: { schoolYearId: scope.schoolYearId },
      }),
      fetchHistoricalLearnerRows(scope.schoolYearId, skip, limit),
    ]);

    res.json({
      data: histories.map((history) => ({
        enrollmentApplicationId:
          readSnapshotNumber(
            history.learnerProfileSnapshot,
            "enrollmentApplicationId",
          ) ?? null,
        enrollmentStatus: "ARCHIVED",
        lrn: history.learner.lrn,
        isPendingLrn: history.learner.isPendingLrnCreation,
        fullName: buildLearnerName(history.learner),
        firstName: history.learner.firstName,
        lastName: history.learner.lastName,
        middleName: history.learner.middleName,
        extensionName: history.learner.extensionName,
        gradeLevel: history.gradeLevel,
        section: history.section,
        enrolledAt: null,
        eosyStatus: history.eosyStatus,
        finalAverage: history.genAve,
        dropOutDate: null,
        dropOutReason: null,
        schoolYear: {
          id: scope.schoolYearId,
          yearLabel: scope.schoolYearLabel,
        },
      })),
      meta: {
        sourceSystem: "SMART",
        source: "ENROLLMENT_HISTORY",
        generatedAt: new Date().toISOString(),
        scopeSchoolYearId: scope.schoolYearId,
        scopeSchoolYearLabel: scope.schoolYearLabel,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    return;
  }

  // Include every application status produced by current sectioning workflows.
  const [total, applications] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId: scope.schoolYearId,
        status: { in: OFFICIAL_ENROLLMENT_STATUSES },
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

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: scope.schoolYearId },
    select: { status: true },
  });

  if (schoolYear?.status === "ARCHIVED") {
    const [total, histories] = await Promise.all([
      prisma.enrollmentHistory.count({
        where: { schoolYearId: scope.schoolYearId },
      }),
      fetchHistoricalLearnerRows(scope.schoolYearId, skip, limit),
    ]);

    res.json({
      data: histories.map((history) => ({
        enrollmentApplicationId:
          readSnapshotNumber(
            history.learnerProfileSnapshot,
            "enrollmentApplicationId",
          ) ?? null,
        applicantType:
          readSnapshotString(history.learnerProfileSnapshot, "applicantType") ??
          history.section?.programType ??
          "REGULAR",
        learnerType:
          readSnapshotString(history.learnerProfileSnapshot, "learnerType") ??
          "CONTINUING",
        learningModalities: [],
        isRemedialRequired:
          history.eosyStatus === "CONDITIONALLY_PROMOTED",
        learner: {
          externalId: history.learner.externalId,
          lrn: history.learner.lrn,
          firstName: history.learner.firstName,
          lastName: history.learner.lastName,
          middleName: history.learner.middleName,
          extensionName: history.learner.extensionName,
          fullName: buildLearnerName(history.learner),
          userId: history.learner.userId ?? null,
          isPendingLrnCreation: history.learner.isPendingLrnCreation,
          learnerStatus: history.learner.status,
          portalAccount: history.learner.user
            ? {
                accountName: history.learner.user.accountName,
                isActive: history.learner.user.isActive,
              }
            : null,
        },
        context: {
          gradeLevel: history.gradeLevel,
          section: history.section,
          schoolYear: {
            id: scope.schoolYearId,
            yearLabel: scope.schoolYearLabel,
          },
        },
        eosyStatus: history.eosyStatus,
        finalAverage: history.genAve,
      })),
      meta: {
        sourceSystem: "AIMS",
        source: "ENROLLMENT_HISTORY",
        generatedAt: new Date().toISOString(),
        scopeSchoolYearId: scope.schoolYearId,
        scopeSchoolYearLabel: scope.schoolYearLabel,
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    return;
  }

  const [total, applications] = await Promise.all([
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId: scope.schoolYearId,
        status: { in: OFFICIAL_ENROLLMENT_STATUSES },
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

async function fetchHistoricalLearnerRows(
  schoolYearId: number,
  skip = 0,
  take = MAX_PAGE_SIZE,
) {
  return prisma.enrollmentHistory.findMany({
    where: { schoolYearId },
    orderBy: [
      { gradeLevel: { displayOrder: "asc" } },
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
    skip,
    take,
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
            select: { accountName: true, isActive: true },
          },
        },
      },
      gradeLevel: {
        select: { id: true, name: true, displayOrder: true },
      },
      section: {
        select: { id: true, name: true, programType: true },
      },
    },
  });
}

interface MrfLearnerIdentity {
  learnerId: number;
  externalId: string;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  extensionName: string | null;
  accountName: string | null;
  accountActive: boolean;
  learnerStatus: string;
  enrollmentStatus: string;
  gradeLevel: {
    id: number;
    name: string;
    displayOrder: number;
  };
  section: {
    id: number;
    name: string;
    programType: string;
  } | null;
}

interface MrfTeacherIdentity {
  teacherId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  accountName: string | null;
  accountActive: boolean;
  roles: string[];
  serviceStatus: string;
}

interface MrfStaffIdentity {
  userId: number;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  accountName: string | null;
  roles: string[];
  designation: string | null;
  accountActive: boolean;
}

const MRF_PERSONNEL_ROLES = [
  "SYSTEM_ADMIN",
  "HEAD_REGISTRAR",
  "CLASS_ADVISER",
  "TEACHER",
  "MRF",
] as const;

/**
 * MRF identity synchronization feed. The response deliberately excludes
 * passwords, family details, health information, and operational audit fields.
 */
export async function listDefaultMrfIdentities(
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
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: scope.schoolYearId },
    select: { status: true },
  });

  const [teachers, staff] = await Promise.all([
    prisma.teacher.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        serviceStatus: true,
        user: {
          select: {
            accountName: true,
            isActive: true,
            roles: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        roles: { hasSome: [...MRF_PERSONNEL_ROLES] },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        suffix: true,
        accountName: true,
        roles: true,
        designation: true,
        isActive: true,
      },
    }),
  ]);

  let learners: MrfLearnerIdentity[];
  if (schoolYear?.status === "ARCHIVED") {
    const histories = await prisma.enrollmentHistory.findMany({
      where: { schoolYearId: scope.schoolYearId },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { learner: { lastName: "asc" } },
        { learner: { firstName: "asc" } },
      ],
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
            status: true,
            user: {
              select: { accountName: true, isActive: true },
            },
          },
        },
        gradeLevel: {
          select: { id: true, name: true, displayOrder: true },
        },
        section: {
          select: { id: true, name: true, programType: true },
        },
      },
    });

    learners = histories.map((history) => ({
      learnerId: history.learner.id,
      externalId: history.learner.externalId,
      lrn: history.learner.lrn,
      firstName: history.learner.firstName,
      lastName: history.learner.lastName,
      middleName: history.learner.middleName,
      extensionName: history.learner.extensionName,
      accountName: history.learner.user?.accountName ?? null,
      accountActive: history.learner.user?.isActive ?? false,
      learnerStatus: history.learner.status,
      enrollmentStatus: "ARCHIVED",
      gradeLevel: history.gradeLevel,
      section: history.section,
    }));
  } else {
    const applications = await prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId: scope.schoolYearId,
        status: { in: OFFICIAL_ENROLLMENT_STATUSES },
        enrollmentRecord: { isNot: null },
      },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { learner: { lastName: "asc" } },
        { learner: { firstName: "asc" } },
      ],
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
            status: true,
            user: {
              select: { accountName: true, isActive: true },
            },
          },
        },
        gradeLevel: {
          select: { id: true, name: true, displayOrder: true },
        },
        enrollmentRecord: {
          select: {
            section: {
              select: { id: true, name: true, programType: true },
            },
          },
        },
      },
    });

    learners = applications.map((application) => ({
      learnerId: application.learner.id,
      externalId: application.learner.externalId,
      lrn: application.learner.lrn,
      firstName: application.learner.firstName,
      lastName: application.learner.lastName,
      middleName: application.learner.middleName,
      extensionName: application.learner.extensionName,
      accountName: application.learner.user?.accountName ?? null,
      accountActive: application.learner.user?.isActive ?? false,
      learnerStatus: application.learner.status,
      enrollmentStatus: application.status,
      gradeLevel: application.gradeLevel,
      section: application.enrollmentRecord?.section ?? null,
    }));
  }

  const teacherIdentities: MrfTeacherIdentity[] = teachers.map((teacher) => ({
    teacherId: teacher.id,
    employeeId: teacher.employeeId,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    middleName: teacher.middleName,
    suffix: teacher.suffix,
    accountName: teacher.user?.accountName ?? null,
    accountActive: teacher.user?.isActive ?? false,
    roles: teacher.user?.roles ?? [],
    serviceStatus: teacher.serviceStatus,
  }));
  const staffIdentities: MrfStaffIdentity[] = staff.map((user) => ({
    userId: user.id,
    employeeId: user.employeeId,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    suffix: user.suffix,
    accountName: user.accountName,
    roles: user.roles,
    designation: user.designation,
    accountActive: user.isActive,
  }));

  res.json({
    data: {
      learners,
      teachers: teacherIdentities,
      staff: staffIdentities,
    },
    meta: {
      sourceSystem: "ENROLLPRO",
      consumerSystem: "MRF",
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      counts: {
        learners: learners.length,
        teachers: teacherIdentities.length,
        staff: staffIdentities.length,
      },
    },
  });
}
