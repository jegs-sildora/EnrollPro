import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { EosyStatus } from "../../generated/prisma/index.js";
import type {
  ApplicantType,
  Prisma,
} from "../../generated/prisma/index.js";
import { addEosyClient, broadcastEosyUpdate } from "./eosy-events.service.js";
import {
  broadcastEosyInvalidation,
  broadcastSchoolYearInvalidation,
} from "../../lib/realtime-events.js";
import {
  buildSf5Payload,
  buildSf6Payload,
  getSchoolFormArtifactStatus,
  recordSchoolFormArtifact,
} from "./services/school-form-artifact.service.js";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).replace(/\r?\n|\r/g, " ");
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toDateOnly(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function asJsonObject(
  value: Prisma.JsonValue | null,
): Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

/**
 * Maps an internal EosyStatus value to the DepEd-canonical SF5 "Remarks"
 * label. IRREGULAR is an internal state for conditionally promoted learners
 * pending remedial resolution — DepEd SF5 only recognises four outcomes.
 */
function toSf5Remarks(status: EosyStatus | null): string {
  switch (status) {
    case "PROMOTED":
      return "Promoted";
    case "RETAINED":
    case "CONDITIONALLY_PROMOTED":
      return "Not Promoted";
    case "TRANSFERRED_OUT":
      return "Transferred Out";
    case "DROPPED_OUT":
      return "Dropped Out";
    default:
      return "";
  }
}

function normalizeAcademicDeficiencyNote(
  eosyStatus: EosyStatus | null | undefined,
  note: unknown,
): string | null {
  if (eosyStatus !== "CONDITIONALLY_PROMOTED") {
    return null
  }

  if (typeof note !== "string") {
    return null
  }

  const trimmed = note.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function getSchoolYearExportLockState(schoolYearId: number) {
  const [schoolYear, sections] = await Promise.all([
    prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, yearLabel: true, isEosyFinalized: true },
    }),
    prisma.section.findMany({
      where: {
        schoolYearId,
      },
      select: { id: true, isEosyFinalized: true },
    }),
  ]);

  if (!schoolYear) {
    throw new AppError(404, "School year not found.");
  }

  const totalSections = sections.length;
  const finalizedSections = sections.filter(
    (section) => section.isEosyFinalized,
  ).length;
  const sf5Statuses = await Promise.all(
    sections.map((section) =>
      getSchoolFormArtifactStatus(
        "SF5",
        schoolYearId,
        section.id,
      ),
    ),
  );
  const sf6Status = await getSchoolFormArtifactStatus(
    "SF6",
    schoolYearId,
    null,
  );
  const currentSf5Count = sf5Statuses.filter(
    (status) => status.current,
  ).length;
  const schoolYearFinalized = schoolYear.isEosyFinalized;
  const canFinalizeSchoolYear =
    totalSections > 0 &&
    finalizedSections === totalSections &&
    currentSf5Count === totalSections &&
    sf6Status.current &&
    !schoolYearFinalized;

  let lockReason: string | null = null;
  if (schoolYearFinalized) {
    lockReason = `School year ${schoolYear.yearLabel} EOSY is permanently finalized and archived. Class reopening and status updates are globally locked.`;
  } else if (totalSections === 0) {
    lockReason =
      "No sections found for this school year. Add sections before school-level finalization.";
  } else if (!canFinalizeSchoolYear) {
    const blockers = [
      totalSections - finalizedSections > 0
        ? `${totalSections - finalizedSections} class(es) still need EOSY finalization`
        : null,
      totalSections - currentSf5Count > 0
        ? `${totalSections - currentSf5Count} class(es) need a current SF5 record`
        : null,
      !sf6Status.current ? "the school needs a current SF6 record" : null,
    ].filter((blocker): blocker is string => Boolean(blocker));
    lockReason = blockers.join(", ");
  }

  return {
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.yearLabel,
    schoolYearFinalized,
    totalSections,
    finalizedSections,
    currentSf5Count,
    sf6Recorded: sf6Status.recorded,
    sf6Current: sf6Status.current,
    sf5Statuses,
    canFinalizeSchoolYear,
    lockReason,
  };
}

type EosySectionPayload = Prisma.SectionGetPayload<{
  include: {
    gradeLevel: true;
    _count: { select: { enrollmentRecords: true } };
    advisers: {
      include: { teacher: true };
    };
  };
}>;

interface EosyLearnerPayload {
  id: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  sex?: string | null;
}

interface EosyRecordPayload {
  id: number;
  eosyStatus: EosyStatus | null;
  academicDeficiencyNote: string | null;
  dropOutReason: string | null;
  finalAverage: number | null;
  nextYearCurriculum: string | null;
  transferOutDate: Date | null;
  sectionId: number;
  section: {
    id: number;
    name: string;
    isEosyFinalized: boolean;
    programType: string;
    isHomogeneous: boolean;
  };
  enrollmentApplication: {
    id: number;
    trackingNumber: string;
    applicantType: string;
    reportedGrades: Prisma.JsonValue | null;
    learner: EosyLearnerPayload;
  };
  isScpDemoted: boolean;
  scpViolation: {
    subject: string;
    term: string;
    actualGrade: number;
    requiredGrade: number;
    violationType: string;
  } | null;
}

async function loadEosySections(schoolYearId: number): Promise<EosySectionPayload[]> {
  return prisma.section.findMany({
    where: {
      schoolYearId,
    },
    include: {
      gradeLevel: true,
      _count: {
        select: { enrollmentRecords: true },
      },
      advisers: {
        where: { status: "ACTIVE" },
        include: {
          teacher: true,
        },
        take: 1,
      },
    },
    orderBy: [
      { gradeLevel: { displayOrder: "asc" } },
      { name: "asc" },
    ],
  });
}

function getEosyGradeLevels(sections: EosySectionPayload[]) {
  const gradeMap = new Map<number, EosySectionPayload["gradeLevel"]>();
  for (const section of sections) {
    if (!gradeMap.has(section.gradeLevelId)) {
      gradeMap.set(section.gradeLevelId, section.gradeLevel);
    }
  }

  return Array.from(gradeMap.values()).sort(
    (a, b) => (a.displayOrder ?? 99) - (b.displayOrder ?? 99),
  );
}

