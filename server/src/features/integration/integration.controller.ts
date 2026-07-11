import type { Request, Response } from "express";
import axios from "axios";
import type { Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  isUuidLike,
  OFFICIAL_ENROLLMENT_STATUSES,
  parseOptionalText,
  parsePositiveInt,
  readSnapshotNumber,
  readSnapshotString,
  resolveSchoolYearScope,
} from "./integration.shared.js";
import { SectionAdviserStatus } from "../../generated/prisma/index.js";

// ---------------------------------------------------------------------------
// Local Prisma payload types — replace `any` throughout this file
// ---------------------------------------------------------------------------
type TeacherForFaculty = Prisma.TeacherGetPayload<{
  include: {
    _count: { select: { advisoryHistory: true } };
    department: { select: { id: true; code: true; name: true } };
    teacherDesignations: {
      include: {
        updatedBy: { select: { id: true; firstName: true; lastName: true } };
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

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function integrationHealth(
  _req: Request,
  res: Response,
): Promise<void> {
  const probeExternal = async (url: string, name: string) => {
    try {
      const start = Date.now();
      await axios.get(`${url}/api/health`, { timeout: 3000 });
      return { name, status: "ok", latency: `${Date.now() - start}ms` };
    } catch (error: unknown) {
      return {
        name,
        status: "offline",
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  };

  const [dbStatus, atlasHealth, aimsHealth, smartHealth] = await Promise.all([
    (async () => {
      try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        return { status: "ok", latency: `${Date.now() - start}ms` };
      } catch {
        return { status: "down" };
      }
    })(),
    probeExternal(
      process.env.ATLAS_API_BASE_URL || "http://njgrm.buru-degree.ts.net:5001",
      "ATLAS",
    ),
    probeExternal(
      process.env.AIMS_API_BASE_URL || "http://tfrog.buru-degree.ts.net:5000",
      "AIMS",
    ),
    probeExternal(
      process.env.SMART_API_BASE_URL ||
        "http://laptop-pfvh73qk.buru-degree.ts.net:5003",
      "SMART",
    ),
  ]);

  res.json({
    data: {
      status: dbStatus.status === "ok" ? "ok" : "degraded",
      db: dbStatus,
      systems: [atlasHealth, aimsHealth, smartHealth],
      timestamp: new Date().toISOString(),
    },
  });
}

export async function getActiveSchoolYear(
  req: Request,
  res: Response,
): Promise<void> {
  const scopeResult = await resolveSchoolYearScope(req);
  if ("status" in scopeResult) {
    res
      .status(scopeResult.status)
      .json({ error: { message: scopeResult.message } });
    return;
  }

  const { scope } = scopeResult;
  res.json({
    data: {
      id: scope.schoolYearId,
      yearLabel: scope.schoolYearLabel,
    },
  });
}

export async function listIntegrationLearners(
  req: Request,
  res: Response,
): Promise<void> {
  const scopeResult = await resolveSchoolYearScope(req);
  if ("status" in scopeResult) {
    res.status(scopeResult.status).json({
      error: { code: "VALIDATION_ERROR", message: scopeResult.message },
    });
    return;
  }
  const { scope } = scopeResult;
  const schoolYearId = scope.schoolYearId;

  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const sectionId = parsePositiveInt(req.query.sectionId);
  if (req.query.sectionId !== undefined && sectionId === null) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "sectionId must be a positive integer",
      },
    });
    return;
  }

  const gradeLevelId = parsePositiveInt(req.query.gradeLevelId);
  if (req.query.gradeLevelId !== undefined && gradeLevelId === null) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "gradeLevelId must be a positive integer",
      },
    });
    return;
  }

  const search = parseOptionalText(req.query.search);

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { status: true },
  });

  if (schoolYear?.status === "ARCHIVED") {
    const historyWhere: Prisma.EnrollmentHistoryWhereInput = {
      schoolYearId,
      ...(sectionId ? { sectionId } : {}),
      ...(gradeLevelId ? { gradeLevelId } : {}),
      ...(search
        ? {
            OR: [
              { learner: { lrn: { contains: search, mode: "insensitive" } } },
              { learner: { firstName: { contains: search, mode: "insensitive" } } },
              { learner: { lastName: { contains: search, mode: "insensitive" } } },
              ...(isUuidLike(search)
                ? [{ learner: { externalId: search.toLowerCase() } }]
                : []),
            ],
          }
        : {}),
    };

    const [total, histories] = await Promise.all([
      prisma.enrollmentHistory.count({ where: historyWhere }),
      prisma.enrollmentHistory.findMany({
        where: historyWhere,
        orderBy: [
          { gradeLevel: { displayOrder: "asc" } },
          { learner: { lastName: "asc" } },
          { learner: { firstName: "asc" } },
        ],
        skip,
        take: limit,
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
              birthdate: true,
              sex: true,
              userId: true,
              isPendingLrnCreation: true,
              status: true,
              user: {
                select: {
                  accountName: true,
                  isActive: true,
                  mustChangePassword: true,
                },
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
      }),
    ]);

    res.json({
      data: histories.map((history) => ({
        enrollmentApplicationId:
          readSnapshotNumber(
            history.learnerProfileSnapshot,
            "enrollmentApplicationId",
          ) ?? null,
        status: "ARCHIVED",
        learnerType:
          readSnapshotString(history.learnerProfileSnapshot, "learnerType") ??
          "CONTINUING",
        applicantType:
          readSnapshotString(history.learnerProfileSnapshot, "applicantType") ??
          history.section?.programType ??
          "REGULAR",
        learner: {
          id: history.learner.id,
          externalId: history.learner.externalId,
          lrn: history.learner.lrn,
          firstName: history.learner.firstName,
          lastName: history.learner.lastName,
          middleName: history.learner.middleName,
          extensionName: history.learner.extensionName,
          birthdate: history.learner.birthdate,
          sex: history.learner.sex,
          userId: history.learner.userId ?? null,
          isPendingLrnCreation: history.learner.isPendingLrnCreation,
          learnerStatus: history.learner.status,
          portalAccount: history.learner.user
            ? {
                accountName: history.learner.user.accountName,
                isActive: history.learner.user.isActive,
                mustChangePassword: history.learner.user.mustChangePassword,
              }
            : null,
        },
        schoolYear: {
          id: scope.schoolYearId,
          yearLabel: scope.schoolYearLabel,
        },
        gradeLevel: history.gradeLevel,
        section: history.section,
        enrolledAt: null,
        eosyStatus: history.eosyStatus,
        finalAverage: history.genAve,
      })),
      meta: {
        schoolYearId,
        source: "ENROLLMENT_HISTORY",
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    return;
  }

  const where: Record<string, unknown> = {
    schoolYearId,
    status: { in: OFFICIAL_ENROLLMENT_STATUSES },
    enrollmentRecord: sectionId
      ? {
          is: { sectionId },
        }
      : {
          isNot: null,
        },
  };

  if (gradeLevelId) {
    where.gradeLevelId = gradeLevelId;
  }

  if (search) {
    const normalizedSearch = search.toLowerCase();
    const searchOrFilters: Array<Record<string, unknown>> = [
      {
        learner: {
          lrn: { contains: search, mode: "insensitive" as const },
        },
      },
      {
        learner: {
          firstName: { contains: search, mode: "insensitive" as const },
        },
      },
      {
        learner: {
          lastName: { contains: search, mode: "insensitive" as const },
        },
      },
    ];

    if (isUuidLike(normalizedSearch)) {
      searchOrFilters.push({
        learner: {
          externalId: normalizedSearch,
        },
      });
    }

    const searchFilter = {
      OR: searchOrFilters,
    };

    where.AND = Array.isArray(where.AND)
      ? [...(where.AND as unknown[]), searchFilter]
      : [searchFilter];
  }

  const [total, applications] = await Promise.all([
    prisma.enrollmentApplication.count({ where }),
    prisma.enrollmentApplication.findMany({
      where,
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
            birthdate: true,
            sex: true,
            userId: true,
            isPendingLrnCreation: true,
            status: true,
            user: {
              select: {
                accountName: true,
                isActive: true,
                mustChangePassword: true,
              },
            },
          },
        },
        schoolYear: {
          select: {
            id: true,
            yearLabel: true,
          },
        },
        gradeLevel: {
          select: {
            id: true,
            name: true,
            displayOrder: true,
          },
        },
        enrollmentRecord: {
          select: {
            id: true,
            enrolledAt: true,
            section: {
              select: {
                id: true,
                name: true,
                programType: true,
              },
            },
          },
        },
      },
      orderBy: [{ gradeLevelId: "asc" }, { id: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: applications.map((application) => ({
      enrollmentApplicationId: application.id,
      status: application.status,
      learnerType: application.learnerType,
      applicantType: application.applicantType,
      learner: {
        id: application.learner.id,
        externalId: application.learner.externalId,
        lrn: application.learner.lrn,
        firstName: application.learner.firstName,
        lastName: application.learner.lastName,
        middleName: application.learner.middleName,
        extensionName: application.learner.extensionName,
        birthdate: application.learner.birthdate,
        sex: application.learner.sex,
        userId: application.learner.userId ?? null,
        isPendingLrnCreation: application.learner.isPendingLrnCreation,
        learnerStatus: application.learner.status,
        portalAccount: application.learner.user
          ? {
              accountName: application.learner.user.accountName,
              isActive: application.learner.user.isActive,
              mustChangePassword: application.learner.user.mustChangePassword,
            }
          : null,
      },
      schoolYear: application.schoolYear,
      gradeLevel: application.gradeLevel,
      section: application.enrollmentRecord?.section ?? null,
      enrolledAt: application.enrollmentRecord?.enrolledAt ?? null,
    })),
    meta: {
      schoolYearId,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function listIntegrationFaculty(
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

  // DPA: only expose inactive records when explicitly requested
  const includeInactive =
    String(req.query.includeInactive ?? "false").toLowerCase() === "true";

  // Pagination — consistent with the rest of the integration layer
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const where = includeInactive ? {} : { isActive: true };

  const [total, teachers] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip,
      take: limit,
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
    }),
  ]);

  const rows = teachers.map((teacher: TeacherForFaculty) => {
    const designation = teacher.teacherDesignations[0] ?? null;

    // NOTE: designationNotes, updateReason, updatedById, updatedByName, updatedAt
    // are internal HR audit fields — excluded to comply with DPA minimization.
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
      schoolId: scope.schoolId,
      schoolName: scope.schoolName,
      schoolYearId: scope.schoolYearId,
      schoolYearLabel: scope.schoolYearLabel,
      ancillaryRoles: designation?.ancillaryRoles ?? [],
      isClassAdviser: designation?.isClassAdviser ?? false,
      advisorySectionId: designation?.advisorySectionId ?? null,
      advisorySectionName: designation?.advisorySection?.name ?? null,
      advisorySectionGradeLevelId:
        designation?.advisorySection?.gradeLevelId ?? null,
      advisorySectionGradeLevelName:
        designation?.advisorySection?.gradeLevel?.name ?? null,
      effectiveFrom: designation?.effectiveFrom ?? null,
      effectiveTo: designation?.effectiveTo ?? null,
    };
  });

  res.json({
    data: rows,
    meta: {
      generatedAt: new Date().toISOString(),
      scope,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      includeInactive,
    },
  });
}

export async function listIntegrationSections(
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

  const gradeLevelId = parsePositiveInt(req.query.gradeLevelId);
  if (req.query.gradeLevelId !== undefined && gradeLevelId === null) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "gradeLevelId must be a positive integer",
      },
    });
    return;
  }

  const where: Record<string, unknown> = {
    schoolYearId: scope.schoolYearId,
  };

  if (gradeLevelId) {
    where.gradeLevelId = gradeLevelId;
  }

  // Pagination
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const [total, sections] = await Promise.all([
    prisma.section.count({ where }),
    prisma.section.findMany({
      where,
      include: {
        gradeLevel: {
          select: {
            id: true,
            name: true,
            displayOrder: true,
          },
        },
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
          include: {
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
              },
            },
          },
        },
        _count: {
          select: {
            enrollmentRecords: true,
            enrollmentHistories: true,
          },
        },
        schoolYear: {
          select: { status: true },
        },
      },
      orderBy: [{ gradeLevel: { displayOrder: "asc" } }, { name: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: sections.map((section) => {
      const activeAdviser = section.advisers[0]?.teacher ?? null;
      const enrolledCount =
        section.schoolYear.status === "ARCHIVED"
          ? section._count.enrollmentHistories
          : section._count.enrollmentRecords;
      return {
        id: section.id,
        name: section.name,
        programType: section.programType,
        maxCapacity: section.maxCapacity,
        enrolledCount,
        availableSlots: Math.max(
          0,
          section.maxCapacity - enrolledCount,
        ),
        gradeLevel: section.gradeLevel,
        advisingTeacher: activeAdviser
          ? {
              id: activeAdviser.id,
              firstName: activeAdviser.firstName,
              lastName: activeAdviser.lastName,
              middleName: activeAdviser.middleName,
            }
          : null,
        schoolYear: {
          id: scope.schoolYearId,
          yearLabel: scope.schoolYearLabel,
        },
      };
    }),
    meta: {
      scope,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

export async function listSectionLearners(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = parsePositiveInt(req.params.sectionId);
  if (!sectionId) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "sectionId must be a positive integer",
      },
    });
    return;
  }

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
  const page = parsePositiveInt(req.query.page) ?? 1;
  const limit = Math.min(
    parsePositiveInt(req.query.limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );
  const skip = (page - 1) * limit;

  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      schoolYearId: scope.schoolYearId,
    },
    include: {
      gradeLevel: {
        select: {
          id: true,
          name: true,
          displayOrder: true,
        },
      },
      advisers: {
        where: { status: SectionAdviserStatus.ACTIVE },
        include: {
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
            },
          },
        },
      },
    },
  });

  if (!section) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Section not found for the selected school year",
      },
    });
    return;
  }

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: scope.schoolYearId },
    select: { status: true },
  });

  if (schoolYear?.status === "ARCHIVED") {
    const [total, histories] = await Promise.all([
      prisma.enrollmentHistory.count({
        where: { sectionId, schoolYearId: scope.schoolYearId },
      }),
      prisma.enrollmentHistory.findMany({
        where: { sectionId, schoolYearId: scope.schoolYearId },
        orderBy: [
          { learner: { lastName: "asc" } },
          { learner: { firstName: "asc" } },
        ],
        skip,
        take: limit,
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
              sex: true,
              birthdate: true,
              userId: true,
              isPendingLrnCreation: true,
              status: true,
              user: {
                select: {
                  accountName: true,
                  isActive: true,
                  mustChangePassword: true,
                },
              },
            },
          },
        },
      }),
    ]);
    const historicalAdviser = await prisma.enrollmentHistory.findFirst({
      where: {
        sectionId,
        schoolYearId: scope.schoolYearId,
        adviserId: { not: null },
      },
      include: {
        adviser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
    });

    res.json({
      data: {
        section: {
          id: section.id,
          name: section.name,
          programType: section.programType,
          maxCapacity: section.maxCapacity,
          gradeLevel: section.gradeLevel,
          advisingTeacher: historicalAdviser?.adviser
            ? {
                id: historicalAdviser.adviser.id,
                name: buildTeacherName(historicalAdviser.adviser),
              }
            : null,
        },
        learners: histories.map((history) => ({
          enrollmentRecordId: null,
          enrolledAt: null,
          enrollmentApplicationId:
            readSnapshotNumber(
              history.learnerProfileSnapshot,
              "enrollmentApplicationId",
            ) ?? null,
          status: "ARCHIVED",
          learnerType:
            readSnapshotString(history.learnerProfileSnapshot, "learnerType") ??
            "CONTINUING",
          applicantType:
            readSnapshotString(history.learnerProfileSnapshot, "applicantType") ??
            section.programType,
          learner: history.learner,
          eosyStatus: history.eosyStatus,
          finalAverage: history.genAve,
        })),
      },
      meta: {
        scope,
        source: "ENROLLMENT_HISTORY",
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
    return;
  }

  const [total, enrollmentRecords] = await Promise.all([
    prisma.enrollmentRecord.count({
      where: {
        sectionId,
        schoolYearId: scope.schoolYearId,
      },
    }),
    prisma.enrollmentRecord.findMany({
      where: {
        sectionId,
        schoolYearId: scope.schoolYearId,
      },
      include: {
        enrollmentApplication: {
          select: {
            id: true,
            status: true,
            learnerType: true,
            applicantType: true,
            learner: {
              select: {
                id: true,
                externalId: true,
                lrn: true,
                firstName: true,
                lastName: true,
                middleName: true,
                extensionName: true,
                sex: true,
                birthdate: true,
                userId: true,
                isPendingLrnCreation: true,
                status: true,
                user: {
                  select: {
                    accountName: true,
                    isActive: true,
                    mustChangePassword: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
  ]);

  const activeAdviser = section.advisers[0]?.teacher ?? null;

  res.json({
    data: {
      section: {
        id: section.id,
        name: section.name,
        programType: section.programType,
        maxCapacity: section.maxCapacity,
        gradeLevel: section.gradeLevel,
        advisingTeacher: activeAdviser
          ? {
              id: activeAdviser.id,
              name: buildTeacherName(activeAdviser),
            }
          : null,
      },
      learners: enrollmentRecords.map((record) => ({
        enrollmentRecordId: record.id,
        enrolledAt: record.enrolledAt,
        enrollmentApplicationId: record.enrollmentApplication.id,
        status: record.enrollmentApplication.status,
        learnerType: record.enrollmentApplication.learnerType,
        applicantType: record.enrollmentApplication.applicantType,
        learner: record.enrollmentApplication.learner,
      })),
    },
    meta: {
      scope,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}
