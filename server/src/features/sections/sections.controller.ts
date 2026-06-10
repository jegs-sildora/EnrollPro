import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import {
  ApplicantType,
  EosyStatus,
  SectioningMethod,
  SectionAdviserStatus,
} from "../../generated/prisma/index.js";
import { SectioningEngine } from "../enrollment/services/sectioning-engine.service.js";
import { DEFAULT_SECTIONING_PARAMS } from "@enrollpro/shared";
import type { SectioningParams } from "@enrollpro/shared";
import { ensureLearnerUserAccount } from "../learner/learner.service.js";
import { fireOfficialEnrollmentNotification } from "../../lib/notificationService.js";

const sectioningEngine = new SectioningEngine(prisma as any);

export async function getBatchPrerequisites(req: Request, res: Response) {
  const { gradeLevelId } = req.params;
  const schoolYearId = req.query.schoolYearId
    ? parseInt(String(req.query.schoolYearId))
    : req.schoolYearId;

  if (!schoolYearId) {
    return res.status(400).json({ message: "School year ID is required" });
  }

  const prerequisites = await sectioningEngine.getPrerequisites(
    parseInt(String(gradeLevelId)),
    schoolYearId,
  );

  res.json(prerequisites);
}

export async function runBatchSectioning(req: Request, res: Response) {
  const { gradeLevelId, params } = req.body;
  const schoolYearId = req.body.schoolYearId
    ? parseInt(String(req.body.schoolYearId))
    : req.schoolYearId;

  if (!schoolYearId) {
    return res.status(400).json({ message: "School year ID is required" });
  }

  const resolvedParams: SectioningParams = params ?? DEFAULT_SECTIONING_PARAMS;

  // Persist the config on the school year so it pre-fills next time
  await prisma.schoolYear.update({
    where: { id: schoolYearId },
    data: { sectioningConfig: resolvedParams },
  });

  const preview = await sectioningEngine.runBatchSectioning(
    gradeLevelId,
    schoolYearId,
    resolvedParams,
  );

  res.json(preview);
}

export async function commitBatchSectioning(req: Request, res: Response) {
  try {
    const { gradeLevelId, assignments } = req.body;
    const schoolYearId = req.body.schoolYearId
      ? parseInt(String(req.body.schoolYearId))
      : req.schoolYearId;

    if (!schoolYearId) {
      return res.status(400).json({ message: "School year ID is required" });
    }

    if (!assignments || assignments.length === 0) {
      return res
        .status(400)
        .json({ message: "No assignments provided to commit" });
    }

    const appIds = (
      assignments as Array<{ applicationId: number; sectionId: number }>
    ).map((a) => a.applicationId);

    // Fetch learner IDs first as they are required for EnrollmentRecord
    const applications = await prisma.enrollmentApplication.findMany({
      where: { id: { in: appIds } },
      select: { id: true, learnerId: true },
    });

    const appToLearnerMap = new Map(
      applications.map((app) => [app.id, app.learnerId]),
    );

    const results = await prisma.$transaction(
      async (tx) => {
        // Update application statuses to ENROLLED
        await tx.enrollmentApplication.updateMany({
          where: {
            id: { in: appIds },
            
          },
          data: { status: "SECTIONED" },
        });

        // Clear any existing enrollment records for these applications to avoid unique constraint violations
        // This allows re-running the sectioning algorithm
        await tx.enrollmentRecord.deleteMany({
          where: { enrollmentApplicationId: { in: appIds } },
        });

        const setting = await tx.schoolSetting.findFirst({ select: { systemPhase: true } });

        const recordsToCreate = (
          assignments as Array<{ applicationId: number; sectionId: number }>
        ).map((assignment) => {
          const learnerId = appToLearnerMap.get(assignment.applicationId);
          if (!learnerId) {
            throw new Error(
              `Learner ID not found for application ${assignment.applicationId}`,
            );
          }
          return {
            enrollmentApplicationId: assignment.applicationId,
            sectionId: assignment.sectionId,
            schoolYearId,
            enrolledById: req.user!.userId,
            learnerId,
            dateSectioned: new Date(),
            sectioningMethod: SectioningMethod.BATCH_ALGORITHM,
            isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
          };
        });

        await tx.enrollmentRecord.createMany({
          data: recordsToCreate,
        });

        // Auto-create User accounts for learners who don't have one yet
        const learnerIds = recordsToCreate.map(
          (r: { learnerId: number }) => r.learnerId,
        );
        const learners = await tx.learner.findMany({
          where: { id: { in: learnerIds }, userId: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            lrn: true,
            sex: true,
          },
        });

        for (const learner of learners) {
          await ensureLearnerUserAccount(tx, learner);
        }

        return recordsToCreate;
      },
      {
        timeout: 20000, // Increased timeout for batch operations
      },
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: "BATCH_SECTIONING_COMMITTED",
      description: `Committed batch sectioning for ${assignments.length} learners in Grade Level ID ${gradeLevelId}`,
      subjectType: "Section",
      recordId: gradeLevelId,
      req,
    });

    res.json({
      message: "Batch sectioning committed successfully",
      count: results.length,
    });

    // Fire Event B — Official Enrollment notifications (fire-and-forget)
    prisma.enrollmentRecord
      .findMany({
        where: { enrollmentApplicationId: { in: appIds } },
        include: {
          section: { select: { name: true } },
          schoolYear: { select: { yearLabel: true } },
          enrollmentApplication: {
            select: {
              id: true,
              guardianName: true,
              contactNumber: true,
              learner: { select: { firstName: true, lastName: true, lrn: true } },
              gradeLevel: { select: { name: true } },
              familyMembers: {
                select: { relationship: true, firstName: true, lastName: true, contactNumber: true, email: true },
              },
            },
          },
        },
      })
      .then((records) => {
        for (const record of records) {
          const app = record.enrollmentApplication;
          const guardian = app.familyMembers?.find(
            (m) => m.relationship === "GUARDIAN" || m.relationship === "MOTHER" || m.relationship === "FATHER",
          );
          fireOfficialEnrollmentNotification({
            applicationId: record.enrollmentApplicationId,
            learnerName: `${app.learner.firstName} ${app.learner.lastName}`,
            lrn: app.learner.lrn ?? null,
            guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : app.guardianName ?? null,
            contactNumber: guardian?.contactNumber ?? app.contactNumber ?? null,
            email: guardian?.email ?? null,
            sectionName: record.section.name,
            adviserName: null,
            schoolYearLabel: record.schoolYear.yearLabel,
            gradeLevelName: app.gradeLevel.name,
            assignmentSlipUrl: null,
            enrolledAt: record.enrolledAt.toISOString(),
          }).catch((err: unknown) => console.error("[Notification Event B Error]:", err));
        }
      })
      .catch((err) => console.error("[Notification Event B Fetch Error]:", err));
  } catch (error: unknown) {
    console.error("[commitBatchSectioning Error]:", error);
    const isPrismaConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2002";
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to commit batch sectioning",
      details: isPrismaConflict
        ? "Unique constraint violation detected"
        : undefined,
    });
  }
}

