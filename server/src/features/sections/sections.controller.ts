import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import type { ApplicantType, ApplicationStatus, SectioningMethod } from "../../generated/prisma/index.js";
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

      // 1. Update application statuses in bulk
      // If it's NOT already temporarily enrolled, move to ENROLLED.
      // If it IS temporarily enrolled, we leave it as is.
      await tx.enrollmentApplication.updateMany({
        where: {
          id: { in: appIds },
          status: { not: "TEMPORARILY_ENROLLED" },
        },
        data: { status: "ENROLLED" },
      });

      // 2. Create enrollment records in bulk
      const recordsToCreate = assignments.map((assignment: any) => ({
        enrollmentApplicationId: assignment.applicationId,
        sectionId: assignment.sectionId,
        schoolYearId,
        enrolledById: req.user!.userId,
      }));

      await tx.enrollmentRecord.createMany({
        data: recordsToCreate,
      });

      // Return a dummy array with the same length to satisfy the response logic
      return new Array(assignments.length);
    },
    {
      timeout: 15000, // Increase timeout to 15 seconds for batch operations
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

/**
 * Common filter for active enrollment records.
 * Includes NULL eosyStatus and excludes specific inactive statuses.
 */
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
  const ayId = req.params.ayId ? parseInt(req.params.ayId as string) : null;
  const { gradeLevelId, programType } = req.query;

  const normalizedProgramType =
    typeof programType === "string" ? programType : undefined;
  if (
    normalizedProgramType &&
    !VALID_PROGRAM_TYPES.has(normalizedProgramType)
  ) {
    res.status(400).json({ message: "Invalid programType filter" });
    return;
  }

  if (gradeLevelId) {
    const where: Record<string, any> = {
      gradeLevelId: parseInt(gradeLevelId as string),
    };
    if (normalizedProgramType) {
      where.programType = normalizedProgramType;
    }

    const sections = await prisma.section.findMany({
      where,
      include: {
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
            enrollmentRecords: {
              where: activeEnrollmentFilter,
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    });

    // Format teacher names
    const formatted = sections.map((s) => ({
      ...s,
      displayName: s.displayName ?? s.name,
      enrolledCount: s._count.enrollmentRecords,
      fillPercent:
        s.maxCapacity > 0
          ? Math.round((s._count.enrollmentRecords / s.maxCapacity) * 100)
          : 0,
      advisingTeacher: s.advisingTeacher
        ? {
            id: s.advisingTeacher.id,
            name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
          }
        : null,
    }));
    res.json({ sections: formatted });
    return;
  }

  if (!ayId) {
    res
      .status(400)
      .json({ message: "School Year ID or Grade Level ID is required" });
    return;
  }

  const whereClause: any = { schoolYearId: ayId };

  const gradeLevels = await prisma.gradeLevel.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      sections: {
        where: {
          schoolYearId: ayId,
          ...(normalizedProgramType
            ? { where: { programType: normalizedProgramType as any } }
            : {}),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        include: {
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
              enrollmentRecords: {
                where: activeEnrollmentFilter,
              },
            },
          },
        },
      },
    },
  });

  const result = gradeLevels.map((gl) => ({
    gradeLevelId: gl.id,
    gradeLevelName: gl.name,
    displayOrder: gl.displayOrder,
    sections: gl.sections.map((s) => {
      const count = s._count?.enrollmentRecords ?? 0;
      return {
        id: s.id,
        name: s.name,
        displayName: s.displayName ?? s.name,
        sortOrder: s.sortOrder,
        programType: s.programType,
        maxCapacity: s.maxCapacity,
        enrolledCount: count,
        fillPercent:
          s.maxCapacity > 0 ? Math.round((count / s.maxCapacity) * 100) : 0,
        advisingTeacher: s.advisingTeacher
          ? {
              id: s.advisingTeacher.id,
              name: `${s.advisingTeacher.lastName}, ${s.advisingTeacher.firstName}${s.advisingTeacher.middleName ? ` ${s.advisingTeacher.middleName.charAt(0)}.` : ""}`,
            }
          : null,
      };
    }),
  }));

  res.json({ gradeLevels: result });
}