function buildScpMetadata(
  programType: string | null | undefined,
  nextYearCurriculum: string | null | undefined,
  finalAverage: number | null,
) {
  const isScp = Boolean(programType && programType !== "REGULAR");
  const isScpDemoted = nextYearCurriculum === "REGULAR" && isScp;

  let scpViolation: EosyRecordPayload["scpViolation"] = null;
  if (isScp && finalAverage !== null && finalAverage < 85) {
    if (finalAverage < 80) {
      scpViolation = {
        subject: "MAPEH",
        term: "Quarter 2",
        actualGrade: Math.floor(finalAverage),
        requiredGrade: 80,
        violationType: "Quarterly Minimum",
      };
    } else if (finalAverage < 83) {
      scpViolation = {
        subject: "Araling Panlipunan",
        term: "Final Grade",
        actualGrade: finalAverage,
        requiredGrade: 83,
        violationType: "Subject Final Minimum",
      };
    } else {
      scpViolation = {
        subject: "Science",
        term: "Final Grade",
        actualGrade: finalAverage,
        requiredGrade: 85,
        violationType: "Core Subject Minimum",
      };
    }
  }

  return { isScpDemoted, scpViolation };
}

async function loadEosyGradeRecords(
  schoolYearId: number,
  gradeLevelId: number,
): Promise<EosyRecordPayload[]> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { status: true },
  });

  if (schoolYear?.status === "ARCHIVED") {
    const historyRecords = await prisma.enrollmentHistory.findMany({
      where: {
        schoolYearId,
        gradeLevelId,
      },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            isEosyFinalized: true,
            programType: true,
            isHomogeneous: true,
          },
        },
        learner: true,
      },
      orderBy: [
        { section: { name: "asc" } },
        { learner: { lastName: "asc" } },
        { learner: { firstName: "asc" } },
      ],
    });

    return historyRecords.map((record) => {
      const finalAverage =
        record.genAve !== null && record.genAve !== undefined
          ? Number(record.genAve)
          : null;
      const section = record.section ?? {
        id: record.sectionId ?? 0,
        name: "No Section",
        isEosyFinalized: true,
        programType: "REGULAR",
        isHomogeneous: false,
      };
      const scpMetadata = buildScpMetadata(
        section.programType,
        null,
        finalAverage,
      );

      return {
        id: record.id,
        eosyStatus: record.eosyStatus,
        academicDeficiencyNote: record.academicDeficiencyNote,
        dropOutReason: null,
        finalAverage,
        nextYearCurriculum: null,
        transferOutDate: null,
        sectionId: section.id,
        section,
        enrollmentApplication: {
          id: 0,
          trackingNumber: "",
          applicantType: "REGULAR",
          reportedGrades: null,
          learner: {
            id: record.learner.id,
            lrn: record.learner.lrn,
            firstName: record.learner.firstName,
            lastName: record.learner.lastName,
            sex: record.learner.sex,
          },
        },
        ...scpMetadata,
      };
    });
  }

  const records = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId,
      section: {
        gradeLevelId,
      },
    },
    include: {
      section: {
        select: {
          id: true,
          name: true,
          isEosyFinalized: true,
          programType: true,
          isHomogeneous: true,
        },
      },
      enrollmentApplication: {
        select: {
          id: true,
          trackingNumber: true,
          applicantType: true,
          reportedGrades: true,
          learner: {
            select: {
              id: true,
              lrn: true,
              firstName: true,
              lastName: true,
              sex: true,
            },
          },
        },
      },
    },
    orderBy: [
      { section: { name: "asc" } },
      {
        enrollmentApplication: {
          learner: { lastName: "asc" },
        },
      },
      {
        enrollmentApplication: {
          learner: { firstName: "asc" },
        },
      },
    ],
  });

  return records.map((record) => {
    const finalAverage =
      record.finalAverage !== null && record.finalAverage !== undefined
        ? Number(record.finalAverage)
        : null;
    const scpMetadata = buildScpMetadata(
      record.section.programType,
      record.nextYearCurriculum,
      finalAverage,
    );

    return {
      id: record.id,
      eosyStatus: record.eosyStatus,
      academicDeficiencyNote: record.academicDeficiencyNote,
      dropOutReason: record.dropOutReason,
      finalAverage,
      nextYearCurriculum: record.nextYearCurriculum,
      transferOutDate: record.transferOutDate,
      sectionId: record.sectionId,
      section: record.section,
      enrollmentApplication: {
        ...record.enrollmentApplication,
        trackingNumber: record.enrollmentApplication.trackingNumber ?? "",
      },
      ...scpMetadata,
    };
  });
}

export async function getEosySections(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { schoolYearId } = req.query;
    const sections = await loadEosySections(parseInt(String(schoolYearId)));
    res.json({ sections });
  } catch (error) {
    next(error);
  }
}

export async function getEosyWorkspace(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const schoolYearId = req.query.schoolYearId
      ? parseInt(String(req.query.schoolYearId), 10)
      : NaN;

    if (!Number.isInteger(schoolYearId)) {
      throw new AppError(400, "schoolYearId query parameter is required.");
    }

    const requestedGradeLevelId = req.query.gradeLevelId
      ? parseInt(String(req.query.gradeLevelId), 10)
      : null;

    const [sections, exportLock] = await Promise.all([
      loadEosySections(schoolYearId),
      getSchoolYearExportLockState(schoolYearId),
    ]);

    const gradeLevels = getEosyGradeLevels(sections);
    const activeGradeLevelId =
      requestedGradeLevelId ??
      gradeLevels[0]?.id ??
      null;
    const records = activeGradeLevelId
      ? await loadEosyGradeRecords(schoolYearId, activeGradeLevelId)
      : [];

    res.json({
      gradeLevels,
      sections,
      activeGradeLevelId,
      records,
      exportLock,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSectionRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);
    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      include: {
        enrollmentApplication: {
          include: {
            learner: true,
            gradeLevel: true,
            previousSchool: true,
          },
        },
      },
      orderBy: [
        {
          enrollmentApplication: {
            learner: {
              sex: "asc",
            },
          },
        },
        {
          enrollmentApplication: {
            learner: {
              lastName: "asc",
            },
          },
        },
        {
          enrollmentApplication: {
            learner: {
              firstName: "asc",
            },
          },
        },
      ],
    });

    // Return records with their real finalAverage from the current year
    const mappedRecords = records.map((record) => {
      return {
        ...record,
        // Ensure finalAverage is correctly typed as number or null
        finalAverage:
          record.finalAverage !== null && record.finalAverage !== undefined
            ? parseFloat(String(record.finalAverage))
            : null,
      };
    });

    res.json({ records: mappedRecords });
  } catch (error) {
    next(error);
  }
}