const VALID_PROGRAM_TYPES = new Set([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);

const INACTIVE_EOSY_STATUSES: EosyStatus[] = ["TRANSFERRED_OUT", "DROPPED_OUT"];

const activeEnrollmentFilter = {
  OR: [
    { eosyStatus: { equals: null } },
    {
      eosyStatus: {
        notIn: INACTIVE_EOSY_STATUSES,
      },
    },
  ],
};

export async function listSections(req: Request, res: Response): Promise<void> {
  // Source of truth for SY: route param > global context (req.schoolYearId)
  const ayId = req.params.ayId
    ? parseInt(String(req.params.ayId))
    : req.schoolYearId;
  const { gradeLevelId, programType, sectionType } = req.query;

  if (!ayId) {
    res.json({ sections: [] });
    return;
  }

  if (gradeLevelId) {
    const where: {
      gradeLevelId: number;
      schoolYearId: number;
      programType?: ApplicantType;
    } = {
      gradeLevelId: parseInt(String(gradeLevelId)),
      schoolYearId: ayId,
    };
    if (programType) where.programType = programType as ApplicantType;

    const sections = await prisma.section.findMany({
      where,
      include: {
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
          include: { teacher: true },
        },
        _count: {
          select: {
            enrollmentRecords: {
              where: activeEnrollmentFilter,
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    res.json({
      sections: sections.map((s) => {
        const activeAdviser = s.advisers[0]?.teacher ?? null;
        return {
          id: s.id,
          name: s.name,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
          isHomogeneous: s.isHomogeneous,
          sectionRank: s.sectionRank ?? null,
          enrolledCount: s._count.enrollmentRecords,
          advisingTeacher: activeAdviser
            ? {
                id: activeAdviser.id,
                name: `${activeAdviser.lastName}, ${activeAdviser.firstName}${activeAdviser.middleName ? ` ${activeAdviser.middleName.charAt(0)}.` : ""}`,
              }
            : null,
        };
      }),
    });
    return;
  }

  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        where: ayId
          ? {
              schoolYearId: ayId,
            }
          : undefined,
        include: {
          advisers: {
            where: { status: SectionAdviserStatus.ACTIVE },
            include: { teacher: true },
          },
          _count: {
            select: {
              enrollmentRecords: {
                where: activeEnrollmentFilter,
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  res.json({
    gradeLevels: gradeLevels.map((gl) => ({
      gradeLevelId: gl.id,
      gradeLevelName: gl.name,
      displayOrder: gl.displayOrder,
      sections: gl.sections.map((s) => {
        const activeAdviser = s.advisers[0]?.teacher ?? null;
        return {
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
          isHomogeneous: s.isHomogeneous,
          sectionRank: s.sectionRank ?? null,
          enrolledCount: s._count.enrollmentRecords,
          advisingTeacher: activeAdviser
            ? {
                id: activeAdviser.id,
                name: `${activeAdviser.lastName}, ${activeAdviser.firstName}${activeAdviser.middleName ? ` ${activeAdviser.middleName.charAt(0)}.` : ""}`,
              }
            : null,
        };
      }),
    })),
  });
}

export async function listEligibleAdvisers(req: Request, res: Response) {
  const schoolYearId = req.query.schoolYearId
    ? parseInt(String(req.query.schoolYearId))
    : req.schoolYearId;
  const excludeSectionId = req.query.excludeSectionId
    ? parseInt(String(req.query.excludeSectionId))
    : null;

  const teachers = await prisma.teacher.findMany({
    where: {
      isActive: true,
      designation: {
        equals: "CLASS ADVISER",
        mode: "insensitive",
      },
      ...(schoolYearId
        ? {
            advisoryHistory: {
              none: {
                schoolYearId,
                status: SectionAdviserStatus.ACTIVE,
                ...(excludeSectionId
                  ? {
                      NOT: { sectionId: excludeSectionId },
                    }
                  : {}),
              },
            },
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      employeeId: true,
    },
  });
  const formatted = teachers.map((t) => ({
    id: t.id,
    name: `${t.lastName}, ${t.firstName}${t.middleName ? ` ${t.middleName.charAt(0)}.` : ""}`,
    employeeId: t.employeeId,
  }));
  res.json({ teachers: formatted });
}

export async function createSection(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const {
      name,
      sortOrder,
      maxCapacity,
      gradeLevelId,
      schoolYearId,
      programType,
      advisingTeacherId,
      isHomogeneous,
      isSnake,
      sectionRank,
      sectionType,
    } = req.body;

    const normalizedName = typeof name === "string" ? name.trim() : "";
    if (!normalizedName || !gradeLevelId || !schoolYearId) {
      res
        .status(400)
        .json({ message: "name, gradeLevelId, and schoolYearId are required" });
      return;
    }

    const normalizedProgramType =
      typeof programType === "string" && programType.trim().length > 0
        ? programType
        : "REGULAR";

    const resolvedSortOrder =
      Number.isInteger(sortOrder) && Number(sortOrder) > 0
        ? Number(sortOrder)
        : ((
            await prisma.section.aggregate({
              where: {
                gradeLevelId,
                schoolYearId,
                programType: normalizedProgramType as ApplicantType,
              },
              _max: { sortOrder: true },
            })
          )._max.sortOrder ?? 0) + 1;

    const section = await prisma.$transaction(async (tx) => {
      const s = await tx.section.create({
        data: {
          name: normalizedName,
          sortOrder: resolvedSortOrder,
          maxCapacity: maxCapacity ?? 45,
          gradeLevelId,
          schoolYearId,
          programType: normalizedProgramType as ApplicantType,
          isHomogeneous: Boolean(isHomogeneous),
          isSnake: Boolean(isSnake),
          sectionRank: sectionRank != null ? Number(sectionRank) : null,
        },
      });

      if (advisingTeacherId) {
        const sy = await tx.schoolYear.findUnique({
          where: { id: schoolYearId },
        });
        await tx.sectionAdviser.create({
          data: {
            sectionId: s.id,
            teacherId: advisingTeacherId,
            schoolYearId,
            status: SectionAdviserStatus.ACTIVE,
            effectiveFrom: sy?.classOpeningDate || new Date(),
          },
        });

        // Update teacher designation advisory assignment
        await tx.teacherDesignation.upsert({
          where: {
            uq_teacher_designations_teacher_sy: {
              teacherId: advisingTeacherId,
              schoolYearId,
            },
          },
          update: {
            isClassAdviser: true,
            advisorySectionId: s.id,
          },
          create: {
            teacherId: advisingTeacherId,
            schoolYearId,
            isClassAdviser: true,
            advisorySectionId: s.id,
          },
        });
      }
      return s;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_CREATED",
      description: `Created section: ${section.name}`,
      subjectType: "Section",
      recordId: section.id,
      req,
    });

    res.json({ section });
  } catch (error: unknown) {
    console.error("[createSection Error]", error);
    const isPrismaConflict =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "P2002";
    if (isPrismaConflict) {
      res.status(409).json({
        message: "A section with this name already exists in this grade level.",
      });
      return;
    }
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Failed to create section",
    });
  }
}

export async function updateSection(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id));
    const {
      name,
      sortOrder,
      maxCapacity,
      advisingTeacherId,
      programType,
      isHomogeneous,
      isSnake,
      sectionRank,
    } = req.body;

    const existing = await prisma.section.findUnique({
      where: { id },
      include: {
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Section not found" });
      return;
    }

    const section = await prisma.$transaction(async (tx) => {
      const s = await tx.section.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(maxCapacity !== undefined
            ? { maxCapacity: Number(maxCapacity) }
            : {}),
          ...(programType !== undefined
            ? { programType: programType as ApplicantType }
            : {}),
          ...(isHomogeneous !== undefined
            ? { isHomogeneous: Boolean(isHomogeneous) }
            : {}),
          ...(isSnake !== undefined ? { isSnake: Boolean(isSnake) } : {}),
          ...(sectionRank !== undefined
            ? { sectionRank: sectionRank != null ? Number(sectionRank) : null }
            : {}),
        },
      });

      if (advisingTeacherId !== undefined) {
        const currentActive = existing.advisers[0];

        if (!currentActive || currentActive.teacherId !== advisingTeacherId) {
          // Handle teacher change/assignment
          if (currentActive) {
            await tx.sectionAdviser.update({
              where: { id: currentActive.id },
              data: {
                status: SectionAdviserStatus.HANDED_OVER,
                effectiveTo: new Date(),
                handoverReason: "Administrative Update",
              },
            });

            await tx.teacherDesignation.updateMany({
              where: {
                teacherId: currentActive.teacherId,
                schoolYearId: s.schoolYearId,
                advisorySectionId: s.id,
              },
              data: {
                isClassAdviser: false,
                advisorySectionId: null,
              },
            });
          }

          if (advisingTeacherId) {
            // Data Integrity: Terminate any existing active advisory for this teacher in this school year
            // before creating the new one. This prevents a teacher from having multiple active sections.
            await tx.sectionAdviser.updateMany({
              where: {
                teacherId: advisingTeacherId,
                schoolYearId: s.schoolYearId,
                status: SectionAdviserStatus.ACTIVE,
                NOT: { sectionId: s.id },
              },
              data: {
                status: SectionAdviserStatus.HANDED_OVER,
                effectiveTo: new Date(),
                handoverReason: "Reassigned to another section",
              },
            });

            const sy = await tx.schoolYear.findUnique({
              where: { id: s.schoolYearId },
            });
            await tx.sectionAdviser.create({
              data: {
                sectionId: s.id,
                teacherId: advisingTeacherId,
                schoolYearId: s.schoolYearId,
                status: SectionAdviserStatus.ACTIVE,
                effectiveFrom: sy?.classOpeningDate || new Date(),
              },
            });

            await tx.teacherDesignation.upsert({
              where: {
                uq_teacher_designations_teacher_sy: {
                  teacherId: advisingTeacherId,
                  schoolYearId: s.schoolYearId,
                },
              },
              update: {
                isClassAdviser: true,
                advisorySectionId: s.id,
              },
              create: {
                teacherId: advisingTeacherId,
                schoolYearId: s.schoolYearId,
                isClassAdviser: true,
                advisorySectionId: s.id,
              },
            });
          }
        }
      }
      return s;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_UPDATED",
      description: `Updated section: ${section.name}`,
      subjectType: "Section",
      recordId: section.id,
      req,
    });

    res.json({ section });
  } catch (error: unknown) {
    const prismaError = error as {
      code?: string;
      meta?: { target?: unknown };
      message?: string;
      stack?: string;
    };
    console.error("[updateSection Error] Details:", {
      code: prismaError.code,
      meta: prismaError.meta,
      message: prismaError.message,
      stack: prismaError.stack,
    });
    if (prismaError.code === "P2002") {
      const target = Array.isArray(prismaError.meta?.target)
        ? (prismaError.meta?.target as string[]).join(", ")
        : prismaError.meta?.target || "unknown fields";

      res.status(409).json({
        message: `Conflict detected on [${target}]. This value already exists for another record in this context.`,
      });
      return;
    }
    res.status(500).json({
      message:
        error instanceof Error ? error.message : "Failed to update section",
    });
  }
}

export async function deleteSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));
  const section = await prisma.section.findUnique({ where: { id } });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  await prisma.section.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_DELETED",
    description: `Deleted section: ${section.name}`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ message: "Section deleted successfully" });
}

