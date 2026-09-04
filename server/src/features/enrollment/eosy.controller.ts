import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { EosyStatus } from "../../generated/prisma/index.js";
import type {
  ApplicantType,
  Prisma,
} from "../../generated/prisma/index.js";
import {
  broadcastEosyInvalidation,
} from "../../lib/realtime-events.js";
import {
  buildSf5Payload,
  buildSf6Payload,
  getSchoolFormArtifactStatus,
  recordSchoolFormArtifact,
} from "./services/school-form-artifact.service.js";
import {
  clearSmartOutcomeFromReportedGrades,
  matchesStoredSmartOutcome,
  readSmartOutcomeEnvelope,
  readSmartSyncIssue,
} from "../integration/smart-outcome-envelope.js";
import { fetchSmartSf10ByLrn } from "../integration/smart-sf10.service.js";
import { checkSmartRemedialRolloverBlock } from "../integration/smart-remedial.service.js";

function hasFinalizedEosyOutcome(record: {
  schoolYearId: number;
  sectionId: number;
  eosyStatus: EosyStatus | null;
  finalAverage: number | null;
  enrollmentApplication: { reportedGrades: Prisma.JsonValue | null };
}): boolean {
  if (
    record.eosyStatus === "DROPPED_OUT"
    || record.eosyStatus === "TRANSFERRED_OUT"
  ) {
    return true;
  }
  
  return matchesStoredSmartOutcome({
    value: record.enrollmentApplication.reportedGrades,
    schoolYearId: record.schoolYearId,
    sectionId: record.sectionId,
    finalAverage: record.finalAverage,
    eosyStatus: record.eosyStatus,
  });
}

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
  scpViolations: Array<{
    subject: string;
    term: string;
    actualGrade: number;
    requiredGrade: number;
    violationType: string;
  }> | null;
  smartSyncStatus:
    | "FINALIZED_SMART_GRADES_RECEIVED"
    | "WAITING_FOR_SMART_FINALIZATION"
    | "INCOMPLETE_SUBJECT_GRADES"
    | "SMART_DATA_NEEDS_REVIEW"
    | null;
  smartSyncReason: string | null;
  smartSynchronizedAt: string | null;
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
  smartOutcome?: import("../integration/smart-outcome-envelope.js").SmartOutcomeEnvelope | null
) {
  const isScp = Boolean(programType && programType !== "REGULAR");
  const isScpDemoted = nextYearCurriculum === "REGULAR" && isScp;
  let scpViolations: NonNullable<EosyRecordPayload["scpViolations"]> = [];

  if (isScp && smartOutcome?.subjects) {
    for (const [subject, grades] of Object.entries(smartOutcome.subjects)) {

      if (grades.Final) {
        let isCore = false;
        let required = 83;

        if (programType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
          const lower = subject.toLowerCase();
          isCore = lower.includes("science") || lower.includes("math") || lower.includes("english") || lower.includes("research") || lower.includes("biotech") || lower.includes("environmental");
          required = isCore ? 85 : 83;
        } else if (programType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
          const lower = subject.toLowerCase();
          isCore = lower.includes("arts") || lower.includes("specialization");
          required = isCore ? 85 : 83;
        } else if (programType === "SPECIAL_PROGRAM_IN_SPORTS") {
          const lower = subject.toLowerCase();
          isCore = lower.includes("sports") || lower.includes("specialization");
          required = isCore ? 85 : 83;
        } else {
          const lower = subject.toLowerCase();
          isCore = lower.includes("science") || lower.includes("math");
          required = isCore ? 85 : 83;
        }

        if (grades.Final < required) {
          scpViolations.push({ subject, term: "Final Grade", actualGrade: grades.Final, requiredGrade: required, violationType: isCore ? "Core Subject Minimum" : "Subject Final Minimum" });
        }
      }
    }
  }

  return { isScpDemoted, scpViolations: scpViolations.length > 0 ? scpViolations : null };
}

