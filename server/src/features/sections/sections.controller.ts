import { fileURLToPath } from "url";
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import {
  ApplicantType,
  EosyStatus,
  SectioningMethod,
  SectionAdviserStatus,
} from "../../generated/prisma/index.js";
import type { Sf1ImportCommitInput } from "@enrollpro/shared";
import { ensureLearnerUserAccount } from "../learner/learner.service.js";
import { broadcastRealtimeInvalidation } from "../../lib/sse.js";
import {
  commitSf1RosterImport,
  previewSf1RosterImport,
} from "./sf1-roster.service.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function broadcastSectionInvalidation({
  schoolYearId,
  sectionIds,
  teacherIds,
  learnerIds,
}: {
  schoolYearId: number;
  sectionIds?: number[];
  teacherIds?: number[];
  learnerIds?: number[];
}): void {
  broadcastRealtimeInvalidation({
    topics: [
      "teachers:list",
      "homerooms:sections",
      "homerooms:teachers",
      "homerooms:adviser-candidates",
      "sectioning:sections",
      "sectioning:pool",
      "students:list",
      "dashboard:summary",
    ],
    schoolYearId,
    sectionIds,
    teacherIds,
    learnerIds,
  });
}

function numericIds(values: Array<number | string | null | undefined>): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
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