export async function updateEosyRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const recordId = parseInt(String(id), 10);
    const {
      eosyStatus,
      dropOutReason,
      transferOutDate,
      finalAverage,
      academicDeficiencyNote,
    } =
      req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: recordId },
      include: {
        enrollmentApplication: {
          select: { applicantType: true }
        },
        section: {
          include: {
            schoolYear: {
              select: {
                isEosyFinalized: true,
              },
            },
          },
        },
      },
    });

    if (!record) throw new AppError(404, "Enrollment record not found.");
    if (record.section?.schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update status. School year EOSY is finalized and export lock is active.",
      );
    }
    if (record.section?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update status. Section is already finalized.",
      );
    }

    const ave = finalAverage !== undefined ? parseFloat(String(finalAverage)) : record.finalAverage !== null ? parseFloat(String(record.finalAverage)) : null;
    const isScp = record.section?.programType && record.section.programType !== "REGULAR";

    let targetStatus = eosyStatus;
    let nextYearCurriculum: ApplicantType | undefined;

    if (ave === 0 || ave === null || isNaN(ave)) {
      if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC" || targetStatus === "RETAINED" || targetStatus === "CONDITIONALLY_PROMOTED") {
        throw new AppError(400, "Learner with 0.00 or blank Final Average cannot be assigned an academic evaluation status. Must be DROPPED OUT or TRANSFERRED OUT.");
      }
    } else if (ave < 75) {
      if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC") {
         throw new AppError(400, "Learner with Final Average below 75 cannot be promoted.");
      }
      targetStatus = "RETAINED";
      if (isScp) {
        nextYearCurriculum = "REGULAR";
      }
    } else if (isScp && ave < 85) {
      if (targetStatus === "PROMOTED") {
        throw new AppError(400, "Cannot assign standard Promoted status. SCP learners failing to meet the retention policy must be assigned 'Promoted (To BEC)'.");
      }
      targetStatus = "PROMOTED";
      nextYearCurriculum = "REGULAR";
    }

    if (targetStatus === "PROMOTED_TO_BEC") {
      targetStatus = "PROMOTED";
      nextYearCurriculum = "REGULAR";
    }

    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        eosyStatus: targetStatus as EosyStatus,
        academicDeficiencyNote: normalizeAcademicDeficiencyNote(
          targetStatus as EosyStatus,
          academicDeficiencyNote,
        ),
        nextYearCurriculum: nextYearCurriculum !== undefined ? nextYearCurriculum : undefined,
        dropOutReason: targetStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          targetStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage: ave !== null ? ave : undefined,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EOSY_STATUS_UPDATED",
      description: `Updated EOSY status for Learner ID ${record.learnerId}`,
      subjectType: "EnrollmentRecord",
      recordId: recordId,
      oldValue: record.eosyStatus || "PENDING",
      newValue: eosyStatus,
      req,
    });

    broadcastEosyInvalidation(updated.schoolYearId, [updated.sectionId], [updated.learnerId]);

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/eosy/batch-update
 * Body: { sectionId: number, updates: { recordId: number, status: EosyStatus }[] }
 */