export async function getSectionRoster(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      gradeLevel: true,
      advisers: {
        where: { status: SectionAdviserStatus.ACTIVE },
        include: { teacher: true },
      },
      enrollmentRecords: {
        where: activeEnrollmentFilter,
        include: {
          enrollmentApplication: {
            include: {
              learner: true,
            },
          },
        },
      },
    },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const activeAdviser = section.advisers[0]?.teacher ?? null;
  const records = section.enrollmentRecords;
  const learners = records.map((record) => ({
    id: record.enrollmentApplication.learner.id,
    enrollmentApplicationId: record.enrollmentApplication.id,
    lrn: record.enrollmentApplication.learner.lrn,
    firstName: record.enrollmentApplication.learner.firstName,
    lastName: record.enrollmentApplication.learner.lastName,
    middleName: record.enrollmentApplication.learner.middleName,
    sex: record.enrollmentApplication.learner.sex,
    status: record.enrollmentApplication.status,
    applicantType: record.enrollmentApplication.applicantType,
    enrolledAt: record.enrolledAt,
    sectioningMethod: record.sectioningMethod,
    dateSectioned: record.dateSectioned?.toISOString() ?? null,
    sf1Remarks: record.sf1Remarks ?? null,
  }));

  res.json({
    section: {
      id: section.id,
      name: section.name,
      maxCapacity: section.maxCapacity,
      programType: section.programType,
      gradeLevel: section.gradeLevel.name,
      advisingTeacher: activeAdviser
        ? {
            id: activeAdviser.id,
            name: `${activeAdviser.lastName}, ${activeAdviser.firstName}`,
          }
        : null,
    },
    learners,
  });
}