export async function listTeachers(req: Request, res: Response): Promise<void> {
  const teachers = await prisma.teacher.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      employeeId: true,
    },
    orderBy: { lastName: "asc" },
  });
  // Format the name for display in dropdowns
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

  const normalizedDisplayName =
    typeof displayName === "string" && displayName.trim().length > 0
      ? displayName.trim()
      : normalizedName;

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

  const section = await prisma.section.create({
    data: {
      name: normalizedName,
      displayName: normalizedDisplayName,
      sortOrder: resolvedSortOrder,
      maxCapacity: maxCapacity ?? 40,
      gradeLevelId,
      schoolYearId,
      programType: normalizedProgramType as ApplicantType,
      advisingTeacherId: advisingTeacherId ?? null,
    },
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_CREATED",
    description: `Created section "${normalizedDisplayName}"`,
    subjectType: "Section",
    recordId: section.id,
    req,
  });

  res.status(201).json({ section });
}

export async function updateSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);
  const {
    name,
    displayName,
    sortOrder,
    maxCapacity,
    programType,
    advisingTeacherId,
  } = req.body;

  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  const normalizedName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
  const normalizedDisplayName =
    typeof displayName === "string"
      ? displayName.trim()
      : displayName === null
        ? null
        : undefined;

  const shouldSyncDisplayNameFromName =
    normalizedName !== null &&
    normalizedDisplayName === undefined &&
    (section.displayName == null || section.displayName === section.name);

  const data: Record<string, unknown> = {
    ...(normalizedName ? { name: normalizedName } : {}),
    ...(maxCapacity !== undefined ? { maxCapacity } : {}),
    ...(programType !== undefined ? { programType } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(advisingTeacherId !== undefined
      ? { advisingTeacherId: advisingTeacherId || null }
      : {}),
  };

  if (normalizedDisplayName !== undefined) {
    data.displayName = normalizedDisplayName || null;
  } else if (shouldSyncDisplayNameFromName && normalizedName) {
    data.displayName = normalizedName;
  }

  const updated = await prisma.section.update({
    where: { id },
    data,
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_UPDATED",
    description: `Updated section "${updated.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ section: updated });
}

export async function deleteSection(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);

  const section = await prisma.section.findUnique({
    where: { id },
    include: { _count: { select: { enrollmentRecords: true } } },
  });

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  if (section._count.enrollmentRecords > 0) {
    const learnerCount = section._count.enrollmentRecords;
    res.status(400).json({
      message: `Cannot delete section. Please un-enrol or transfer the ${learnerCount} learner${learnerCount === 1 ? "" : "s"} first.`,
    });
    return;
  }

  await prisma.section.delete({ where: { id } });

  await auditLog({
    userId: req.user!.userId,
    actionType: "SECTION_DELETED",
    description: `Deleted section "${section.name}"`,
    subjectType: "Section",
    recordId: id,
    req,
  });

  res.json({ message: "Section deleted" });
}

export async function getSectionRoster(
  req: Request,
  res: Response,
): Promise<void> {
  const id = parseInt(req.params.id as string);

  const section = await prisma.section.findUnique({
    where: { id },
    include: {
      schoolYear: {
        select: { classOpeningDate: true },
      },
      gradeLevel: true,
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

  const learners = section.enrollmentRecords.map((record) => ({
    id: record.enrollmentApplication.id,
    lrn: record.enrollmentApplication.learner.lrn,
    firstName: record.enrollmentApplication.learner.firstName,
    lastName: record.enrollmentApplication.learner.lastName,
    middleName: record.enrollmentApplication.learner.middleName,
    sex: record.enrollmentApplication.learner.sex,
    status: record.enrollmentApplication.status,
    birthdate: record.enrollmentApplication.learner.birthdate,
    learnerType: record.enrollmentApplication.learnerType,
    applicantType: record.enrollmentApplication.applicantType,
    dateSectioned: record.dateSectioned,
    sectioningMethod: record.sectioningMethod,
    sf1Remarks: record.sf1Remarks,
  }));

  res.json({
    sectionName: section.name,
    classOpeningDate: section.schoolYear.classOpeningDate,
    learners,
  });
}

export async function getUnsectionedPool(
  req: Request,
  res: Response,
): Promise<void> {
  const gradeLevelId = parseInt(req.params.gradeLevelId as string);
  const schoolYearId = req.query.schoolYearId
    ? parseInt(req.query.schoolYearId as string)
    : null;

  if (!schoolYearId) {
    res.status(400).json({ message: "schoolYearId is required" });
    return;
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      gradeLevelId,
      schoolYearId,
      status: "READY_FOR_SECTIONING",
    },
    include: {
      learner: true,
    },
    orderBy: [{ learner: { lastName: "asc" } }, { learner: { firstName: "asc" } }],
  });

  const pool = applications.map((app) => ({
    id: app.id,
    lrn: app.learner.lrn,
    firstName: app.learner.firstName,
    lastName: app.learner.lastName,
    middleName: app.learner.middleName,
    applicantType: app.applicantType,
    learnerType: app.learnerType,
  }));

  res.json({ pool });
}

export async function inlineSlotLearner(
  req: Request,
  res: Response,
): Promise<void> {
  const sectionId = parseInt(req.params.id as string);
  const { enrollmentApplicationId } = req.body;

  if (!enrollmentApplicationId) {
    res.status(400).json({ message: "enrollmentApplicationId is required" });
    return;
  }

  // 1. Fetch Section and Application
  const [section, app] = await Promise.all([
    prisma.section.findUnique({
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
    }),
    prisma.enrollmentApplication.findUnique({
      where: { id: enrollmentApplicationId },
      include: { learner: true },
    }),
  ]);

  if (!section) {
    res.status(404).json({ message: "Section not found" });
    return;
  }

  if (!app) {
    res.status(404).json({ message: "Enrollment application not found" });
    return;
  }

  // 2. Validate Capacity
  if (section._count.enrollmentRecords >= section.maxCapacity) {
    res.status(400).json({
      message: `Section ${section.name} has reached maximum capacity (${section.maxCapacity}).`,
    });
    return;
  }

  // 3. Validate Status
  if (app.status !== "READY_FOR_SECTIONING") {
    res.status(400).json({
      message: `Learner is not in "READY_FOR_SECTIONING" status. Current status: ${app.status}`,
    });
    return;
  }

  // 4. Constraint Guardrail: Program Type Match
  // Special Curricular Programs (SCP) like STE require exact matches.
  const isScpSection = section.programType !== "REGULAR";
  if (isScpSection && app.applicantType !== section.programType) {
    res.status(400).json({
      message: `Constraint Violation: Cannot slot a ${app.applicantType} learner into a ${section.programType} section.`,
    });
    return;
  }

  // 5. Execute Slotting in Transaction
  const record = await prisma.$transaction(async (tx) => {
    // A. Determine if this is a Late Enrollment based on School Year Status
    const sy = await tx.schoolYear.findUnique({
      where: { id: app.schoolYearId },
      select: { status: true, classOpeningDate: true },
    });

    const isLateEnrollment = sy?.status === "BOSY_LOCKED" || sy?.status === "EOSY_PROCESSING" || sy?.status === "ACTIVE";
    let sf1Remarks = null;

    if (isLateEnrollment) {
      const today = new Date();
      const formattedDate = today.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      sf1Remarks = `Late Enrollee (Date of First Attendance: ${formattedDate})`;
    }

    // B. Create Enrollment Record
    const newRecord = await tx.enrollmentRecord.create({
      data: {
        enrollmentApplicationId: app.id,
        sectionId: section.id,
        schoolYearId: app.schoolYearId,
        enrolledById: req.user!.userId,
        sectioningMethod: "INLINE_SLOTTING",
        dateSectioned: new Date(),
        sf1Remarks,
      },
    });

    // C. Update Application Status and Type
    await tx.enrollmentApplication.update({
      where: { id: app.id },
      data: { 
        status: "ENROLLED",
        applicantType: isLateEnrollment ? "LATE_ENROLLEE" : app.applicantType,
      },
    });

    // D. Queue S.M.A.R.T. Sync Event
    // Payload as per blueprint Phase 4.1
    const syncPayload = {
      event: isLateEnrollment ? "LATE_ENROLLEE_ADDED" : "ENROLLEE_ADDED",
      lrn: app.learner.lrn,
      section_id: section.id,
      adviser_id: section.advisingTeacherId,
      timestamp: new Date().toISOString(),
      is_late: isLateEnrollment,
    };

    await tx.atlasSyncEvent.create({
      data: {
        eventId: crypto.randomUUID(),
        eventType: "SMART_GRADING_SYNC",
        schoolYearId: app.schoolYearId,
        payload: syncPayload,
        requestUrl: `${process.env.SMART_API_BASE_URL || "http://100.93.66.120:3000"}/api/sync/late-enrollee`,
        status: "PENDING",
      },
    });

    return newRecord;
  });

  await auditLog({
    userId: req.user!.userId,
    actionType: "INLINE_SLOTTING",
    description: `Manually slotted learner ${app.learner.lastName}, ${app.learner.firstName} (LRN: ${app.learner.lrn}) into section ${section.name}`,
    subjectType: "Section",
    recordId: section.id,
    req,
  });

  res.status(201).json({
    message: "Learner successfully slotted and synced to grading system.",
    record,
  });
}