export async function batchUpdateEosyRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { sectionId, updates } = req.body;

    if (!sectionId || !Array.isArray(updates)) {
      throw new AppError(400, "Invalid payload. sectionId and updates array required.");
    }

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { schoolYear: { select: { isEosyFinalized: true } } },
    });

    if (!section) throw new AppError(404, "Section not found.");
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(422, "Cannot update statuses. School year EOSY is finalized.");
    }
    if (section.isEosyFinalized) {
      throw new AppError(403, `Section '${section.name}' is finalized and locked for EOSY updates.`);
    }

    const result = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const update of updates) {
        const current = await tx.enrollmentRecord.findUnique({
          where: { id: update.recordId },
          select: { eosyStatus: true, learner: { select: { firstName: true, lastName: true } } },
        });

        if (!current) continue;

        await tx.enrollmentRecord.update({
          where: { id: update.recordId },
          data: {
            eosyStatus: update.status as EosyStatus,
            academicDeficiencyNote: normalizeAcademicDeficiencyNote(
              update.status as EosyStatus,
              "academicDeficiencyNote" in update
                ? update.academicDeficiencyNote
                : null,
            ),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            actionType: "EOSY_STATUS_BATCH_UPDATE",
            description: `Updated EOSY status for ${current.learner.lastName}, ${current.learner.firstName}`,
            subjectType: "EnrollmentRecord",
            recordId: update.recordId,
            oldValue: current.eosyStatus || "PENDING",
            newValue: update.status,
            ipAddress: req.ip ?? "0.0.0.0",
            userAgent: (req.headers["user-agent"] as string) ?? null,
            metadata: { sectionId, sectionName: section.name },
          },
        });

        count++;
      }

      return { count, sectionName: section.name };
    });

    broadcastEosyInvalidation(section.schoolYearId, [section.id]);

    res.json({
      message: `Successfully processed ${result.count} updates for ${result.sectionName}.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function finalizeSection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        gradeLevel: true,
        schoolYear: {
          select: {
            isEosyFinalized: true,
          },
        },
      },
    });

    if (!section) {
      throw new AppError(404, "Section not found.");
    }
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot finalize class. School year EOSY is already finalized.",
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: true },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_FINALIZED",
      description: `Finalized EOSY for section ${updated.name}`,
      subjectType: "Section",
      recordId: sectionId,
      oldValue: "false",
      newValue: "true",
      req,
    });

    broadcastEosyInvalidation(updated.schoolYearId, [updated.id]);

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function reopenSection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        schoolYear: {
          select: {
            isEosyFinalized: true,
          },
        },
      },
    });

    if (!section) {
      throw new AppError(404, "Section not found.");
    }
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot reopen class. School year EOSY is finalized and export lock is active.",
      );
    }

    const updated = await prisma.section.update({
      where: { id: sectionId },
      data: { isEosyFinalized: false },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SECTION_REOPENED",
      description: `Re-opened EOSY for section ${updated.name}`,
      subjectType: "Section",
      recordId: sectionId,
      oldValue: "true",
      newValue: "false",
      req,
    });

    broadcastEosyInvalidation(updated.schoolYearId, [updated.id]);

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function getSchoolYearExportLock(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const syId = parseInt(String(req.params.schoolYearId), 10);
    if (!Number.isInteger(syId)) {
      throw new AppError(400, "A valid schoolYearId is required.");
    }

    const state = await getSchoolYearExportLockState(syId);
    res.json(state);
  } catch (error) {
    next(error);
  }
}

export async function unlockSchoolYearEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { schoolYearId, pin, justification } = req.body;
    const requestedSchoolYearId = Number.isInteger(parseInt(String(schoolYearId)))
      ? parseInt(String(schoolYearId))
      : null;

    // Security PIN and justification removed per request.
    // Always target the latest archived/finalized school year for emergency unlock.
    // This prevents stale client state from unlocking an older school year.
    const schoolYear = await prisma.schoolYear.findFirst({
      where: {
        status: "ARCHIVED",
        isEosyFinalized: true,
      },
      orderBy: {
        id: "desc",
      },
      select: { id: true, yearLabel: true, isEosyFinalized: true },
    });

    if (!schoolYear) {
      throw new AppError(
        404,
        "No archived/finalized school year found to unlock.",
      );
    }

    if (!schoolYear.isEosyFinalized) {
      throw new AppError(400, "School year is not finalized.");
    }

    const updated = await prisma.schoolYear.update({
      where: { id: schoolYear.id },
      data: {
        isEosyFinalized: false,
        status: "ACTIVE", // Revert to ACTIVE so teachers can correct records
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "SCHOOL_YEAR_EMERGENCY_UNLOCK",
      description: `Admin triggered EMERGENCY EOSY UNLOCK for latest archived S.Y. ${updated.yearLabel}${requestedSchoolYearId && requestedSchoolYearId !== updated.id ? ` (requested ${requestedSchoolYearId}, system applied ${updated.id})` : ""}. Justification: ${justification}`,
      subjectType: "SchoolYear",
      recordId: updated.id,
      req,
    });

    const state = await getSchoolYearExportLockState(updated.id);
    broadcastEosyInvalidation(updated.id);
    broadcastSchoolYearInvalidation(updated.id);
    res.json({ schoolYear: updated, exportLock: state });
  } catch (error) {
    next(error);
  }
}

export async function downloadFinalLisExport(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const syId = parseInt(String(req.params.schoolYearId), 10);
    if (!Number.isInteger(syId)) {
      throw new AppError(400, "A valid schoolYearId is required.");
    }

    const exportState = await getSchoolYearExportLockState(syId);
    if (!exportState.schoolYearFinalized) {
      throw new AppError(
        422,
        "Cannot download final LIS export until school EOSY is finalized.",
      );
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: {
        section: {
          schoolYearId: syId,
        },
      },
      include: {
        section: {
          select: {
            name: true,
            gradeLevel: {
              select: {
                name: true,
                displayOrder: true,
              },
            },
          },
        },
        enrollmentApplication: {
          select: {
            trackingNumber: true,
            status: true,
            learnerType: true,
            applicantType: true,
            learner: {
              select: {
                lrn: true,
                lastName: true,
                firstName: true,
                middleName: true,
                extensionName: true,
                sex: true,
                birthdate: true,
              },
            },
          },
        },
      },
    });

    const sortedRecords = records.sort((a, b) => {
      const gradeA = a.section.gradeLevel.displayOrder ?? 999;
      const gradeB = b.section.gradeLevel.displayOrder ?? 999;
      if (gradeA !== gradeB) return gradeA - gradeB;

      const sectionCompare = a.section.name.localeCompare(
        b.section.name,
        "en",
        {
          sensitivity: "base",
        },
      );
      if (sectionCompare !== 0) return sectionCompare;

      const lastNameCompare =
        a.enrollmentApplication.learner.lastName.localeCompare(
          b.enrollmentApplication.learner.lastName,
          "en",
          { sensitivity: "base" },
        );
      if (lastNameCompare !== 0) return lastNameCompare;

      return a.enrollmentApplication.learner.firstName.localeCompare(
        b.enrollmentApplication.learner.firstName,
        "en",
        { sensitivity: "base" },
      );
    });

    const headers = [
      "LRN",
      "LAST_NAME",
      "FIRST_NAME",
      "MIDDLE_NAME",
      "EXTENSION_NAME",
      "SEX",
      "BIRTHDATE",
      "GRADE_LEVEL",
      "SECTION",
      "FINAL_AVERAGE",
      "EOSY_STATUS",
      "DROPOUT_REASON",
      "TRANSFER_OUT_DATE",
      "PROGRAM_TYPE",
      "LEARNER_TYPE",
      "APPLICATION_STATUS",
      "TRACKING_NUMBER",
    ];

    const rows = sortedRecords.map((record) => [
      record.enrollmentApplication.learner.lrn,
      record.enrollmentApplication.learner.lastName,
      record.enrollmentApplication.learner.firstName,
      record.enrollmentApplication.learner.middleName,
      record.enrollmentApplication.learner.extensionName,
      record.enrollmentApplication.learner.sex,
      toDateOnly(record.enrollmentApplication.learner.birthdate),
      record.section.gradeLevel.name,
      record.section.name,
      record.finalAverage?.toFixed(2) || "0.00",
      record.eosyStatus ?? "PROMOTED",
      record.dropOutReason,
      toDateOnly(record.transferOutDate),
      record.enrollmentApplication.applicantType,
      record.enrollmentApplication.learnerType,
      record.enrollmentApplication.status,
      record.enrollmentApplication.trackingNumber,
    ]);

    const csvBody = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");

    const safeLabel = exportState.schoolYearLabel.replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="final-lis-export-${safeLabel}.csv"`,
    );

    res.status(200).send(`\uFEFF${csvBody}`);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/eosy/sections/:id/forms/sf5/record
 * Records an immutable SF5 payload for rollover readiness.
 */
export async function recordSF5(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      throw new AppError(400, "A valid section id is required.");
    }
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        schoolYearId: true,
        isEosyFinalized: true,
      },
    });
    if (!section) {
      throw new AppError(404, "Section not found.");
    }
    if (!section.isEosyFinalized) {
      throw new AppError(
        422,
        "Finalize this class before recording its official SF5.",
      );
    }

    const artifact = await recordSchoolFormArtifact({
      formType: "SF5",
      schoolYearId: section.schoolYearId,
      sectionId,
      recordedById: req.user!.userId,
    });
    await auditLog({
      userId: req.user!.userId,
      actionType: "SF5_RECORDED",
      description: `Recorded official SF5 version ${artifact.version} for section ${sectionId}.`,
      subjectType: "Section",
      recordId: sectionId,
      req,
    });
    broadcastEosyInvalidation(section.schoolYearId, [sectionId]);
    res.status(201).json(artifact);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/eosy/school-years/:schoolYearId/forms/sf6/record
 * Records an immutable school-wide SF6 payload for rollover readiness.
 */