export async function getUnsectionedPool(
  req: Request,
  res: Response,
): Promise<void> {
  const gradeLevelId = req.query.gradeLevelId;
  const schoolYearId = req.query.schoolYearId
    ? parseInt(String(req.query.schoolYearId))
    : req.schoolYearId;

  if (!gradeLevelId || !schoolYearId) {
    res.status(400).json({ message: "gradeLevelId and schoolYearId required" });
    return;
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      gradeLevelId: parseInt(gradeLevelId as string),
      schoolYearId: schoolYearId,
      status: "VERIFIED",
      enrollmentRecord: null,
    },
    include: {
      learner: {
        include: {
          enrollmentRecords: {
            where: {
              schoolYearId: { not: schoolYearId },
              finalAverage: { not: null },
            },
            orderBy: { schoolYearId: "desc" },
            take: 1,
            select: { finalAverage: true },
          },
        },
      },
      previousSchool: { select: { generalAverage: true } },
    },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
  });

  res.json({
    learners: applications.map((app) => ({
      id: app.learner.id,
      enrollmentApplicationId: app.id,
      lrn: app.learner.lrn,
      firstName: app.learner.firstName,
      lastName: app.learner.lastName,
      middleName: app.learner.middleName,
      sex: app.learner.sex,
      applicantType: app.applicantType,
      promotionGenAve:
        app.learner.enrollmentRecords[0]?.finalAverage ??
        app.previousSchool?.generalAverage ??
        app.learner.previousGenAve ??
        null,
    })),
  });
}

