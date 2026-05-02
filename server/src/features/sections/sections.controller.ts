import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import {
  ApplicantType,
  SectioningMethod,
  SectionAdviserStatus,
} from "../../generated/prisma/index.js";
import { SectioningEngine } from "../enrollment/services/sectioning-engine.service.js";
import { DEFAULT_SECTIONING_PARAMS } from "@enrollpro/shared";
import type { SectioningParams } from "@enrollpro/shared";

const sectioningEngine = new SectioningEngine(prisma);

export async function getBatchPrerequisites(req: Request, res: Response) {
  const { gradeLevelId } = req.params;
  const schoolYearId = req.query.schoolYearId
    ? parseInt(String(req.query.schoolYearId))
    : null;

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
  const { gradeLevelId, schoolYearId, params } = req.body;

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
  const { gradeLevelId, schoolYearId, assignments } = req.body;

  if (!assignments || assignments.length === 0) {
    return res
      .status(400)
      .json({ message: "No assignments provided to commit" });
  }

  const results = await prisma.$transaction(
    async (tx) => {
      const appIds = assignments.map((a: any) => a.applicationId);

      await tx.enrollmentApplication.updateMany({
        where: {
          id: { in: appIds },
          status: { not: "TEMPORARILY_ENROLLED" },
        },
        data: { status: "ENROLLED" },
      });

      const recordsToCreate = assignments.map((assignment: any) => ({
        enrollmentApplicationId: assignment.applicationId,
        sectionId: assignment.sectionId,
        schoolYearId,
        enrolledById: req.user!.userId,
      }));

      await tx.enrollmentRecord.createMany({
        data: recordsToCreate,
      });

      return new Array(assignments.length);
    },
    {
      timeout: 15000,
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

const INACTIVE_EOSY_STATUSES = ["TRANSFERRED_OUT", "DROPPED_OUT"];

const activeEnrollmentFilter = {
  OR: [
    { eosyStatus: { equals: null } },
    {
      eosyStatus: {
        notIn: INACTIVE_EOSY_STATUSES as any,
      },
    },
  ],
};

export async function listSections(req: Request, res: Response): Promise<void> {
  const ayId = req.params.ayId ? parseInt(String(req.params.ayId)) : null;
  const { gradeLevelId, programType } = req.query;

  if (gradeLevelId) {
    const where: Record<string, any> = {
      gradeLevelId: parseInt(String(gradeLevelId)),
    };
    if (ayId) where.schoolYearId = ayId;
    if (programType) where.programType = programType;

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
          displayName: s.displayName,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
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
        where: ayId ? { schoolYearId: ayId } : undefined,
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
          displayName: s.displayName,
          sortOrder: s.sortOrder,
          maxCapacity: s.maxCapacity,
          programType: s.programType,
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
  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, middleName: true, employeeId: true },
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
  const {
    name,
    displayName,
    sortOrder,
    maxCapacity,
    gradeLevelId,
    schoolYearId,
    programType,
    advisingTeacherId,
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
        displayName: displayName || normalizedName,
        sortOrder: resolvedSortOrder,
        maxCapacity: maxCapacity ?? 40,
        gradeLevelId,
        schoolYearId,
        programType: normalizedProgramType as ApplicantType,
      },
    });

    if (advisingTeacherId) {
      const sy = await tx.schoolYear.findUnique({ where: { id: schoolYearId } });
      await tx.sectionAdviser.create({
        data: {
          sectionId: s.id,
          teacherId: advisingTeacherId,
          schoolYearId,
          status: SectionAdviserStatus.ACTIVE,
          effectiveFrom: sy?.classOpeningDate || new Date(),
        },
      });
      
      // Update teacher designation load
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
          advisoryEquivalentHoursPerWeek: 5,
        },
        create: {
          teacherId: advisingTeacherId,
          schoolYearId,
          isClassAdviser: true,
          advisorySectionId: s.id,
          advisoryEquivalentHoursPerWeek: 5,
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
}

export async function updateSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(String(req.params.id));
  const { name, displayName, sortOrder, maxCapacity, advisingTeacherId } =
    req.body;

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
        ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(maxCapacity !== undefined ? { maxCapacity: Number(maxCapacity) } : {}),
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
              advisoryEquivalentHoursPerWeek: 0,
            },
          });
        }

        if (advisingTeacherId) {
          const sy = await tx.schoolYear.findUnique({ where: { id: s.schoolYearId } });
          await tx.sectionAdviser.create({
            data: {
              sectionId: s.id,
              teacherId: advisingTeacherId,
              schoolYearId: s.schoolYearId,
              status: SectionAdviserStatus.ACTIVE,
              effectiveFrom: new Date(),
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
              advisoryEquivalentHoursPerWeek: 5,
            },
            create: {
              teacherId: advisingTeacherId,
              schoolYearId: s.schoolYearId,
              isClassAdviser: true,
              advisorySectionId: s.id,
              advisoryEquivalentHoursPerWeek: 5,
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
  const learners = section.enrollmentRecords.map((record) => ({
    id: record.enrollmentApplication.learner.id,
    enrollmentApplicationId: record.enrollmentApplication.id,
    lrn: record.enrollmentApplication.learner.lrn,
    firstName: record.enrollmentApplication.learner.firstName,
    lastName: record.enrollmentApplication.learner.lastName,
    middleName: record.enrollmentApplication.learner.middleName,
    sex: record.enrollmentApplication.learner.sex,
    status: record.enrollmentApplication.status,
    enrolledAt: record.enrolledAt,
  }));

  res.json({
    section: {
      id: section.id,
      name: section.name,
      displayName: section.displayName,
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
  const { gradeLevelId, schoolYearId } = req.query;

  if (!gradeLevelId || !schoolYearId) {
    res.status(400).json({ message: "gradeLevelId and schoolYearId required" });
    return;
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      gradeLevelId: parseInt(gradeLevelId as string),
      schoolYearId: parseInt(schoolYearId as string),
      status: "PASSED",
      enrollmentRecord: null,
    },
    include: {
      learner: true,
    },
    orderBy: [{ learner: { lastName: "asc" } }, { learner: { firstName: "asc" } }],
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
    })),
  });
}

export async function inlineSlotLearner(
  req: Request,
  res: Response,
): Promise<void> {
  const { enrollmentApplicationId, sectionId, schoolYearId } = req.body;

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

  if (section._count.enrollmentRecords >= section.maxCapacity) {
    res.status(400).json({ message: "Section is already at maximum capacity" });
    return;
  }

  const record = await prisma.$transaction(async (tx) => {
    await tx.enrollmentApplication.update({
      where: { id: enrollmentApplicationId },
      data: { status: "ENROLLED" },
    });

    return tx.enrollmentRecord.create({
      data: {
        enrollmentApplicationId,
        sectionId,
        schoolYearId,
        enrolledById: req.user!.userId,
        sectioningMethod: SectioningMethod.INLINE_SLOTTING,
      },
    });
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "LEARNER_SECTIONED_INLINE",
    description: `Sectioned learner application ID ${enrollmentApplicationId} to ${section.name}`,
    subjectType: "Section",
    recordId: sectionId,
    req,
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
      return res.status(400).json({ message: "No active adviser to handover from" });
    }

    const resolvedHandoverDate = handoverDate ? new Date(handoverDate) : new Date();
    const nextDay = new Date(resolvedHandoverDate);
    nextDay.setDate(nextDay.getDate() + 1);

    await prisma.$transaction(async (tx) => {
      // 1. Close current ledger
      await tx.sectionAdviser.update({
        where: { id: currentActive.id },
        data: {
          status: SectionAdviserStatus.HANDED_OVER,
          effectiveTo: resolvedHandoverDate,
          handoverReason: handoverReason || "Maternity Leave / Mid-year reassignment",
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
          advisoryEquivalentHoursPerWeek: 0,
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
          advisoryEquivalentHoursPerWeek: 5,
        },
        create: {
          teacherId: substituteTeacherId,
          schoolYearId: section.schoolYearId,
          isClassAdviser: true,
          advisorySectionId: sectionId,
          advisoryEquivalentHoursPerWeek: 5,
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
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