export async function recordSF6(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = Number.parseInt(
      String(req.params.schoolYearId),
      10,
    );
    if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) {
      throw new AppError(400, "A valid school year id is required.");
    }
    const unfinishedSections = await prisma.section.count({
      where: {
        schoolYearId,
        isEosyFinalized: false,
      },
    });
    if (unfinishedSections > 0) {
      throw new AppError(
        422,
        `Finalize the remaining ${unfinishedSections} class(es) before recording SF6.`,
      );
    }

    const artifact = await recordSchoolFormArtifact({
      formType: "SF6",
      schoolYearId,
      recordedById: req.user!.userId,
    });
    await auditLog({
      userId: req.user!.userId,
      actionType: "SF6_RECORDED",
      description: `Recorded official SF6 version ${artifact.version} for school year ${schoolYearId}.`,
      subjectType: "SchoolYear",
      recordId: schoolYearId,
      req,
    });
    broadcastEosyInvalidation(schoolYearId);
    res.status(201).json(artifact);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/eosy/sections/:id/exports/sf5
 * School Form 5 — Section-scoped learner promotion and proficiency report (JSON).
 * Includes section metadata and per-learner EOSY outcome data.
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function exportSF5(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sectionId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isFinite(sectionId) || sectionId <= 0) {
      res.status(400).json({ message: "Invalid section id." });
      return;
    }

    const payload = await buildSf5Payload(sectionId);
    res.json(payload);
    return;

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        gradeLevel: { select: { id: true, name: true } },
        schoolYear: { select: { id: true, yearLabel: true } },
        advisers: {
          where: { status: "ACTIVE" },
          include: {
            teacher: { select: { firstName: true, lastName: true } },
          },
          take: 1,
        },
      },
    });

    if (!section) {
      res.status(404).json({ message: "Section not found." });
      return;
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      orderBy: [
        { enrollmentApplication: { learner: { lastName: "asc" } } },
        { enrollmentApplication: { learner: { firstName: "asc" } } },
      ],
      include: {
        enrollmentApplication: {
          include: {
            learner: {
              select: {
                id: true,
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
    });

    const adviser = section!.advisers[0]?.teacher ?? null;

    res.json({
      generatedAt: new Date().toISOString(),
      section: {
        id: section!.id,
        name: section!.name,
        gradeLevel: section!.gradeLevel,
        schoolYear: section!.schoolYear,
        adviser: adviser
          ? { firstName: adviser.firstName, lastName: adviser.lastName }
          : null,
        isEosyFinalized: section!.isEosyFinalized,
      },
      totalLearners: records.length,
      learners: records.map((r, idx) => ({
        no: idx + 1,
        learnerId: r.learnerId,
        lrn: r.enrollmentApplication.learner.lrn,
        lastName: r.enrollmentApplication.learner.lastName,
        firstName: r.enrollmentApplication.learner.firstName,
        middleName: r.enrollmentApplication.learner.middleName,
        extensionName: r.enrollmentApplication.learner.extensionName,
        sex: r.enrollmentApplication.learner.sex,
        birthdate: toDateOnly(r.enrollmentApplication.learner.birthdate),
        finalAverage:
          r.finalAverage !== null
            ? parseFloat(r.finalAverage.toFixed(2))
            : null,
        eosyStatus: r.eosyStatus ?? null,
        // SF5 "Remarks" column uses DepEd-canonical labels only.
        // IRREGULAR is an internal status meaning conditionally promoted /
        // pending remedial — it maps to "Not Promoted" on the official form.
        sf5Remarks: toSf5Remarks(r.eosyStatus ?? null),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/eosy/exports/sf6
 * School Form 6 — School-wide enrollment summary by grade level (JSON).
 * Rows: per-grade counts for initial enrollment, transfer-in, transfer-out,
 *       drop-out, promoted, retained, and totals by sex.
 * Query params: schoolYearId (required)
 * Roles: HEAD_REGISTRAR, SYSTEM_ADMIN
 */
export async function exportSF6(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolYearId = Number.parseInt(String(req.query.schoolYearId ?? ""), 10);
    if (!Number.isFinite(schoolYearId) || schoolYearId <= 0) {
      res.status(400).json({ message: "schoolYearId query param is required." });
      return;
    }

    const payload = await buildSf6Payload(schoolYearId);
    res.json(payload);
    return;

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: { id: true, yearLabel: true },
    });
    if (!schoolYear) {
      res.status(404).json({ message: "School year not found." });
      return;
    }

    // Fetch all enrollment records for this school year with gradeLevel + sex + eosyStatus
    const records = await prisma.enrollmentRecord.findMany({
      where: { schoolYearId },
      include: {
        enrollmentApplication: {
          include: {
            learner: { select: { sex: true } },
            gradeLevel: { select: { id: true, name: true, displayOrder: true } },
          },
        },
      },
    });

    // Group by gradeLevel
    const gradeMap = new Map<
      number,
      {
        gradeId: number;
        gradeName: string;
        displayOrder: number | null;
        male: number;
        female: number;
        promoted: { male: number; female: number };
        retained: { male: number; female: number };
        dropOut: { male: number; female: number };
        transferOut: { male: number; female: number };
        irregular: { male: number; female: number };
        noStatus: { male: number; female: number };
      }
    >();

    for (const record of records) {
      const gl = record.enrollmentApplication.gradeLevel;
      if (!gradeMap.has(gl.id)) {
        gradeMap.set(gl.id, {
          gradeId: gl.id,
          gradeName: gl.name,
          displayOrder: gl.displayOrder ?? null,
          male: 0,
          female: 0,
          promoted: { male: 0, female: 0 },
          retained: { male: 0, female: 0 },
          dropOut: { male: 0, female: 0 },
          transferOut: { male: 0, female: 0 },
          irregular: { male: 0, female: 0 },
          noStatus: { male: 0, female: 0 },
        });
      }

      const row = gradeMap.get(gl.id)!;
      const isMale = record.enrollmentApplication.learner.sex === "MALE";
      const sexKey = isMale ? "male" : "female";

      if (isMale) row.male += 1;
      else row.female += 1;

      switch (record.eosyStatus) {
        case "PROMOTED":
          row.promoted[sexKey] += 1;
          break;
        case "RETAINED":
          row.retained[sexKey] += 1;
          break;
        case "DROPPED_OUT":
          row.dropOut[sexKey] += 1;
          break;
        case "TRANSFERRED_OUT":
          row.transferOut[sexKey] += 1;
          break;
        case "CONDITIONALLY_PROMOTED":
          row.irregular[sexKey] += 1;
          break;
        default:
          row.noStatus[sexKey] += 1;
      }
    }

    const rows = Array.from(gradeMap.values())
      .sort(
        (a, b) =>
          (a.displayOrder ?? 999) - (b.displayOrder ?? 999) ||
          a.gradeName.localeCompare(b.gradeName),
      )
      .map((row) => ({
        gradeId: row.gradeId,
        gradeName: row.gradeName,
        initialEnrollment: { male: row.male, female: row.female, total: row.male + row.female },
        promoted: { ...row.promoted, total: row.promoted.male + row.promoted.female },
        retained: { ...row.retained, total: row.retained.male + row.retained.female },
        dropOut: { ...row.dropOut, total: row.dropOut.male + row.dropOut.female },
        transferOut: { ...row.transferOut, total: row.transferOut.male + row.transferOut.female },
        irregular: { ...row.irregular, total: row.irregular.male + row.irregular.female },
        noStatus: { ...row.noStatus, total: row.noStatus.male + row.noStatus.female },
      }));

    const grandTotal = rows.reduce(
      (acc, r) => {
        acc.male += r.initialEnrollment.male;
        acc.female += r.initialEnrollment.female;
        acc.total += r.initialEnrollment.total;
        acc.promoted += r.promoted.total;
        acc.retained += r.retained.total;
        acc.dropOut += r.dropOut.total;
        acc.transferOut += r.transferOut.total;
        return acc;
      },
      { male: 0, female: 0, total: 0, promoted: 0, retained: 0, dropOut: 0, transferOut: 0 },
    );

    res.json({
      generatedAt: new Date().toISOString(),
      schoolYear: {
        id: schoolYear!.id,
        yearLabel: schoolYear!.yearLabel,
      },
      rows,
      grandTotal,
    });
  } catch (error) {
    next(error);
  }
}

export async function getGradeRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId } = req.query;

    if (!schoolYearId) {
      throw new AppError(400, "schoolYearId query parameter is required.");
    }

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    const records = schoolYear?.status === "ARCHIVED"
      ? await (async () => {
      const historyRecords = await prisma.enrollmentHistory.findMany({
        where: {
          schoolYearId: syId,
          gradeLevelId: glId,
        },
        include: {
          section: {
            select: { id: true, name: true, isEosyFinalized: true, programType: true, isHomogeneous: true },
          },
          learner: true,
          gradeLevel: true,
        },
        orderBy: [
          { learner: { lastName: "asc" } },
          { learner: { firstName: "asc" } },
        ],
      });

      return historyRecords.map(h => ({
        ...h,
        finalAverage: h.genAve,
        nextYearCurriculum: null,
        enrollmentApplication: {
          learner: h.learner,
          gradeLevel: h.gradeLevel,
        }
      }));
    })()
      : await prisma.enrollmentRecord.findMany({
        where: {
          schoolYearId: syId,
          section: {
            gradeLevelId: glId,
          },
        },
        include: {
          section: {
            select: { id: true, name: true, isEosyFinalized: true, programType: true, isHomogeneous: true },
          },
          enrollmentApplication: {
            include: {
              learner: true,
              gradeLevel: true,
              previousSchool: true,
            },
          },
        },
        orderBy: [
          {
            enrollmentApplication: {
              learner: { lastName: "asc" },
            },
          },
          {
            enrollmentApplication: {
              learner: { firstName: "asc" },
            },
          },
        ],
      });

    const mappedRecords = records.map((record) => {
      const isScp = record.section?.programType && record.section.programType !== "REGULAR";
      const isScpDemoted = record.nextYearCurriculum === "REGULAR" && isScp;

      return {
        ...record,
        nextYearCurriculum: record.nextYearCurriculum,
        isScpDemoted,
        scpViolation: null,
        finalAverage:
          record.finalAverage !== null &&
          record.finalAverage !== undefined
            ? Number(record.finalAverage)
            : null,
      };
    });

    res.json({ records: mappedRecords });
  } catch (error) {
    next(error);
  }
}

export async function batchUpdateGradeRecords(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId, updates } = req.body;

    if (!schoolYearId || !Array.isArray(updates)) {
      throw new AppError(
        400,
        "Invalid payload. schoolYearId and updates array required.",
      );
    }

    // Check if any sections in this grade level are already finalized
    const finalizedSections = await prisma.section.findMany({
      where: {
        gradeLevelId: parseInt(String(gradeLevelId), 10),
        schoolYearId: parseInt(String(schoolYearId), 10),
        isEosyFinalized: true,
      },
    });

    if (finalizedSections.length > 0) {
      throw new AppError(
        422,
        "Cannot update statuses. One or more sections in this grade level are already finalized.",
      );
    }

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: parseInt(String(schoolYearId), 10) },
    });

    if (schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot update statuses. School year EOSY is finalized.",
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const update of updates) {
        const current = await tx.enrollmentRecord.findUnique({
          where: { id: update.recordId },
          select: {
            eosyStatus: true,
            finalAverage: true,
            learner: { select: { firstName: true, lastName: true } },
            section: { select: { programType: true } },
          },
        });

        if (!current) continue;

          const isScp = current.section.programType && current.section.programType !== "REGULAR";
          const ave = current.finalAverage !== null ? parseFloat(String(current.finalAverage)) : null;

        let targetStatus = update.status;
        const dataToUpdate: {
          eosyStatus?: EosyStatus
          nextYearCurriculum?: "REGULAR" | null
          academicDeficiencyNote?: string | null
        } = {};

        if (ave === 0 || ave === null || isNaN(ave!)) {
          if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC" || targetStatus === "RETAINED" || targetStatus === "CONDITIONALLY_PROMOTED") {
            throw new AppError(400, "Learner with 0.00 or blank Final Average cannot be assigned an academic evaluation status. Must be DROPPED OUT or TRANSFERRED OUT.");
          }
        } else if (ave! < 75) {
          if (targetStatus === "PROMOTED" || targetStatus === "PROMOTED_TO_BEC") {
             throw new AppError(400, `Cannot promote ${current.learner.lastName}, ${current.learner.firstName}. Final average is below 75.`);
          }
          targetStatus = "RETAINED";
          if (isScp) {
            dataToUpdate.nextYearCurriculum = "REGULAR";
          }
        } else if (isScp && ave! < 85) {
          if (targetStatus === "PROMOTED") {
            throw new AppError(400, "Cannot assign standard Promoted status. SCP learners failing to meet the retention policy must be assigned 'Promoted (To BEC)'.");
          }
          targetStatus = "PROMOTED";
          dataToUpdate.nextYearCurriculum = "REGULAR";
        }

        if (targetStatus === "PROMOTED_TO_BEC") {
          targetStatus = "PROMOTED";
          dataToUpdate.nextYearCurriculum = "REGULAR";
        }

        dataToUpdate.eosyStatus = targetStatus as EosyStatus;
        dataToUpdate.academicDeficiencyNote = normalizeAcademicDeficiencyNote(
          targetStatus as EosyStatus,
          "academicDeficiencyNote" in update
            ? update.academicDeficiencyNote
            : null,
        )

        await tx.enrollmentRecord.update({
          where: { id: update.recordId },
          data: dataToUpdate,
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.userId,
            actionType: "EOSY_STATUS_BATCH_UPDATE",
            description: `Updated EOSY status for ${current.learner.lastName}, ${current.learner.firstName}`,
            subjectType: "EnrollmentRecord",
            recordId: update.recordId,
            oldValue: current.eosyStatus || "PENDING",
            newValue: update.status,
            ipAddress: req.ip ?? "0.0.0.0",
            userAgent: (req.headers["user-agent"] as string) ?? null,
            metadata: { gradeLevelId },
          },
        });

        count++;
      }

      return { count };
    });

    broadcastEosyInvalidation(parseInt(String(schoolYearId), 10));

    res.json({
      message: `Successfully processed ${result.count} updates.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function finalizeGradeLevel(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId, section_id } = req.body;

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);
    const isGlobal = !section_id || section_id === "all";
    const targetSectionId = isGlobal ? null : parseInt(String(section_id), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    if (!schoolYear) throw new AppError(404, "School year not found.");
    if (schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot finalize grade level. School year EOSY is already finalized.",
      );
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: glId },
    });
    if (!gradeLevel) throw new AppError(404, "Grade level not found.");

    const sectionWhere = {
      schoolYearId: syId,
      gradeLevelId: glId,
      ...(targetSectionId ? { id: targetSectionId } : {}),
    };

    const sections = await prisma.section.findMany({
      where: sectionWhere,
    });

    if (sections.length === 0) {
      throw new AppError(
        422,
        targetSectionId
          ? "Target section not found."
          : "No sections found for this grade level in the active school year.",
      );
    }

    if (sections.every((s) => s.isEosyFinalized)) {
      throw new AppError(
        422,
        targetSectionId
          ? "Section is already finalized."
          : "Grade level is already finalized.",
      );
    }

    const records = await prisma.enrollmentRecord.findMany({
      where: {
        schoolYearId: syId,
        section: sectionWhere,
      },
      include: {
        learner: true,
      },
    });

    // Verify all records have a locked, submitted GEN AVE from their Class Adviser
    const pendingLearners = records.filter(
      (r) =>
        (r.finalAverage === null || r.finalAverage === undefined) &&
        r.eosyStatus !== "TRANSFERRED_OUT" &&
        r.eosyStatus !== "DROPPED_OUT",
    );
    if (pendingLearners.length > 0) {
      throw new AppError(
        400,
        `Cannot finalize. ${pendingLearners.length} learner(s) still have pending grades.`,
      );
    }

    // Verify all records have eosyStatus
    const unfinalized = records.filter((r) => !r.eosyStatus);
    if (unfinalized.length > 0) {
      throw new AppError(
        422,
        `Cannot finalize. ${unfinalized.length} learners are missing an EOSY status.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      // Learner progression is applied only by the atomic school-year rollover.
      await tx.section.updateMany({
        where: sectionWhere,
        data: { isEosyFinalized: true },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          actionType: isGlobal ? "GRADE_LEVEL_FINALIZED" : "SECTION_FINALIZED",
          description: isGlobal
            ? `Finalized EOSY and executed grade progression for ${gradeLevel.name}`
            : `Finalized EOSY and executed grade progression for section ID ${targetSectionId}`,
          subjectType: isGlobal ? "GradeLevel" : "Section",
          recordId: isGlobal ? glId : targetSectionId!,
          oldValue: "false",
          newValue: "true",
          ipAddress: req.ip ?? "0.0.0.0",
          userAgent: (req.headers["user-agent"] as string) ?? null,
        },
      });
    });

    broadcastEosyInvalidation(
      syId,
      targetSectionId ? [targetSectionId] : sections.map((section) => section.id),
      records.map((record) => record.learnerId),
    );

    res.json({
      message: isGlobal
        ? "Grade level finalized successfully."
        : "Section finalized successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function unlockGradeLevelEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { gradeLevelId } = req.params;
    const { schoolYearId } = req.body;

    const syId = parseInt(String(schoolYearId), 10);
    const glId = parseInt(String(gradeLevelId), 10);

    const schoolYear = await prisma.schoolYear.findUnique({
      where: { id: syId },
    });

    if (!schoolYear) throw new AppError(404, "School year not found.");
    if (schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot unlock grade level. School year EOSY is already finalized globally.",
      );
    }

    const gradeLevel = await prisma.gradeLevel.findUnique({
      where: { id: glId },
    });
    if (!gradeLevel) throw new AppError(404, "Grade level not found.");

    const sections = await prisma.section.findMany({
      where: {
        schoolYearId: syId,
        gradeLevelId: glId,
      },
    });

    if (sections.length === 0) {
      throw new AppError(
        422,
        "No sections found for this grade level in the active school year.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.section.updateMany({
        where: {
          schoolYearId: syId,
          gradeLevelId: glId,
        },
        data: { isEosyFinalized: false },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "EOSY_GRADE_LEVEL_UNLOCKED",
        description: `Unlocked grade level ${gradeLevel.name} to revert control back to Class Advisers for corrections.`,
        subjectType: "GradeLevel",
        recordId: glId,
        req,
      });
    });

    broadcastEosyInvalidation(syId, sections.map((section) => section.id));

    res.json({ success: true, message: "Grade level successfully unlocked." });

    broadcastEosyUpdate({ type: "GRADE_LEVEL_UNLOCKED", gradeLevelId: glId });
  } catch (error) {
    next(error);
  }
}