export async function inlineSlotLearner(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = parseInt(String(req.params.id));
  const enrollmentApplicationId = req.body.enrollmentApplicationId;
  const officialEnrollmentDate = req.body.officialEnrollmentDate as string | undefined;
  const isCapacityOverride = Boolean(req.body.isCapacityOverride);
  const schoolYearId = req.body.schoolYearId
    ? parseInt(String(req.body.schoolYearId))
    : req.schoolYearId;

  if (!officialEnrollmentDate) {
    res.status(400).json({ message: "officialEnrollmentDate is required for inline slotting" });
    return;
  }

  const parsedEnrollmentDate = new Date(officialEnrollmentDate);
  if (isNaN(parsedEnrollmentDate.getTime())) {
    res.status(400).json({ message: "officialEnrollmentDate must be a valid ISO date string" });
    return;
  }

  if (!schoolYearId) {
    res.status(400).json({ message: "schoolYearId is required" });
    return;
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      _count: {
        select: {
          enrollmentRecords: {
            where: activeEnrollmentFilter,
          },
        },
      },
    },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  if (section._count.enrollmentRecords >= section.maxCapacity && !isCapacityOverride) {
    res.status(409).json({
      message: "Section capacity reached",
      code: "SECTION_CAPACITY_EXCEEDED",
      currentCount: section._count.enrollmentRecords,
      maxCapacity: section.maxCapacity,
      sectionName: section.name,
    });
    return;
  }

  const setting = await prisma.schoolSetting.findFirst({ select: { systemPhase: true } });

  const record = await prisma.$transaction(async (tx) => {
    const application = await tx.enrollmentApplication.findUniqueOrThrow({
      where: { id: enrollmentApplicationId },
      select: { learnerId: true },
    });

    await tx.enrollmentApplication.update({
      where: { id: enrollmentApplicationId },
      data: { status: "ENROLLED" },
    });

    const created = await tx.enrollmentRecord.create({
      data: {
        enrollmentApplicationId,
        learnerId: application.learnerId,
        sectionId,
        schoolYearId,
        enrolledById: req.user!.userId,
        sectioningMethod: SectioningMethod.INLINE_SLOTTING,
        enrolledAt: parsedEnrollmentDate,
        dateSectioned: parsedEnrollmentDate,
        isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
      },
    });

    // Auto-create User account for this learner if they don't have one
    const learner = await tx.learner.findUnique({
      where: { id: application.learnerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lrn: true,
        userId: true,
        sex: true,
      },
    });
    if (learner) {
      await ensureLearnerUserAccount(tx, learner);
    }

    return created;
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "LEARNER_SECTIONED_INLINE",
    description: `Sectioned learner application ID ${enrollmentApplicationId} to ${section.name}`,
    subjectType: "Section",
    recordId: sectionId,
    req,
  });

  // Process 1.1: Event-Driven Delta Sync (Automated)
  // When a learner is sectioned inline, trigger immediate sync
  const app = await prisma.enrollmentApplication.findUnique({
    where: { id: enrollmentApplicationId },
    select: { learnerId: true },
  });
  if (app) {
  }

  res.json({ record });
}