function getSectionSortWeight(programType: string, isHomogeneous: boolean) {
  if (programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") return 1;
  if (programType === "SPECIAL_PROGRAM_IN_SPORTS") return 2;
  if (programType === "SPECIAL_PROGRAM_IN_THE_ARTS") return 3;
  if (programType !== "REGULAR") return 4;
  if (isHomogeneous) return 5;
  return 6;
}

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

  const sy = await prisma.schoolYear.findUnique({ where: { id: ayId } });
  const isArchived = sy?.status === "ARCHIVED";

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
          where: isArchived ? undefined : { status: SectionAdviserStatus.ACTIVE },
          orderBy: { createdAt: "desc" },
          include: { teacher: true },
        },
        _count: {
          select: isArchived ? {
            enrollmentHistories: {
              where: activeEnrollmentFilter,
            },
          } : {
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
        const enrollmentCounts = s._count as {
          enrollmentHistories?: number;
          enrollmentRecords?: number;
        };
        return {
          id: s.id,
          name: s.name,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
          isHomogeneous: s.isHomogeneous,
          sectionRank: s.sectionRank ?? null,
          enrolledCount: isArchived
            ? enrollmentCounts.enrollmentHistories ?? 0
            : enrollmentCounts.enrollmentRecords ?? 0,
          advisingTeacher: activeAdviser
            ? {
                id: activeAdviser.id,
                name: `${activeAdviser.lastName}, ${activeAdviser.firstName}${activeAdviser.middleName ? ` ${activeAdviser.middleName.charAt(0)}.` : ""}`,
              }
            : null,
        };
      }).sort((a, b) => {
        const weightA = getSectionSortWeight(a.programType, a.isHomogeneous);
        const weightB = getSectionSortWeight(b.programType, b.isHomogeneous);
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
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
            where: isArchived ? undefined : { status: SectionAdviserStatus.ACTIVE },
            orderBy: { createdAt: "desc" },
            include: { teacher: true },
          },
          _count: {
            select: isArchived ? {
              enrollmentHistories: {
                where: activeEnrollmentFilter,
              },
            } : {
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
        const enrollmentCounts = s._count as {
          enrollmentHistories?: number;
          enrollmentRecords?: number;
        };
        return {
          id: s.id,
          name: s.name,
          sortOrder: s.sortOrder,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
          isHomogeneous: s.isHomogeneous,
          sectionRank: s.sectionRank ?? null,
          enrolledCount: isArchived
            ? enrollmentCounts.enrollmentHistories ?? 0
            : enrollmentCounts.enrollmentRecords ?? 0,
          advisingTeacher: activeAdviser
            ? {
                id: activeAdviser.id,
                name: `${activeAdviser.lastName}, ${activeAdviser.firstName}${activeAdviser.middleName ? ` ${activeAdviser.middleName.charAt(0)}.` : ""}`,
              }
            : null,
        };
      }).sort((a, b) => {
        const weightA = getSectionSortWeight(a.programType, a.isHomogeneous);
        const weightB = getSectionSortWeight(b.programType, b.isHomogeneous);
        if (weightA !== weightB) return weightA - weightB;
        return a.name.localeCompare(b.name);
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

    if (isHomogeneous && normalizedProgramType === "REGULAR") {
      const settings = await prisma.schoolSetting.findFirst();
      const limit = settings?.homogeneousSectionCount ?? 5;
      const count = await prisma.section.count({
        where: {
          gradeLevelId: parseInt(String(gradeLevelId)),
          schoolYearId: parseInt(String(schoolYearId)),
          isHomogeneous: true,
          programType: "REGULAR"
        }
      });
      if (count >= limit) {
        res.status(400).json({ message: `Cannot exceed the maximum limit of ${limit} homogeneous sections per grade level. Update settings in System Configuration.` });
        return;
      }
    }

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

    broadcastSectionInvalidation({
      schoolYearId: section.schoolYearId,
      sectionIds: [section.id],
      teacherIds: numericIds([advisingTeacherId]),
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

    const newProgramType = programType !== undefined ? programType : existing.programType;
    const newIsHomogeneous = isHomogeneous !== undefined ? Boolean(isHomogeneous) : existing.isHomogeneous;

    if (newIsHomogeneous && newProgramType === "REGULAR" && (!existing.isHomogeneous || existing.programType !== "REGULAR")) {
      const settings = await prisma.schoolSetting.findFirst();
      const limit = settings?.homogeneousSectionCount ?? 5;
      const count = await prisma.section.count({
        where: {
          gradeLevelId: existing.gradeLevelId,
          schoolYearId: existing.schoolYearId,
          isHomogeneous: true,
          programType: "REGULAR"
        }
      });
      if (count >= limit) {
        res.status(400).json({ message: `Cannot exceed the maximum limit of ${limit} homogeneous sections per grade level. Update settings in System Configuration.` });
        return;
      }
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

    broadcastSectionInvalidation({
      schoolYearId: section.schoolYearId,
      sectionIds: [section.id],
      teacherIds: numericIds([
        existing.advisers[0]?.teacherId,
        advisingTeacherId,
      ]),
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

  // Check if there are any enrollment records referencing this section
  const enrollmentCount = await prisma.enrollmentRecord.count({
    where: { sectionId: id },
  });

  if (enrollmentCount > 0) {
    res.status(400).json({
      message: "Cannot delete section because it contains enrolled learners. Please transfer or unassign all learners first.",
    });
    return;
  }

  // Clear advisory section references in teacher designations
  await prisma.teacherDesignation.updateMany({
    where: { advisorySectionId: id },
    data: { advisorySectionId: null },
  });

  await prisma.section.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_DELETED",
    description: `Deleted section: ${section.name}`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  broadcastSectionInvalidation({
    schoolYearId: section.schoolYearId,
    sectionIds: [section.id],
  });

  res.json({ message: "Section deleted successfully" });
}

export async function getSectionMasterlist(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      schoolYear: true,
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
              learner: {
                include: {
                  enrollmentRecords: {
                    where: { finalAverage: { not: null } },
                    orderBy: { schoolYearId: "desc" },
                    take: 1,
                  },
                },
              },
              previousSchool: { select: { generalAverage: true } },
            },
          },
        },
      },
      enrollmentHistories: {
        where: activeEnrollmentFilter,
        include: {
          learner: true,
          adviser: true,
        },
      },
    },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const isArchived = section.schoolYear.status === "ARCHIVED";
  const activeAdviser = isArchived
    ? (section.enrollmentHistories.find(h => h.adviser)?.adviser ?? section.advisers[0]?.teacher ?? null)
    : section.advisers[0]?.teacher ?? null;
  
  const learners = isArchived
    ? section.enrollmentHistories.map((hist) => ({
        id: hist.learner.id,
        enrollmentApplicationId: 0,
        lrn: hist.learner.lrn,
        firstName: hist.learner.firstName,
        lastName: hist.learner.lastName,
        middleName: hist.learner.middleName,
        sex: hist.learner.sex,
        birthdate: hist.learner.birthdate?.toISOString() ?? null,
        status: "READY_FOR_SECTIONING",
        applicantType: "NEW_ENROLLEE",
        enrolledAt: hist.createdAt,
        sectioningMethod: "MANUAL",
        dateSectioned: hist.createdAt?.toISOString() ?? null,
        sf1Remarks: null,
        genAve: null,
      }))
    : section.enrollmentRecords.map((record) => ({
        id: record.enrollmentApplication.learner.id,
        enrollmentApplicationId: record.enrollmentApplication.id,
        lrn: record.enrollmentApplication.learner.lrn,
        firstName: record.enrollmentApplication.learner.firstName,
        lastName: record.enrollmentApplication.learner.lastName,
        middleName: record.enrollmentApplication.learner.middleName,
        sex: record.enrollmentApplication.learner.sex,
        birthdate: record.enrollmentApplication.learner.birthdate?.toISOString() ?? null,
        status: record.enrollmentApplication.status,
        applicantType: record.enrollmentApplication.applicantType,
        enrolledAt: record.enrolledAt,
        sectioningMethod: record.sectioningMethod,
        dateSectioned: record.dateSectioned?.toISOString() ?? null,
        sf1Remarks: record.sf1Remarks ?? null,
        genAve:
          record.enrollmentApplication.learner.enrollmentRecords[0]?.finalAverage ??
          record.enrollmentApplication.previousSchool?.generalAverage ??
          record.enrollmentApplication.learner.previousGenAve ??
          null,
      }));

  res.json({
    section: {
      id: section.id,
      name: section.name,
      maxCapacity: section.maxCapacity,
      programType: section.programType,
      gradeLevel: section.gradeLevel.name,
      gradeLevelId: section.gradeLevelId,
      schoolYearId: section.schoolYearId,
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
  const gradeLevelId = req.params.gradeLevelId ?? req.query.gradeLevelId;
  const schoolYearId = req.query.schoolYearId
    ? parseInt(String(req.query.schoolYearId))
    : req.schoolYearId;
  const parsedGradeLevelId = parseInt(String(gradeLevelId));

  if (!Number.isInteger(parsedGradeLevelId) || parsedGradeLevelId <= 0) {
    res.status(400).json({ message: "A valid grade level is required." });
    return;
  }

  if (!schoolYearId) {
    res.status(400).json({ message: "gradeLevelId and schoolYearId required" });
    return;
  }

  try {
    const applications = await prisma.enrollmentApplication.findMany({
      where: {
        gradeLevelId: parsedGradeLevelId,
        schoolYearId,
        status: "READY_FOR_SECTIONING",
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

    const pool = applications.map((app) => ({
      id: app.learner.id,
      enrollmentApplicationId: app.id,
      lrn: app.learner.lrn,
      firstName: app.learner.firstName,
      lastName: app.learner.lastName,
      middleName: app.learner.middleName,
      sex: app.learner.sex,
      applicantType: app.applicantType,
      learnerType: app.learnerType,
      promotionGenAve:
        app.learner.enrollmentRecords[0]?.finalAverage ??
        app.previousSchool?.generalAverage ??
        app.learner.previousGenAve ??
        null,
    }));

    res.json({ pool, learners: pool });
  } catch (error: unknown) {
    console.error("Failed to retrieve unsectioned learner pool", error);
    res.status(500).json({
      message: "Could not retrieve the unsectioned learner pool.",
    });
  }
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
      data: { status: "OFFICIALLY_ENROLLED" },
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

  broadcastSectionInvalidation({
    schoolYearId,
    sectionIds: [sectionId],
    learnerIds: app ? [app.learnerId] : undefined,
  });

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

    broadcastSectionInvalidation({
      schoolYearId: section.schoolYearId,
      sectionIds: [sectionId],
      teacherIds: numericIds([currentActive.teacherId, substituteTeacherId]),
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
    let targetSection = null;
    if (targetSectionId !== null) {
      targetSection = await prisma.section.findUnique({
        where: { id: targetSectionId },
      });

      if (!targetSection) {
        return res.status(404).json({ message: "Target section not found" });
      }
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

    if (targetSectionId === null) {
      // Unassign learner
      await prisma.$transaction(async (tx) => {
        await tx.enrollmentRecord.delete({
          where: { id: application.enrollmentRecord!.id },
        });
        await tx.enrollmentApplication.update({
          where: { id: enrollmentApplicationId },
          data: { status: "READY_FOR_SECTIONING" },
        });
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "LEARNER_UNASSIGNED",
        description: `Unassigned learner app ID ${enrollmentApplicationId} from ${oldSectionName}. Reason: ${reason || "Not specified"}`,
        subjectType: "Section",
        recordId: application.enrollmentRecord.sectionId,
        req,
      });

      broadcastSectionInvalidation({
        schoolYearId: application.schoolYearId,
        sectionIds: [application.enrollmentRecord.sectionId],
        learnerIds: [application.learnerId],
      });

      res.json({ message: "Learner unassigned successfully" });
    } else {
      // Transfer learner
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
        description: `Transferred learner app ID ${enrollmentApplicationId} from ${oldSectionName} to ${targetSection!.name}. Reason: ${reason || "Not specified"}`,
        subjectType: "Section",
        recordId: targetSectionId,
        req,
      });

      broadcastSectionInvalidation({
        schoolYearId: application.schoolYearId,
        sectionIds: [
          application.enrollmentRecord.sectionId,
          Number(targetSectionId),
        ],
        learnerIds: [application.learnerId],
      });

      res.json({
        message: "Learner transferred successfully",
        record: updatedRecord,
      });
    }
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ message: err.message });
  }
}

export async function exportSectionSf1(
  req: Request,
  res: Response,
): Promise<void> {
  try {
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
        select: { schoolName: true, depedSchoolId: true, division: true, schoolHeadName: true },
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

    // First Friday of June of school year start year (Rule 2)
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
      sf1Remarks: string;
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
          ? `${m.lastName.toUpperCase()}, ${m.firstName.toUpperCase()}${m.middleName ? " " + m.middleName.toUpperCase() : ""}`
          : "";
      return {
        lrn: l.lrn ?? "",
        lastName: l.lastName,
        firstName: l.firstName,
        middleName: l.middleName ?? "",
        sex: l.sex,
        birthdate: l.birthdate,
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
        guardianName: app.guardianName ? app.guardianName.toUpperCase() : "",
        guardianRelationship: app.guardianRelationship ? app.guardianRelationship.toUpperCase() : "",
        contactNumber: app.contactNumber ?? "",
        sf1Remarks: r.sf1Remarks ?? "",
      };
    });

    // Rule 4: Gender Stratification & Alphabetical Sorting
    const males = allLearners
      .filter((l) => l.sex === "MALE")
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.middleName.localeCompare(b.middleName),
      );

    const females = allLearners
      .filter((l) => l.sex !== "MALE")
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName) ||
          a.middleName.localeCompare(b.middleName),
      );

    const fmtDate = (d: Date | null): string => {
      if (!d) return "";
      const dt = new Date(d);
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      const yyyy = dt.getUTCFullYear();
      return `${mm}/${dd}/${yyyy}`;
    };

    // Rule 2: June Age Calculation
    const computeJuneAge = (birthdate: Date | null): string | number => {
      if (!birthdate) return "";
      const bdate = new Date(birthdate);
      if (isNaN(bdate.getTime())) return "";

      let age = firstFridayJune.getFullYear() - bdate.getUTCFullYear();
      const mDiff = firstFridayJune.getMonth() - bdate.getUTCMonth();
      if (mDiff < 0 || (mDiff === 0 && firstFridayJune.getDate() < bdate.getUTCDate())) {
        age--;
      }
      return age >= 0 ? age : "";
    };

    // Robust template path resolution across dev, prod, monorepo roots
    const candidatePaths = [
      path.resolve(__dirname, "../../../templates/blank_sf1.xlsx"),
      path.resolve(__dirname, "../../templates/blank_sf1.xlsx"),
      path.resolve(process.cwd(), "server/templates/blank_sf1.xlsx"),
      path.resolve(process.cwd(), "templates/blank_sf1.xlsx"),
    ];

    const templatePath = candidatePaths.find((p) => fs.existsSync(p));

    const wb = new ExcelJS.Workbook();
    if (templatePath && fs.existsSync(templatePath)) {
      await wb.xlsx.readFile(templatePath);
    } else {
      throw new Error(`SF1 template file not found. Checked: ${candidatePaths.join(", ")}`);
    }

    const ws = wb.getWorksheet(1);
    if (!ws) {
      throw new Error("SF1 template worksheet not found.");
    }

    // Rule 1: Document Header Injection
    ws.getCell("F3").value = schoolSetting?.depedSchoolId ?? "";
    ws.getCell("T3").value = schoolSetting?.division ?? "";
    ws.getCell("F4").value = schoolSetting?.schoolName ?? "";
    ws.getCell("T4").value = section.schoolYear.yearLabel;
    ws.getCell("AE4").value = section.gradeLevel.name;
    ws.getCell("AM4").value = section.name;

    // Clear rows 7 to 46 before populating to wipe out any sample data
    for (let rowNum = 7; rowNum <= 46; rowNum++) {
      const row = ws.getRow(rowNum);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.value = null;
      });
    }

    // Write Learner Rows & Stratify Gender (Rule 3 & Rule 4)
    let r = 7;

    const writeLearnerRow = (l: LearnerRow, sexLabel: "M" | "F") => {
      const fullName = `${l.lastName.toUpperCase()}, ${l.firstName.toUpperCase()}${l.middleName ? " " + l.middleName.toUpperCase() : ""}`;
      
      ws.getCell(`A${r}`).value = l.lrn;
      ws.getCell(`C${r}`).value = fullName;
      ws.getCell(`G${r}`).value = sexLabel;
      ws.getCell(`H${r}`).value = fmtDate(l.birthdate);
      ws.getCell(`J${r}`).value = computeJuneAge(l.birthdate);
      ws.getCell(`L${r}`).value = ""; // Rule 3: Leave Mother Tongue blank for JHS!
      ws.getCell(`N${r}`).value = l.ipGroup;
      ws.getCell(`O${r}`).value = l.religion;
      ws.getCell(`P${r}`).value = l.houseStreet;
      ws.getCell(`R${r}`).value = l.barangay;
      ws.getCell(`U${r}`).value = l.municipality;
      ws.getCell(`W${r}`).value = l.province;
      ws.getCell(`AB${r}`).value = l.fatherName;
      ws.getCell(`AF${r}`).value = l.motherName;
      ws.getCell(`AK${r}`).value = l.guardianName;
      ws.getCell(`AO${r}`).value = l.guardianRelationship;
      ws.getCell(`AP${r}`).value = l.contactNumber;
      ws.getCell(`AR${r}`).value = "";
      ws.getCell(`AS${r}`).value = l.sf1Remarks;
      r++;
    };

    // Males
    males.forEach((l) => writeLearnerRow(l, "M"));

    // Male Total Row (Rule 4)
    ws.getCell(`C${r}`).value = "<=== TOTAL MALE";
    ws.getCell(`A${r}`).value = males.length;
    r++;

    // Females
    females.forEach((l) => writeLearnerRow(l, "F"));

    // Female Total Row (Rule 4)
    ws.getCell(`C${r}`).value = "<=== TOTAL FEMALE";
    ws.getCell(`A${r}`).value = females.length;
    r++;

    // Combined Total Row (Rule 4)
    ws.getCell(`C${r}`).value = "<=== COMBINED";
    ws.getCell(`A${r}`).value = allLearners.length;

    // Rule 5: Summary Statistics and Signature Block Injection (Rows 45-56)
    // Registered Counts Grid
    ws.getCell("X47").value = males.length;
    ws.getCell("AA47").value = males.length;
    ws.getCell("X50").value = females.length;
    ws.getCell("AA50").value = females.length;
    ws.getCell("X52").value = allLearners.length;
    ws.getCell("AA52").value = allLearners.length;

    // Signature Block Injection
    ws.getCell("AE47").value = adviserName.toUpperCase();
    ws.getCell("AN47").value = (schoolSetting?.schoolHeadName || "MYZA MAE PINEDA").toUpperCase();

    // Footer Provenance & Timestamp
    ws.getCell("AN55").value = "Generated thru EnrollPro";

    const now = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formattedNow = now.toLocaleDateString("en-US", dateOptions);
    ws.getCell("A56").value = `Generated on: ${formattedNow}`;

    const safeSection = section.name.replace(/[^a-zA-Z0-9\-_ ]/g, "").trim();
    const buffer = await wb.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="SF1-${safeSection}.xlsx"`,
    );

    res.send(Buffer.from(buffer));
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Error in exportSectionSf1:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
}

export async function previewSectionSf1Import(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    res.status(400).json({ message: "A valid section is required." });
    return;
  }

  if (!req.file?.buffer) {
    res.status(400).json({ message: "Upload one SF1 Excel file." });
    return;
  }

  try {
    const preview = await previewSf1RosterImport(sectionId, req.file.buffer);
    res.json(preview);
  } catch (error: unknown) {
    res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not parse the SF1 roster file.",
    });
  }
}

export async function commitSectionSf1Import(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    res.status(400).json({ message: "A valid section is required." });
    return;
  }

  try {
    const result = await commitSf1RosterImport({
      sectionId,
      userId: req.user!.userId,
      input: req.body as Sf1ImportCommitInput,
    });

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: { name: true, schoolYearId: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SF1_ROSTER_IMPORT_COMMITTED",
      description: `Imported ${result.committedCount} learner(s) into ${section?.name ?? "section"} from SF1 roster.`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });

    if (section) {
      broadcastRealtimeInvalidation({
        topics: [
          "homerooms:sections",
          "sectioning:sections",
          "students:list",
          "students:detail",
          "dashboard:summary",
        ],
        schoolYearId: section.schoolYearId,
        sectionIds: [sectionId],
        learnerIds: result.learnerIds,
      });
    }

    res.json(result);
  } catch (error: unknown) {
    res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Could not commit the SF1 roster import.",
    });
  }
}

export async function downloadSectionSf1Template(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    res.status(400).json({ message: "A valid section is required." });
    return;
  }

  const [section, schoolSetting] = await Promise.all([
    prisma.section.findUnique({
      where: { id: sectionId },
      include: { gradeLevel: true, schoolYear: true },
    }),
    prisma.schoolSetting.findFirst({
      select: { schoolName: true, depedSchoolId: true, division: true, schoolHeadName: true },
    }),
  ]);

  if (!section) {
    res.status(404).json({ message: "Section not found." });
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("SF1 Template");
  worksheet.columns = [
    { width: 14 },
    { width: 28 },
    { width: 5 },
    { width: 13 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 22 },
    { width: 22 },
    { width: 18 },
    { width: 14 },
    { width: 16 },
  ];

  const thin = { style: "thin" as const };
  const border = { top: thin, left: thin, bottom: thin, right: thin };
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { name: "Arial Narrow", size: 9, bold: true },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border,
  };

  worksheet.mergeCells("A1:P1");
  worksheet.getCell("A1").value = "School Form 1 (SF1) Roster Import Template";
  worksheet.getCell("A1").font = { name: "Arial Narrow", size: 13, bold: true };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  worksheet.mergeCells("A2:P2");
  worksheet.getCell("A2").value =
    "Use this template for section-level roster import. EnrollPro will use the active section grade, program, and school year.";
  worksheet.getCell("A2").font = { name: "Arial Narrow", size: 9, italic: true };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  worksheet.getCell("A4").value = "School ID:";
  worksheet.getCell("B4").value = schoolSetting?.depedSchoolId ?? "";
  worksheet.getCell("D4").value = "Division:";
  worksheet.getCell("E4").value = schoolSetting?.division ?? "";
  worksheet.getCell("A5").value = "School Name:";
  worksheet.getCell("B5").value = schoolSetting?.schoolName ?? "";
  worksheet.getCell("D5").value = "School Year:";
  worksheet.getCell("E5").value = section.schoolYear.yearLabel;
  worksheet.getCell("G5").value = "Grade:";
  worksheet.getCell("H5").value = section.gradeLevel.name;
  worksheet.getCell("J5").value = "Section:";
  worksheet.getCell("K5").value = section.name;

  const headers = [
    "LRN",
    "NAME (Last, First Middle)",
    "SEX",
    "BIRTH DATE (MM/DD/YYYY)",
    "MOTHER TONGUE",
    "IP ETHNIC GROUP",
    "RELIGION",
    "HOUSE/STREET/SITIO",
    "BARANGAY",
    "MUNICIPALITY/CITY",
    "PROVINCE",
    "FATHER NAME",
    "MOTHER NAME",
    "GUARDIAN NAME",
    "GUARDIAN RELATIONSHIP",
    "CONTACT NUMBER",
  ];

  let rowNumber = 7;
  const writeAnchor = (label: string) => {
    worksheet.mergeCells(`A${rowNumber}:P${rowNumber}`);
    const anchor = worksheet.getCell(`A${rowNumber}`);
    anchor.value = label;
    anchor.font = { name: "Arial Narrow", size: 10, bold: true };
    anchor.alignment = { horizontal: "left", vertical: "middle" };
    rowNumber += 1;

    const headerRow = worksheet.getRow(rowNumber);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.style = headerStyle as ExcelJS.Style;
    });
    rowNumber += 1;

    for (let index = 0; index < 20; index += 1) {
      const row = worksheet.getRow(rowNumber);
      for (let column = 1; column <= headers.length; column += 1) {
        const cell = row.getCell(column);
        cell.border = border;
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.font = { name: "Arial Narrow", size: 9 };
      }
      rowNumber += 1;
    }
  };

  writeAnchor("MALE LEARNERS");
  rowNumber += 1;
  writeAnchor("FEMALE LEARNERS");

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="SF1_Template_${section.gradeLevel.name}_${section.name}.xlsx"`,
  );
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(Buffer.from(buffer));
}