export async function unlockSectionEosy(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const sectionId = parseInt(String(id), 10);

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { schoolYear: { select: { isEosyFinalized: true } } },
    });

    if (!section) throw new AppError(404, "Section not found.");
    if (section.schoolYear.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot unlock section. School year EOSY is already finalized globally.",
      );
    }
    if (!section.isEosyFinalized) {
      throw new AppError(400, "Section is already unlocked.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.section.update({
        where: { id: sectionId },
        data: { isEosyFinalized: false },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "EOSY_SECTION_UNLOCKED",
        description: `Unlocked section ${section.name} to revert control back to Class Adviser for corrections.`,
        subjectType: "Section",
        recordId: sectionId,
        req,
      });
    });

    broadcastEosyInvalidation(section.schoolYearId, [section.id]);

    res.json({ success: true, message: "Section roster successfully unlocked." });

    broadcastEosyUpdate({ type: "SECTION_UNLOCKED", sectionId: section.id });
  } catch (error) {
    next(error);
  }
}

export async function overrideEosyRecord(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;
    const recordId = parseInt(String(id), 10);
    const {
      lrn,
      firstName,
      lastName,
      sectionId,
      finalAverage,
      eosyStatus,
      academicDeficiencyNote,
      dropOutReason,
      transferOutDate,
      latitude,
      longitude,
    } = req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: recordId },
      include: {
        section: { include: { schoolYear: true } },
        enrollmentApplication: {
          include: {
            learner: true,
          },
        },
      },
    });

    if (!record) throw new AppError(404, "Enrollment record not found.");
    if (record.section?.schoolYear?.isEosyFinalized) {
      throw new AppError(
        422,
        "Cannot override status. School year EOSY is finalized globally.",
      );
    }

    // 1. Update Learner model
    if (lrn !== undefined || firstName !== undefined || lastName !== undefined) {
      await prisma.learner.update({
        where: { id: record.learnerId },
        data: {
          lrn: lrn !== undefined ? lrn : undefined,
          firstName: firstName !== undefined ? firstName : undefined,
          lastName: lastName !== undefined ? lastName : undefined,
        },
      });
    }

    // 2. Update address coordinates inside reportedGrades JSON
    if (latitude !== undefined || longitude !== undefined) {
      const currentGrades = asJsonObject(
        record.enrollmentApplication.reportedGrades,
      );
      await prisma.enrollmentApplication.update({
        where: { id: record.enrollmentApplicationId },
        data: {
          reportedGrades: {
            ...currentGrades,
            geofencing: { latitude, longitude },
          },
        },
      });
    }

    // 3. Update EnrollmentRecord
    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        sectionId: sectionId !== undefined ? sectionId : undefined,
        eosyStatus: eosyStatus !== undefined ? (eosyStatus as EosyStatus) : undefined,
        academicDeficiencyNote:
          eosyStatus !== undefined
            ? normalizeAcademicDeficiencyNote(
                eosyStatus as EosyStatus,
                academicDeficiencyNote,
              )
            : academicDeficiencyNote !== undefined
              ? normalizeAcademicDeficiencyNote(
                  record.eosyStatus,
                  academicDeficiencyNote,
                )
              : undefined,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          eosyStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage:
          finalAverage !== undefined && finalAverage !== null
            ? parseFloat(String(finalAverage))
            : undefined,
      },
    });

    // 4. Log detailed auditing details
    const auditDetails = [];
    if (lrn !== undefined && lrn !== record.enrollmentApplication.learner.lrn) auditDetails.push(`LRN: ${record.enrollmentApplication.learner.lrn} -> ${lrn}`);
    if (firstName !== undefined && firstName !== record.enrollmentApplication.learner.firstName) auditDetails.push(`First Name: ${record.enrollmentApplication.learner.firstName} -> ${firstName}`);
    if (lastName !== undefined && lastName !== record.enrollmentApplication.learner.lastName) auditDetails.push(`Last Name: ${record.enrollmentApplication.learner.lastName} -> ${lastName}`);
    if (sectionId !== undefined && sectionId !== record.sectionId) auditDetails.push(`Section ID: ${record.sectionId} -> ${sectionId}`);
    if (finalAverage !== undefined && finalAverage !== record.finalAverage) auditDetails.push(`Average: ${record.finalAverage} -> ${finalAverage}`);
    if (eosyStatus !== undefined && eosyStatus !== record.eosyStatus) auditDetails.push(`Status: ${record.eosyStatus} -> ${eosyStatus}`);
    if (
      academicDeficiencyNote !== undefined &&
      academicDeficiencyNote !== record.academicDeficiencyNote
    ) auditDetails.push(`Deficiency Note: ${record.academicDeficiencyNote ?? "none"} -> ${academicDeficiencyNote ?? "none"}`);
    if (latitude !== undefined || longitude !== undefined) auditDetails.push(`Coords: Lat ${latitude}, Lng ${longitude}`);

    await auditLog({
      userId: req.user!.userId,
      actionType: "HISTORICAL_CORRECTION_COMMITTED",
      description: `Historical correction for Learner ID ${record.learnerId}. Changes: ${auditDetails.join(", ")}`,
      subjectType: "EnrollmentRecord",
      recordId: record.id,
      oldValue: record.eosyStatus || "PENDING",
      newValue: eosyStatus || record.eosyStatus,
      metadata: {
        changes: auditDetails,
        registrarIp: req.ip,
      },
      req,
    });

    // 5. Data Realignment Ripple Effect (Forward Ripple)
    if (eosyStatus !== undefined && eosyStatus !== record.eosyStatus) {
      const activeSy = await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
      });
      if (activeSy) {
        const activeApp = await prisma.enrollmentApplication.findFirst({
          where: {
            learnerId: record.learnerId,
            schoolYearId: activeSy.id,
          },
        });
        if (activeApp) {
          const histGradeLevel = await prisma.gradeLevel.findUnique({
            where: { id: record.enrollmentApplication.gradeLevelId },
          });
          if (histGradeLevel) {
            let targetGradeLevelId = histGradeLevel.id;
            if (eosyStatus === "PROMOTED" || eosyStatus === "CONDITIONALLY_PROMOTED") {
              const nextGradeLevel = await prisma.gradeLevel.findFirst({
                where: { displayOrder: { gt: histGradeLevel.displayOrder } },
                orderBy: { displayOrder: "asc" },
              });
              if (nextGradeLevel) {
                targetGradeLevelId = nextGradeLevel.id;
              }
            }

            const activeAppGrades = asJsonObject(activeApp.reportedGrades);
            await prisma.enrollmentApplication.update({
              where: { id: activeApp.id },
              data: {
                gradeLevelId: targetGradeLevelId,
                status: "READY_FOR_SECTIONING",
                reportedGrades: {
                  ...activeAppGrades,
                  sectionReassignmentRequired: true,
                  reassignmentReason: `Historical promotion status changed to ${eosyStatus}`,
                },
              },
            });

            await prisma.enrollmentRecord.deleteMany({
              where: {
                enrollmentApplicationId: activeApp.id,
                schoolYearId: activeSy.id,
              },
            });
          }
        }
      }
    }

    // 6. Broadcast update
    broadcastEosyUpdate({
      type: "SECTION_FINALIZED",
      sectionId: record.sectionId,
    });
    broadcastEosyInvalidation(
      updated.schoolYearId,
      [updated.sectionId],
      [updated.learnerId],
    );

    res.json({ success: true, record: updated });
  } catch (error) {
    next(error);
  }
}

export async function streamEosyUpdates(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addEosyClient(res);

  // Send an initial heartbeat
  res.write(":\n\n");
}