export async function handoverAdviser(req: Request, res: Response) {
  const sectionId = parseInt(String(req.params.id));
  const { substituteTeacherId, handoverReason, handoverDate } = req.body;

  try {
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
        },
      },
    });

    if (!section) {
      return res.status(404).json({ message: "Section not found" });
    }

    const currentActive = section.advisers[0];
    if (!currentActive) {
      return res
        .status(400)
        .json({ message: "No active adviser to handover from" });
    }

    const resolvedHandoverDate = handoverDate
      ? new Date(handoverDate)
      : new Date();
    const nextDay = new Date(resolvedHandoverDate);
    nextDay.setDate(nextDay.getDate() + 1);

    await prisma.$transaction(async (tx) => {
      // 1. Close current ledger
      await tx.sectionAdviser.update({
        where: { id: currentActive.id },
        data: {
          status: SectionAdviserStatus.HANDED_OVER,
          effectiveTo: resolvedHandoverDate,
          handoverReason:
            handoverReason || "Maternity Leave / Mid-year reassignment",
        },
      });

      // 2. Relieve old adviser designation
      await tx.teacherDesignation.updateMany({
        where: {
          teacherId: currentActive.teacherId,
          schoolYearId: section.schoolYearId,
          advisorySectionId: sectionId,
        },
        data: {
          isClassAdviser: false,
          advisorySectionId: null,
        },
      });

      // 3. Open new ledger
      await tx.sectionAdviser.create({
        data: {
          sectionId,
          teacherId: substituteTeacherId,
          schoolYearId: section.schoolYearId,
          status: SectionAdviserStatus.ACTIVE,
          effectiveFrom: nextDay,
        },
      });

      // 4. Designate new adviser
      await tx.teacherDesignation.upsert({
        where: {
          uq_teacher_designations_teacher_sy: {
            teacherId: substituteTeacherId,
            schoolYearId: section.schoolYearId,
          },
        },
        update: {
          isClassAdviser: true,
          advisorySectionId: sectionId,
        },
        create: {
          teacherId: substituteTeacherId,
          schoolYearId: section.schoolYearId,
          isClassAdviser: true,
          advisorySectionId: sectionId,
        },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ADVISORY_HANDOVER_EXECUTED",
      description: `Handed over advisory for ${section.name} to substitute teacher ID ${substituteTeacherId}`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    res.json({ message: "Handover executed successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function transferLearner(req: Request, res: Response) {
  const { enrollmentApplicationId, targetSectionId, reason } = req.body;

  try {
    const targetSection = await prisma.section.findUnique({
      where: { id: targetSectionId },
    });

    if (!targetSection) {
      return res.status(404).json({ message: "Target section not found" });
    }

    const application = await prisma.enrollmentApplication.findUnique({
      where: { id: enrollmentApplicationId },
      include: {
        enrollmentRecord: {
          include: { section: true },
        },
      },
    });

    if (!application?.enrollmentRecord) {
      return res
        .status(422)
        .json({ message: "Learner is not currently enrolled in any section" });
    }

    const oldSectionName = application.enrollmentRecord.section.name;

    const updatedRecord = await prisma.enrollmentRecord.update({
      where: { id: application.enrollmentRecord.id },
      data: {
        sectionId: targetSectionId,
        sectioningMethod: SectioningMethod.TRANSFER,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "LEARNER_SECTION_TRANSFER",
      description: `Transferred learner app ID ${enrollmentApplicationId} from ${oldSectionName} to ${targetSection.name}. Reason: ${reason || "Not specified"}`,
      subjectType: "Section",
      recordId: targetSectionId,
      req,
    });

    // Immediate Delta Sync

    res.json({
      message: "Learner transferred successfully",
      record: updatedRecord,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function exportSectionSf1(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));

  const [section, schoolSetting] = await Promise.all([
    prisma.section.findUnique({
      where: { id },
      include: {
        gradeLevel: true,
        schoolYear: { select: { yearLabel: true } },
        advisers: {
          where: { status: SectionAdviserStatus.ACTIVE },
          include: { teacher: true },
        },
        enrollmentRecords: {
          where: activeEnrollmentFilter,
          include: {
            enrollmentApplication: {
              include: {
                learner: true,
                addresses: true,
                familyMembers: true,
              },
            },
          },
        },
      },
    }),
    prisma.schoolSetting.findFirst({
      select: { schoolName: true },
    }),
  ]);

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const adviser = section.advisers[0]?.teacher ?? null;
  const adviserName = adviser
    ? `${adviser.lastName}, ${adviser.firstName}${adviser.middleName ? " " + adviser.middleName.charAt(0) + "." : ""}`
    : "";

  // First Friday of June of school year start year
  const yr = parseInt(section.schoolYear.yearLabel.split("-")[0]);
  const firstFridayJune = new Date(yr, 5, 1);
  while (firstFridayJune.getDay() !== 5) {
    firstFridayJune.setDate(firstFridayJune.getDate() + 1);
  }

  const records = section.enrollmentRecords;

  type LearnerRow = {
    lrn: string;
    lastName: string;
    firstName: string;
    middleName: string;
    sex: string;
    birthdate: Date | null;
    motherTongue: string;
    ipGroup: string;
    religion: string;
    houseStreet: string;
    barangay: string;
    municipality: string;
    province: string;
    fatherName: string;
    motherName: string;
    guardianName: string;
    guardianRelationship: string;
    contactNumber: string;
  };

  const allLearners: LearnerRow[] = records.map((r) => {
    const l = r.enrollmentApplication.learner;
    const app = r.enrollmentApplication;
    const address = app.addresses[0] ?? null;
    const father = app.familyMembers.find((m) => m.relationship === "FATHER");
    const mother = app.familyMembers.find((m) => m.relationship === "MOTHER");
    const fmtMember = (
      m:
        | { lastName: string; firstName: string; middleName: string | null }
        | undefined,
    ) =>
      m
        ? `${m.lastName}, ${m.firstName}${m.middleName ? " " + m.middleName : ""}`
        : "";
    return {
      lrn: l.lrn ?? "",
      lastName: l.lastName,
      firstName: l.firstName,
      middleName: l.middleName ?? "",
      sex: l.sex,
      birthdate: l.birthdate,
      motherTongue: l.motherTongue ?? "",
      ipGroup: l.isIpCommunity ? (l.ipGroupName ?? "") : "",
      religion: l.religion ?? "",
      houseStreet: [address?.houseNoStreet, address?.sitio]
        .filter(Boolean)
        .join(" "),
      barangay: address?.barangay ?? "",
      municipality: address?.cityMunicipality ?? "",
      province: address?.province ?? "",
      fatherName: fmtMember(father),
      motherName: fmtMember(mother),
      guardianName: app.guardianName ?? "",
      guardianRelationship: app.guardianRelationship ?? "",
      contactNumber: app.contactNumber ?? "",
    };
  });

  const males = allLearners
    .filter((l) => l.sex === "MALE")
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );
  const females = allLearners
    .filter((l) => l.sex !== "MALE")
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );

  const fmtDate = (d: Date | null): string => {
    if (!d) return "";
    const dt = new Date(d);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const yyyy = dt.getUTCFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const computeAge = (birthdate: Date | null): string | number => {
    if (!birthdate) return "";
    const diff = firstFridayJune.getTime() - new Date(birthdate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  };

  // ── Build workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("SF1");

  // 21 columns A–U
  ws.columns = [
    { width: 14 }, // A  LRN
    { width: 14 }, // B  NAME (merged B–D, primary width)
    { width: 5 }, // C  NAME (part of merge)
    { width: 3 }, // D  NAME (part of merge)
    { width: 5 }, // E  Sex
    { width: 13 }, // F  Birth Date
    { width: 5 }, // G  Age
    { width: 14 }, // H  Mother Tongue
    { width: 14 }, // I  IP
    { width: 12 }, // J  Religion
    { width: 18 }, // K  House/Street
    { width: 14 }, // L  Barangay
    { width: 16 }, // M  Municipality
    { width: 14 }, // N  Province
    { width: 22 }, // O  Father
    { width: 22 }, // P  Mother
    { width: 18 }, // Q  Guardian Name
    { width: 14 }, // R  Guardian Relationship
    { width: 16 }, // S  Contact
    { width: 14 }, // T  Learning Modality
    { width: 10 }, // U  Remarks
  ];

  const thin = { style: "thin" as const };
  const thinBorder = { top: thin, left: thin, bottom: thin, right: thin };

  // ── Row 1: Title ──────────────────────────────────────────────────────────
  ws.mergeCells("A1:U1");
  const r1 = ws.getCell("A1");
  r1.value = "School Form 1 (SF 1) School Register";
  r1.font = { bold: true, size: 13 };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 22;

  // ── Row 2: Subtitle ───────────────────────────────────────────────────────
  ws.mergeCells("A2:U2");
  const r2 = ws.getCell("A2");
  r2.value =
    "(This replaces Form 1, Master List & STS Form 2-Family Background and Profile)";
  r2.font = { italic: true, size: 9 };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 14;

  // ── Row 3: School ID / Division ───────────────────────────────────────────
  ws.getCell("A3").value = "School ID:";
  ws.getCell("A3").font = { bold: true, size: 9 };
  ws.mergeCells("B3:E3");
  ws.getCell("B3").border = { bottom: thin };
  ws.getCell("F3").value = "Division:";
  ws.getCell("F3").font = { bold: true, size: 9 };
  ws.mergeCells("G3:U3");
  ws.getCell("G3").border = { bottom: thin };
  ws.getRow(3).height = 14;

  // ── Row 4: School Name / School Year / Grade Level / Section ─────────────
  ws.getCell("A4").value = "School Name:";
  ws.getCell("A4").font = { bold: true, size: 9 };
  ws.mergeCells("B4:G4");
  ws.getCell("B4").value = schoolSetting?.schoolName ?? "";
  ws.getCell("B4").font = { size: 9 };
  ws.getCell("B4").border = { bottom: thin };
  ws.getCell("H4").value = "School Year:";
  ws.getCell("H4").font = { bold: true, size: 9 };
  ws.mergeCells("I4:J4");
  ws.getCell("I4").value = section.schoolYear.yearLabel;
  ws.getCell("I4").font = { size: 9 };
  ws.getCell("I4").border = { bottom: thin };
  ws.getCell("K4").value = "Grade Level:";
  ws.getCell("K4").font = { bold: true, size: 9 };
  ws.mergeCells("L4:M4");
  ws.getCell("L4").value = section.gradeLevel.name;
  ws.getCell("L4").font = { size: 9 };
  ws.getCell("L4").border = { bottom: thin };
  ws.getCell("N4").value = "Section:";
  ws.getCell("N4").font = { bold: true, size: 9 };
  ws.mergeCells("O4:U4");
  ws.getCell("O4").value = section.name;
  ws.getCell("O4").font = { size: 9 };
  ws.getCell("O4").border = { bottom: thin };
  ws.getRow(4).height = 14;

  // ── Rows 5–6: Two-row column headers ─────────────────────────────────────
  const hdrStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 9 },
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    border: thinBorder,
  };

  // Non-grouped columns span both rows 5–6
  const spanBoth: Array<[string, string, string]> = [
    ["A5:A6", "A5", "LRN"],
    ["B5:D6", "B5", "NAME\n(Last, First, Middle)"],
    ["E5:E6", "E5", "Sex\n(M/F)"],
    ["F5:F6", "F5", "BIRTH DATE\n(mm/dd/yyyy)"],
    ["G5:G6", "G5", "AGE"],
    ["H5:H6", "H5", "MOTHER\nTONGUE"],
    ["I5:I6", "I5", "IP\n(Ethnic Group)"],
    ["J5:J6", "J5", "RELIGION"],
    ["S5:S6", "S5", "Contact Number\nof Parent or Guardian"],
    ["T5:T6", "T5", "Learning\nModality"],
    ["U5:U6", "U5", "REMARKS"],
  ];
  for (const [range, master, label] of spanBoth) {
    ws.mergeCells(range);
    const c = ws.getCell(master);
    c.value = label;
    c.style = hdrStyle as ExcelJS.Style;
  }

  // Group headers — row 5 only
  ws.mergeCells("K5:N5");
  ws.getCell("K5").value = "ADDRESS";
  ws.getCell("K5").style = hdrStyle as ExcelJS.Style;
  ws.mergeCells("O5:P5");
  ws.getCell("O5").value = "PARENTS";
  ws.getCell("O5").style = hdrStyle as ExcelJS.Style;
  ws.mergeCells("Q5:R5");
  ws.getCell("Q5").value = "GUARDIAN\n(if Not Parent)";
  ws.getCell("Q5").style = hdrStyle as ExcelJS.Style;

  // Individual sub-headers — row 6 only (for grouped columns)
  const sub6: Array<[string, string]> = [
    ["K6", "House #/Street/\nSitio/Purok"],
    ["L6", "Barangay"],
    ["M6", "Municipality/\nCity"],
    ["N6", "Province"],
    ["O6", "Father's Name\n(Last, First, Middle)"],
    ["P6", "Mother's Maiden Name\n(Last, First, Middle)"],
    ["Q6", "Name"],
    ["R6", "Relationship"],
  ];
  for (const [addr, label] of sub6) {
    const c = ws.getCell(addr);
    c.value = label;
    c.style = hdrStyle as ExcelJS.Style;
  }
  ws.getRow(5).height = 24;
  ws.getRow(6).height = 36;

  // ── Data rows ─────────────────────────────────────────────────────────────
  let rowIdx = 7;

  const maleFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFDCE6F1" },
  };
  const femaleFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FFFFEBF0" },
  };

  const writeLearnerRow = (
    l: LearnerRow,
    fill: { type: "pattern"; pattern: "solid"; fgColor: { argb: string } },
  ) => {
    const name = `${l.lastName.toUpperCase()}, ${l.firstName.toUpperCase()}${l.middleName ? " " + l.middleName.toUpperCase() : ""}`;
    const dc: Partial<ExcelJS.Style> = {
      font: { size: 9 },
      alignment: { vertical: "middle", horizontal: "left", wrapText: false },
      border: thinBorder,
      fill,
    };
    const cc: Partial<ExcelJS.Style> = {
      ...dc,
      alignment: { vertical: "middle", horizontal: "center", wrapText: false },
    };
    const nc: Partial<ExcelJS.Style> = {
      ...dc,
      alignment: { vertical: "middle", horizontal: "left", wrapText: true },
    };

    ws.mergeCells(`B${rowIdx}:D${rowIdx}`);

    const setCv = (
      col: string,
      val: string | number,
      style: Partial<ExcelJS.Style> = dc,
    ) => {
      const c = ws.getCell(`${col}${rowIdx}`);
      c.value = val as ExcelJS.CellValue;
      c.style = style as ExcelJS.Style;
    };

    setCv("A", l.lrn, cc);
    setCv("B", name, nc);
    setCv("E", l.sex === "MALE" ? "M" : "F", cc);
    setCv("F", fmtDate(l.birthdate), cc);
    setCv("G", computeAge(l.birthdate), cc);
    setCv("H", l.motherTongue, dc);
    setCv("I", l.ipGroup, dc);
    setCv("J", l.religion, dc);
    setCv("K", l.houseStreet, dc);
    setCv("L", l.barangay, dc);
    setCv("M", l.municipality, dc);
    setCv("N", l.province, dc);
    setCv("O", l.fatherName, dc);
    setCv("P", l.motherName, dc);
    setCv("Q", l.guardianName, dc);
    setCv("R", l.guardianRelationship, dc);
    setCv("S", l.contactNumber, dc);
    setCv("T", "", cc);
    setCv("U", "", cc);
    ws.getRow(rowIdx).height = 16;
    rowIdx++;
  };

  const writeTotalRow = (label: string, count: number) => {
    ws.mergeCells(`A${rowIdx}:S${rowIdx}`);
    const lc = ws.getCell(`A${rowIdx}`);
    lc.value = label;
    lc.style = {
      font: { bold: true, size: 9 },
      alignment: { horizontal: "right", vertical: "middle" },
      border: thinBorder,
    } as ExcelJS.Style;
    const tc = ws.getCell(`T${rowIdx}`);
    tc.value = count;
    tc.style = {
      font: { bold: true, size: 9 },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder,
    } as ExcelJS.Style;
    ws.getCell(`U${rowIdx}`).style = {
      border: thinBorder,
    } as ExcelJS.Style;
    ws.getRow(rowIdx).height = 14;
    rowIdx++;
  };

  males.forEach((l) => writeLearnerRow(l, maleFill));
  writeTotalRow("TOTAL MALE", males.length);

  females.forEach((l) => writeLearnerRow(l, femaleFill));
  writeTotalRow("TOTAL FEMALE", females.length);

  writeTotalRow("COMBINED", allLearners.length);

  // ── Legend ────────────────────────────────────────────────────────────────
  rowIdx++; // blank row
  ws.mergeCells(`A${rowIdx}:U${rowIdx}`);
  ws.getCell(`A${rowIdx}`).value =
    "T/O = Transferred Out, T/I = Transferred In, DRP = Dropped, " +
    "LE = Late Enrollment, CCT = CCT Recipient, B/A = Balik Aral, " +
    "SNED = Special Needs Education, ACL = Accelerated";
  ws.getCell(`A${rowIdx}`).font = { size: 8, italic: true };
  ws.getCell(`A${rowIdx}`).alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  ws.getRow(rowIdx).height = 20;
  rowIdx++;

  // ── Signature block ───────────────────────────────────────────────────────
  rowIdx++; // blank row
  ws.getCell(`A${rowIdx}`).value = "Prepared by:";
  ws.getCell(`A${rowIdx}`).font = { bold: true, size: 9 };
  ws.mergeCells(`B${rowIdx}:G${rowIdx}`);
  ws.getCell(`B${rowIdx}`).value = adviserName;
  ws.getCell(`B${rowIdx}`).font = { size: 9 };
  ws.getCell(`B${rowIdx}`).border = { bottom: thin };
  ws.getCell(`H${rowIdx}`).value = "Certified Correct:";
  ws.getCell(`H${rowIdx}`).font = { bold: true, size: 9 };
  ws.mergeCells(`I${rowIdx}:N${rowIdx}`);
  ws.getCell(`I${rowIdx}`).border = { bottom: thin };
  ws.getRow(rowIdx).height = 16;
  rowIdx++;

  ws.getCell(`A${rowIdx}`).value = "BoSY Date:";
  ws.getCell(`A${rowIdx}`).font = { bold: true, size: 9 };
  ws.mergeCells(`B${rowIdx}:D${rowIdx}`);
  ws.getCell(`B${rowIdx}`).border = { bottom: thin };
  ws.getCell(`E${rowIdx}`).value = "EoSY Date:";
  ws.getCell(`E${rowIdx}`).font = { bold: true, size: 9 };
  ws.mergeCells(`F${rowIdx}:H${rowIdx}`);
  ws.getCell(`F${rowIdx}`).border = { bottom: thin };
  ws.getRow(rowIdx).height = 16;

  // ── Stream response ───────────────────────────────────────────────────────
  const safeSection = section.name.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim();
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="SF1-${safeSection}.xlsx"`,
  );

  await wb.xlsx.write(res);
  res.end();
}
