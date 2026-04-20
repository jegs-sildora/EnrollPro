import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import {
  buildTeacherName,
  resolveSchoolYearScope,
} from "./integration.shared.js";

const SAMPLE_TEACHER_EMPLOYEE_PREFIX = "SINT-T";
const SAMPLE_STAFF_EMAIL_SUFFIX = "@sample.integration.local";
const SAMPLE_LEARNER_LRN_PREFIX = "2099";
const SAMPLE_SECTION_PREFIX = "SINT-";

function isPublicSampleEnabled(): boolean {
  const rawFlag = process.env.INTEGRATION_PUBLIC_SAMPLE_ENABLED;
  if (rawFlag === undefined) {
    return process.env.NODE_ENV !== "production";
  }

  return rawFlag.toLowerCase() === "true";
}

function ensurePublicSampleEnabled(res: Response): boolean {
  if (isPublicSampleEnabled()) {
    return true;
  }

  res.status(503).json({
    error: {
      code: "PUBLIC_SAMPLE_DISABLED",
      message:
        "Public sample integration endpoints are disabled. Set INTEGRATION_PUBLIC_SAMPLE_ENABLED=true to enable.",
    },
  });

  return false;
}

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

export async function listSampleTeachers(
  req: Request,
  res: Response,
): Promise<void> {
  if (!ensurePublicSampleEnabled(res)) {
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

  const teachers = await prisma.teacher.findMany({
    where: {
      OR: [
        {
          employeeId: {
            startsWith: SAMPLE_TEACHER_EMPLOYEE_PREFIX,
          },
        },
        {
          email: {
            endsWith: SAMPLE_STAFF_EMAIL_SUFFIX,
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      teacherDesignations: {
        where: {
          schoolYearId: scope.schoolYearId,
        },
        include: {
          advisorySection: {
            select: {
              id: true,
              name: true,
              gradeLevel: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        take: 1,
      },
      _count: {
        select: {
          sections: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  res.json({
    data: teachers.map((teacher) => {
      const designation = teacher.teacherDesignations[0] ?? null;

      return {
        teacherId: teacher.id,
        employeeId: teacher.employeeId,
        fullName: buildTeacherName(teacher),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        email: teacher.email,
        contactNumber: teacher.contactNumber,
        specialization: teacher.specialization,
        isActive: teacher.isActive,
        sectionCount: teacher._count.sections,
        designation: {
          isClassAdviser: designation?.isClassAdviser ?? false,
          isTic: designation?.isTic ?? false,
          isTeachingExempt: designation?.isTeachingExempt ?? false,
          advisorySectionName: designation?.advisorySection?.name ?? null,
          advisoryGradeLevelName:
            designation?.advisorySection?.gradeLevel?.name ?? null,
        },
      };
    }),
    meta: {
      sampleFeed: true,
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      totalRows: teachers.length,
    },
  });
}

export async function listSampleStaff(
  _req: Request,
  res: Response,
): Promise<void> {
  if (!ensurePublicSampleEnabled(res)) {
    return;
  }

  const staff = await prisma.user.findMany({
    where: {
      role: {
        in: ["SYSTEM_ADMIN", "REGISTRAR"],
      },
      email: {
        endsWith: SAMPLE_STAFF_EMAIL_SUFFIX,
        mode: "insensitive",
      },
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
    },
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  res.json({
    data: staff.map((user) => ({
      id: user.id,
      employeeId: user.employeeId,
      fullName: buildStaffName(user),
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      suffix: user.suffix,
      email: user.email,
      role: user.role,
      designation: user.designation,
      mobileNumber: user.mobileNumber,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })),
    meta: {
      sampleFeed: true,
      generatedAt: new Date().toISOString(),
      totalRows: staff.length,
    },
  });
}

export async function listSampleStudents(
  req: Request,
  res: Response,
): Promise<void> {
  if (!ensurePublicSampleEnabled(res)) {
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

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: scope.schoolYearId,
      status: { in: ["OFFICIALLY_ENROLLED", "ENROLLED"] },
      learner: {
        lrn: {
          startsWith: SAMPLE_LEARNER_LRN_PREFIX,
        },
      },
      enrollmentRecord: {
        is: {
          section: {
            name: {
              startsWith: SAMPLE_SECTION_PREFIX,
            },
          },
        },
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
            },
          },
        },
      },
    },
    orderBy: [{ gradeLevelId: "asc" }, { id: "asc" }],
  });

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
      sampleFeed: true,
      generatedAt: new Date().toISOString(),
      scopeSchoolYearId: scope.schoolYearId,
      scopeSchoolYearLabel: scope.schoolYearLabel,
      totalRows: applications.length,
    },
  });
}