async function loadEosyGradeRecords(
  schoolYearId: number,
  gradeLevelId: number,
): Promise<EosyRecordPayload[]> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { status: true, yearLabel: true },
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
        null
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
        smartSyncStatus: null,
        smartSyncReason: null,
        smartSynchronizedAt: null,
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
          isRemedialRequired: true,
          learner: {
            select: {
              id: true,
              lrn: true,
              firstName: true,
              lastName: true,
              sex: true,
              studentPhoto: true,
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

  let remedialBlockedLrns = new Set<string>();
  if (schoolYear?.yearLabel) {
    const remedialBlock = await checkSmartRemedialRolloverBlock(schoolYear.yearLabel).catch(() => null);
    if (remedialBlock?.students) {
      remedialBlockedLrns = new Set(remedialBlock.students.map(s => s.lrn));
    }
  }

  const remedialPendingMap = new Map<string, boolean>();
  const remedialRequiredLrns = records
    .filter(r => r.enrollmentApplication.isRemedialRequired && r.enrollmentApplication.learner.lrn)
    .map(r => r.enrollmentApplication.learner.lrn as string);

  if (remedialRequiredLrns.length > 0) {
    await Promise.all(remedialRequiredLrns.map(async (lrn) => {
      try {
        const sf10Records = await fetchSmartSf10ByLrn(lrn);
        const hasPendingRemedial = sf10Records.some((r) => 
          r.remedialClasses && r.remedialClasses.some(rc => rc.status === "PENDING" || !rc.outcome || rc.outcome.toUpperCase() !== "PASSED")
        );
        remedialPendingMap.set(lrn, hasPendingRemedial);
      } catch (e) {
        remedialPendingMap.set(lrn, true); // Safely block if API fails
      }
    }));
  }

  return records.map((record) => {
    const finalAverage =
      record.finalAverage !== null && record.finalAverage !== undefined
        ? Number(record.finalAverage)
        : null;
    const smartOutcome = readSmartOutcomeEnvelope(
      record.enrollmentApplication.reportedGrades,
    );
    const smartIssue = readSmartSyncIssue(
      record.enrollmentApplication.reportedGrades,
    );
    const hasMatchingSmartOutcome = matchesStoredSmartOutcome({
      value: record.enrollmentApplication.reportedGrades,
      schoolYearId,
      sectionId: record.sectionId,
      finalAverage,
      eosyStatus: record.eosyStatus,
    });
    const isLocalDeparture =
      record.eosyStatus === "DROPPED_OUT"
      || record.eosyStatus === "TRANSFERRED_OUT";
    const scpMetadata = buildScpMetadata(
      record.section.programType,
      record.nextYearCurriculum,
      finalAverage,
      smartOutcome,
    );

    const lrn = record.enrollmentApplication.learner.lrn;
    const isBlockedByRemedial = lrn ? (remedialBlockedLrns.has(lrn) || remedialPendingMap.get(lrn) === true) : false;

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
      smartSyncStatus: isLocalDeparture
        ? null
        : isBlockedByRemedial
          ? "WAITING_FOR_SMART_FINALIZATION"
          : hasMatchingSmartOutcome
            ? "FINALIZED_SMART_GRADES_RECEIVED"
            : smartIssue?.status ?? "WAITING_FOR_SMART_FINALIZATION",
      smartSyncReason: isLocalDeparture 
        ? null
        : isBlockedByRemedial
          ? "Learner has pending remedial classes."
          : hasMatchingSmartOutcome
            ? null
            : smartIssue?.reason
              ?? "Waiting for SMART to publish complete finalized grades.",
      smartSynchronizedAt: hasMatchingSmartOutcome
        ? smartOutcome?.synchronizedAt ?? null
        : smartIssue?.synchronizedAt ?? null,
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
    const { eosyStatus, dropOutReason, transferOutDate } = req.body;

    const record = await prisma.enrollmentRecord.findUnique({
      where: { id: recordId },
      include: {
        enrollmentApplication: {
          select: { applicantType: true, reportedGrades: true }
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

    if (eosyStatus !== "DROPPED_OUT" && eosyStatus !== "TRANSFERRED_OUT") {
      throw new AppError(
        422,
        "Academic outcomes must come from finalized SMART grades. Only Dropped Out and Transferred Out may be recorded in EnrollPro.",
      );
    }

    if (eosyStatus === "DROPPED_OUT" && !String(dropOutReason ?? "").trim()) {
      throw new AppError(422, "A drop-out reason is required.");
    }
    if (eosyStatus === "TRANSFERRED_OUT" && !transferOutDate) {
      throw new AppError(422, "A transfer-out date is required.");
    }

    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        eosyStatus,
        academicDeficiencyNote: null,
        nextYearCurriculum: null,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          eosyStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage: null,
      },
    });
    await prisma.enrollmentApplication.update({
      where: { id: record.enrollmentApplicationId },
      data: {
        reportedGrades: clearSmartOutcomeFromReportedGrades(
          record.enrollmentApplication.reportedGrades,
        ),
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

    const records = await prisma.enrollmentRecord.findMany({
      where: { sectionId },
      include: {
        learner: true,
        enrollmentApplication: { select: { reportedGrades: true, isRemedialRequired: true } },
      },
    });

    const pendingLearners = records.filter(
      (record) => !hasFinalizedEosyOutcome(record),
    );
    if (pendingLearners.length > 0) {
      throw new AppError(
        400,
        `Cannot finalize. ${pendingLearners.length} learner(s) do not have a matching finalized SMART outcome.`,
      );
    }

    const unfinalized = records.filter((r) => !r.eosyStatus);
    if (unfinalized.length > 0) {
      throw new AppError(
        422,
        `Cannot finalize. ${unfinalized.length} learners are missing an EOSY status.`,
      );
    }

    const irregularLearners = records.filter((r) => r.enrollmentApplication?.isRemedialRequired);
    if (irregularLearners.length > 0) {
      await Promise.all(
        irregularLearners.map(async (record) => {
          if (!record.learner.lrn) return;
          const sf10Records = await fetchSmartSf10ByLrn(record.learner.lrn).catch(() => []);
          const hasRemedialTable = sf10Records.some((r) => r.remedialClasses && r.remedialClasses.length > 0);
          if (!hasRemedialTable) {
            throw new AppError(
              400,
              `Cannot finalize. Learner ${record.learner.lastName}, ${record.learner.firstName} has back subjects but does not have a remedial class grades table yet.`
            );
          }
          const hasPendingRemedial = sf10Records.some((r) => 
            r.remedialClasses && r.remedialClasses.some(rc => rc.status === "PENDING" || !rc.outcome || rc.outcome.toUpperCase() !== "PASSED")
          );
          if (hasPendingRemedial) {
            throw new AppError(
              400,
              `Cannot finalize. Learner ${record.learner.lastName}, ${record.learner.firstName} has pending remedial classes.`
            );
          }
        })
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

    const mappedRecords = await loadEosyGradeRecords(syId, glId);

    res.json({ records: mappedRecords });
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
        enrollmentApplication: { select: { reportedGrades: true, isRemedialRequired: true } },
      },
    });

    const pendingLearners = records.filter(
      (record) => !hasFinalizedEosyOutcome(record),
    );
    if (pendingLearners.length > 0) {
      throw new AppError(
        400,
        `Cannot finalize. ${pendingLearners.length} learner(s) do not have a matching finalized SMART outcome.`,
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

    const irregularLearners = records.filter((r) => r.enrollmentApplication?.isRemedialRequired);
    if (irregularLearners.length > 0) {
      await Promise.all(
        irregularLearners.map(async (record) => {
          if (!record.learner.lrn) return;
          const sf10Records = await fetchSmartSf10ByLrn(record.learner.lrn).catch(() => []);
          const hasRemedialTable = sf10Records.some((r) => r.remedialClasses && r.remedialClasses.length > 0);
          if (!hasRemedialTable) {
            throw new AppError(
              400,
              `Cannot finalize. Learner ${record.learner.lastName}, ${record.learner.firstName} has back subjects but does not have a remedial class grades table yet.`
            );
          }
          const hasPendingRemedial = sf10Records.some((r) => 
            r.remedialClasses && r.remedialClasses.some(rc => rc.status === "PENDING" || !rc.outcome || rc.outcome.toUpperCase() !== "PASSED")
          );
          if (hasPendingRemedial) {
            throw new AppError(
              400,
              `Cannot finalize. Learner ${record.learner.lastName}, ${record.learner.firstName} has pending remedial classes.`
            );
          }
        })
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
            ? `Finalized EOSY review for ${gradeLevel.name}`
            : `Finalized EOSY review for section ID ${targetSectionId}`,
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
        description: `Unlocked grade level ${gradeLevel.name} so updated SMART outcomes can be synchronized and reviewed.`,
        subjectType: "GradeLevel",
        recordId: glId,
        req,
      });
    });

    broadcastEosyInvalidation(syId, sections.map((section) => section.id));

    res.json({ success: true, message: "Grade level successfully unlocked." });

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
        description: `Unlocked section ${section.name} so updated SMART outcomes can be synchronized and reviewed.`,
        subjectType: "Section",
        recordId: sectionId,
        req,
      });
    });

    broadcastEosyInvalidation(section.schoolYearId, [section.id]);

    res.json({ success: true, message: "Section roster successfully unlocked." });

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
    if (finalAverage !== undefined || academicDeficiencyNote !== undefined) {
      throw new AppError(
        409,
        "Final grades and academic deficiencies are owned by SMART and cannot be overridden in EnrollPro.",
      );
    }
    if (
      eosyStatus !== undefined
      && eosyStatus !== "DROPPED_OUT"
      && eosyStatus !== "TRANSFERRED_OUT"
    ) {
      throw new AppError(
        409,
        "Promotion, retention, and conditional promotion must be synchronized from SMART.",
      );
    }
    if (sectionId !== undefined && Number(sectionId) !== record.sectionId) {
      const destination = await prisma.section.findUnique({
        where: { id: Number(sectionId) },
        select: { schoolYearId: true, gradeLevelId: true, programType: true },
      });
      if (
        !destination
        || destination.schoolYearId !== record.schoolYearId
        || destination.gradeLevelId !== record.section.gradeLevelId
        || destination.programType !== record.section.programType
      ) {
        throw new AppError(
          400,
          "A correction may move a learner only to a section in the same school year, grade level, and program.",
        );
      }
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

    // 2. Preserve non-academic metadata while invalidating SMART provenance
    // when a local departure status is recorded.
    if (
      latitude !== undefined
      || longitude !== undefined
      || eosyStatus === "DROPPED_OUT"
      || eosyStatus === "TRANSFERRED_OUT"
    ) {
      const currentGrades = asJsonObject(record.enrollmentApplication.reportedGrades);
      const gradesWithCoordinates = latitude !== undefined || longitude !== undefined
        ? {
            ...currentGrades,
            geofencing: { latitude, longitude },
          }
        : currentGrades;
      await prisma.enrollmentApplication.update({
        where: { id: record.enrollmentApplicationId },
        data: {
          reportedGrades:
            eosyStatus === "DROPPED_OUT" || eosyStatus === "TRANSFERRED_OUT"
              ? clearSmartOutcomeFromReportedGrades(gradesWithCoordinates)
              : gradesWithCoordinates,
        },
      });
    }

    // 3. Update EnrollmentRecord
    const updated = await prisma.enrollmentRecord.update({
      where: { id: recordId },
      data: {
        sectionId: sectionId !== undefined ? sectionId : undefined,
        eosyStatus: eosyStatus !== undefined ? (eosyStatus as EosyStatus) : undefined,
        academicDeficiencyNote: eosyStatus !== undefined ? null : undefined,
        nextYearCurriculum: eosyStatus !== undefined ? null : undefined,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate:
          eosyStatus === "TRANSFERRED_OUT"
            ? transferOutDate
              ? new Date(transferOutDate)
              : null
            : null,
        finalAverage: eosyStatus !== undefined ? null : undefined,
      },
    });

    // 4. Log detailed auditing details
    const auditDetails = [];
    if (lrn !== undefined && lrn !== record.enrollmentApplication.learner.lrn) auditDetails.push(`LRN: ${record.enrollmentApplication.learner.lrn} -> ${lrn}`);
    if (firstName !== undefined && firstName !== record.enrollmentApplication.learner.firstName) auditDetails.push(`First Name: ${record.enrollmentApplication.learner.firstName} -> ${firstName}`);
    if (lastName !== undefined && lastName !== record.enrollmentApplication.learner.lastName) auditDetails.push(`Last Name: ${record.enrollmentApplication.learner.lastName} -> ${lastName}`);
    if (sectionId !== undefined && sectionId !== record.sectionId) auditDetails.push(`Section ID: ${record.sectionId} -> ${sectionId}`);
    if (eosyStatus !== undefined && eosyStatus !== record.eosyStatus) auditDetails.push(`Status: ${record.eosyStatus} -> ${eosyStatus}`);
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

    // Broadcast only after the correction writes have completed.
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
