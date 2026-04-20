import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  isUuidLike,
  parseOptionalText,
  parsePositiveInt,
  resolveSchoolYearScope,
} from "./integration.shared.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function integrationHealth(
  _req: Request,
  res: Response,
): Promise<void> {
  let dbStatus: "connected" | "down" = "connected";
  let dbLatencyMs = 0;

  try {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startedAt;
  } catch {
    dbStatus = "down";
  }

  res.status(dbStatus === "connected" ? 200 : 503).json({
    data: {
      status: dbStatus === "connected" ? "ok" : "degraded",
      db: dbStatus,
      dbLatencyMs,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function listIntegrationLearners(
  req: Request,
  res: Response,
): Promise<void> {
  const schoolYearId = parsePositiveInt(req.query.schoolYearId);
  if (!schoolYearId) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "schoolYearId is required and must be a positive integer",
      },
    });
    return;
  }

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

  const where: Record<string, unknown> = {
    schoolYearId,
    status: { in: ["OFFICIALLY_ENROLLED", "ENROLLED"] },
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

  const teachers = await prisma.teacher.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      _count: { select: { sections: true } },
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
  });

  const rows = teachers.map((teacher) => {
    const designation = teacher.teacherDesignations[0] ?? null;

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
      sectionCount: teacher._count.sections,
      schoolId: scope.schoolId,
      schoolName: scope.schoolName,
      schoolYearId: scope.schoolYearId,
      schoolYearLabel: scope.schoolYearLabel,
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
      effectiveFrom: designation?.effectiveFrom ?? null,
      effectiveTo: designation?.effectiveTo ?? null,
      updateReason: designation?.updateReason ?? null,
      updatedById: designation?.updatedById ?? null,
      updatedByName: designation?.updatedBy
        ? `${designation.updatedBy.lastName}, ${designation.updatedBy.firstName}`
        : null,
      updatedAt: designation?.updatedAt ?? null,
    };
  });

  res.json({
    data: rows,
    meta: {
      generatedAt: new Date().toISOString(),
      scope,
      total: rows.length,
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
    gradeLevel: {
      schoolYearId: scope.schoolYearId,
    },
  };

  if (gradeLevelId) {
    where.gradeLevelId = gradeLevelId;
  }

  const sections = await prisma.section.findMany({
    where,
    include: {
      gradeLevel: {
        select: {
          id: true,
          name: true,
          displayOrder: true,
        },
      },
      advisingTeacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
        },
      },
      _count: {
        select: {
          enrollmentRecords: true,
        },
      },
    },
    orderBy: [{ gradeLevelId: "asc" }, { name: "asc" }],
  });

  res.json({
    data: sections.map((section) => ({
      id: section.id,
      name: section.name,
      programType: section.programType,
      maxCapacity: section.maxCapacity,
      enrolledCount: section._count.enrollmentRecords,
      gradeLevel: section.gradeLevel,
      schoolYear: {
        id: scope.schoolYearId,
        yearLabel: scope.schoolYearLabel,
      },
      advisingTeacher: section.advisingTeacher
        ? {
            id: section.advisingTeacher.id,
            name: buildTeacherName(section.advisingTeacher),
          }
        : null,
    })),
    meta: {
      scope,
      total: sections.length,
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
      gradeLevel: {
        schoolYearId: scope.schoolYearId,
      },
    },
    include: {
      gradeLevel: {
        select: {
          id: true,
          name: true,
          displayOrder: true,
        },
      },
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

  if (!section) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Section not found for the selected school year",
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

  res.json({
    data: {
      section: {
        id: section.id,
        name: section.name,
        programType: section.programType,
        maxCapacity: section.maxCapacity,
        gradeLevel: section.gradeLevel,
        advisingTeacher: section.advisingTeacher
          ? {
              id: section.advisingTeacher.id,
              name: buildTeacherName(section.advisingTeacher),
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
