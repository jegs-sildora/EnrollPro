import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  resolveSchoolYearScope,
} from "./integration.shared.js";

const STAFF_ROLES = ["SYSTEM_ADMIN", "REGISTRAR"] as const;

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

async function fetchDefaultLearnerRows(schoolYearId: number) {
  return prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: { in: ["OFFICIALLY_ENROLLED", "ENROLLED"] },
      enrollmentRecord: {
        isNot: null,
      },
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
          sex: true,
          birthdate: true,
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
              maxCapacity: true,
            },
          },
        },
      },
    },
    orderBy: [{ gradeLevelId: "asc" }, { id: "asc" }],
  });
}

export async function listIntegrationStaff(
  req: Request,
  res: Response,
): Promise<void> {
  const includeInactive =
    String(req.query.includeInactive ?? "false").toLowerCase() === "true";

  const users = await prisma.user.findMany({
    where: {
      role: {
        in: [...STAFF_ROLES],
      },
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      suffix: true,
      email: true,
      role: true,
      isActive: true,
      employeeId: true,
      designation: true,
      mobileNumber: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  res.json({
    data: users.map((user) => ({
      id: user.id,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      suffix: user.suffix,
      fullName: buildStaffName(user),
      email: user.email,
      role: user.role,
      designation: user.designation,
      mobileNumber: user.mobileNumber,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    })),
    meta: {
      generatedAt: new Date().toISOString(),
      includeInactive,
      total: users.length,
    },
  });
}

export async function listDefaultAtlasFaculty(
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
      _count: { select: { sections: true } },
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
      sectionCount: teacher._count.sections,
      isClassAdviser: designation?.isClassAdviser ?? false,
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
      sourceSystem: "ATLAS",
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
  const applications = await fetchDefaultLearnerRows(scope.schoolYearId);

  res.json({
    data: applications.map((application) => ({
      enrollmentApplicationId: application.id,
      learner: {
        id: application.learner.id,
        externalId: application.learner.externalId,
        lrn: application.learner.lrn,
        firstName: application.learner.firstName,
        lastName: application.learner.lastName,
        middleName: application.learner.middleName,
        extensionName: application.learner.extensionName,
        fullName: buildLearnerName(application.learner),
        sex: application.learner.sex,
        birthdate: application.learner.birthdate,
      },
      gradeLevel: application.gradeLevel,
      section: application.enrollmentRecord?.section ?? null,
      enrolledAt: application.enrollmentRecord?.enrolledAt ?? null,
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
      totalRows: applications.length,
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
  const applications = await fetchDefaultLearnerRows(scope.schoolYearId);

  res.json({
    data: applications.map((application) => ({
      enrollmentApplicationId: application.id,
      applicantType: application.applicantType,
      learnerType: application.learnerType,
      learningModalities: application.learningModalities,
      learner: {
        externalId: application.learner.externalId,
        lrn: application.learner.lrn,
        firstName: application.learner.firstName,
        lastName: application.learner.lastName,
        middleName: application.learner.middleName,
        extensionName: application.learner.extensionName,
        fullName: buildLearnerName(application.learner),
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
      totalRows: applications.length,
    },
  });
}
