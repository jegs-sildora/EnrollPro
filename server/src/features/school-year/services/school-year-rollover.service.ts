import {
  Prisma,
  type ApplicantType,
  type EosyStatus,
} from "../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import { runWithAutomaticAuditSuppressed } from "../../../lib/context.js";
import { getSchoolFormArtifactStatus } from "../../enrollment/services/school-form-artifact.service.js";
import {
  matchesStoredSmartOutcome,
  readSmartOutcomeEnvelope,
} from "../../integration/smart-outcome-envelope.js";
import { resolveRolloverDestination } from "./school-year-transition.service.js";

type DatabaseClient = Pick<
  typeof prisma,
  | "schoolYear"
  | "schoolSetting"
  | "schoolFormArtifact"
  | "section"
  | "enrollmentRecord"
  | "enrollmentHistory"
  | "enrollmentApplication"
  | "gradeLevel"
  | "learner"
  | "sectionAdviser"
  | "auditLog"
>;

export type RolloverBlockerReason =
  | "SECTION_NOT_FINALIZED"
  | "LEARNER_RESULT_NOT_FINALIZED"
  | "SMART_OUTCOME_MISSING"
  | "SMART_OUTCOME_MISMATCH"
  | "SF5_NOT_RECORDED"
  | "SF5_STALE";

export interface RolloverClassBlocker {
  sectionId: number;
  gradeLevel: string;
  sectionName: string;
  unfinishedLearnerCount: number;
  reasons: RolloverBlockerReason[];
}

export interface RolloverGlobalBlocker {
  code:
    | "SOURCE_NOT_FOUND"
    | "SOURCE_NOT_ACTIVE"
    | "SOURCE_NOT_SELECTED"
    | "EOSY_PHASE_NOT_ACTIVE"
    | "TARGET_YEAR_LABEL_INVALID"
    | "SF6_NOT_RECORDED"
    | "SF6_STALE"
    | "TARGET_YEAR_HAS_RECORDS"
    | "TARGET_YEAR_NOT_PREPARED"
    | "TARGET_CALENDAR_INCOMPLETE"
    | "ANOTHER_ACTIVE_YEAR_EXISTS"
    | "ENROLLMENT_HISTORY_CONFLICT";
  message: string;
}

export interface RolloverReadiness {
  ready: boolean;
  schoolYearFinalized: boolean;
  blockers: RolloverClassBlocker[];
  globalBlockers: RolloverGlobalBlocker[];
  formStatus: {
    currentSf5Count: number;
    totalSections: number;
    sf6Recorded: boolean;
    sf6Current: boolean;
  };
}

export interface ExecuteRolloverInput {
  sourceSchoolYearId: number;
  actingUserId: number;
  ipAddress: string;
  userAgent: string | null;
}

export interface RolloverSummary {
  archivedRecords: number;
  pendingConfirmations: number;
  remedialHolds: number;
  completers: number;
  archiveOnlyDepartures: number;
}

export interface ExecuteRolloverResult {
  year: {
    id: number;
    yearLabel: string;
    status: string;
  };
  rolloverFrom: {
    id: number;
    yearLabel: string;
  };
  rolloverSummary: RolloverSummary;
}

export class RolloverNotReadyError extends Error {
  readonly code = "ROLLOVER_NOT_READY";
  readonly readiness: RolloverReadiness;

  constructor(readiness: RolloverReadiness) {
    const message =
      readiness.globalBlockers[0]?.message
      ?? (readiness.blockers[0]
        ? `Complete ${readiness.blockers[0].gradeLevel} - ${readiness.blockers[0].sectionName} before starting the new school year.`
        : "Complete all EOSY requirements before starting the new school year.");
    super(message);
    this.name = "RolloverNotReadyError";
    this.readiness = readiness;
  }
}

interface SourceSectionSnapshot {
  id: number;
  name: string;
  maxCapacity: number;
  gradeLevelId: number;
  programType: ApplicantType;
  sortOrder: number;
  isHomogeneous: boolean;
  isSnake: boolean;
  sectionRank: number | null;
}

function nextYearLabel(yearLabel: string): string | null {
  const match = /^(\d{4})-(\d{4})$/.exec(yearLabel);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end === start + 1 ? `${start + 1}-${end + 1}` : null;
}

function learnerIdentifier(learnerId: number, lrn: string | null): string {
  const normalizedLrn = lrn?.trim();
  return normalizedLrn ? `LRN:${normalizedLrn}` : `LEARNER:${learnerId}`;
}

function isDeparture(status: EosyStatus | null): boolean {
  return status === "DROPPED_OUT" || status === "TRANSFERRED_OUT";
}

async function getTargetOperationalCount(
  client: DatabaseClient,
  targetYearLabel: string,
): Promise<{
  id: number;
  status: string;
  clonedFromId: number | null;
  calendarComplete: boolean;
  count: number;
} | null> {
  const target = await client.schoolYear.findUnique({
    where: { yearLabel: targetYearLabel },
    select: {
      id: true,
      status: true,
      clonedFromId: true,
      classOpeningDate: true,
      classEndDate: true,
      enrollOpenDate: true,
      enrollCloseDate: true,
      termFormat: true,
      term1Start: true,
      term1End: true,
      term2Start: true,
      term2End: true,
      term3Start: true,
      term3End: true,
      term4Start: true,
      term4End: true,
      _count: {
        select: {
          sections: true,
          enrollmentApplications: true,
          enrollmentRecords: true,
          enrollmentHistories: true,
          sectionAdvisers: true,
          teacherDesignations: true,
          teacherSchedulePeriods: true,
          healthRecords: true,
          schoolFormArtifacts: true,
        },
      },
    },
  });
  if (!target) return null;
  const requiredDates = [
    target.classOpeningDate,
    target.classEndDate,
    target.enrollOpenDate,
    target.enrollCloseDate,
    target.term1Start,
    target.term1End,
    target.term2Start,
    target.term2End,
    target.term3Start,
    target.term3End,
    ...(target.termFormat === "QUARTERS"
      ? [target.term4Start, target.term4End]
      : []),
  ];
  return {
    id: target.id,
    status: target.status,
    clonedFromId: target.clonedFromId,
    calendarComplete:
      requiredDates.every((value) => value !== null)
      && target.classOpeningDate !== null
      && target.classEndDate !== null
      && target.enrollOpenDate !== null
      && target.enrollCloseDate !== null
      && target.classOpeningDate <= target.classEndDate
      && target.enrollOpenDate <= target.enrollCloseDate,
    count: Object.values(target._count).reduce(
      (total, count) => total + count,
      0,
    ),
  };
}

async function getReadiness(
  client: DatabaseClient,
  schoolYearId: number,
): Promise<RolloverReadiness> {
  const sourceYear = await client.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: {
      id: true,
      yearLabel: true,
      status: true,
      isEosyFinalized: true,
      sections: {
        orderBy: [
          { gradeLevel: { displayOrder: "asc" } },
          { sortOrder: "asc" },
        ],
        select: {
          id: true,
          name: true,
          isEosyFinalized: true,
          gradeLevel: { select: { name: true } },
          enrollmentRecords: {
            select: {
              learnerId: true,
              eosyStatus: true,
              finalAverage: true,
              enrollmentApplication: {
                select: { reportedGrades: true },
              },
            },
          },
        },
      },
    },
  });
  const globalBlockers: RolloverGlobalBlocker[] = [];
  if (!sourceYear) {
    globalBlockers.push({
      code: "SOURCE_NOT_FOUND",
      message: "The current school year could not be found.",
    });
    return {
      ready: false,
      schoolYearFinalized: false,
      blockers: [],
      globalBlockers,
      formStatus: {
        currentSf5Count: 0,
        totalSections: 0,
        sf6Recorded: false,
        sf6Current: false,
      },
    };
  }

  const expectedTargetLabel = nextYearLabel(sourceYear.yearLabel);
  const settings = await client.schoolSetting.findMany({
    select: { activeSchoolYearId: true, systemPhase: true },
    take: 2,
  });
  const setting = settings.length === 1 ? settings[0] : null;

  if (settings.length !== 1) {
    globalBlockers.push({
      code: "ANOTHER_ACTIVE_YEAR_EXISTS",
      message:
        "The school settings record is missing or duplicated. Resolve this configuration conflict before rollover.",
    });
  }

  if (sourceYear.status !== "ACTIVE") {
    globalBlockers.push({
      code: "SOURCE_NOT_ACTIVE",
      message: "Only the active school year can be rolled over.",
    });
  }
  if (setting?.activeSchoolYearId !== sourceYear.id) {
    globalBlockers.push({
      code: "SOURCE_NOT_SELECTED",
      message:
        "The selected school year is not the operational school year.",
    });
  }
  if (setting?.systemPhase !== "EOSY_CLOSING") {
    globalBlockers.push({
      code: "EOSY_PHASE_NOT_ACTIVE",
      message:
        "Move the system to End of School Year Closing before rollover.",
    });
  }
  if (!expectedTargetLabel) {
    globalBlockers.push({
      code: "TARGET_YEAR_LABEL_INVALID",
      message:
        "The current school year must use consecutive years in YYYY-YYYY format before rollover.",
    });
  }

  let currentSf5Count = 0;
  const blockers: RolloverClassBlocker[] = [];
  for (const section of sourceYear.sections) {
    const reasons: RolloverBlockerReason[] = [];
    let recordsWithoutResult = 0;
    let missingSmartOutcome = false;
    let mismatchedSmartOutcome = false;

    for (const record of section.enrollmentRecords) {
      if (isDeparture(record.eosyStatus)) continue;
      if (record.eosyStatus === null || record.finalAverage === null) {
        recordsWithoutResult += 1;
        continue;
      }
      const smartOutcome = readSmartOutcomeEnvelope(
        record.enrollmentApplication.reportedGrades,
      );
      if (!smartOutcome) {
        missingSmartOutcome = true;
        recordsWithoutResult += 1;
        continue;
      }
      if (!matchesStoredSmartOutcome({
        value: record.enrollmentApplication.reportedGrades,
        schoolYearId,
        sectionId: section.id,
        finalAverage: record.finalAverage,
        eosyStatus: record.eosyStatus,
      })) {
        mismatchedSmartOutcome = true;
        recordsWithoutResult += 1;
      }
    }

    if (!section.isEosyFinalized) reasons.push("SECTION_NOT_FINALIZED");
    if (recordsWithoutResult > 0) {
      reasons.push("LEARNER_RESULT_NOT_FINALIZED");
    }
    if (missingSmartOutcome) reasons.push("SMART_OUTCOME_MISSING");
    if (mismatchedSmartOutcome) reasons.push("SMART_OUTCOME_MISMATCH");

    const sf5Status = await getSchoolFormArtifactStatus(
      "SF5",
      schoolYearId,
      section.id,
      client,
    );
    if (sf5Status.current) {
      currentSf5Count += 1;
    } else {
      reasons.push(sf5Status.recorded ? "SF5_STALE" : "SF5_NOT_RECORDED");
    }

    if (reasons.length > 0) {
      blockers.push({
        sectionId: section.id,
        gradeLevel: section.gradeLevel.name,
        sectionName: section.name,
        unfinishedLearnerCount: recordsWithoutResult,
        reasons,
      });
    }
  }

  const sf6Status = await getSchoolFormArtifactStatus(
    "SF6",
    schoolYearId,
    null,
    client,
  );
  if (!sf6Status.current) {
    globalBlockers.push({
      code: sf6Status.recorded ? "SF6_STALE" : "SF6_NOT_RECORDED",
      message: sf6Status.recorded
        ? "Record SF6 again because learner outcomes changed."
        : "Record the official school-wide SF6 before rollover.",
    });
  }

  if (expectedTargetLabel) {
    const target = await getTargetOperationalCount(
      client,
      expectedTargetLabel,
    );
    if (!target) {
      globalBlockers.push({
        code: "TARGET_YEAR_NOT_PREPARED",
        message:
          "Prepare and review the incoming school year calendar before rollover.",
      });
    } else if (!target.calendarComplete) {
      globalBlockers.push({
        code: "TARGET_CALENDAR_INCOMPLETE",
        message:
          "Complete the incoming school year calendar before rollover.",
      });
    }
    if (
      target
      && (target.status === "ACTIVE"
        || (target.clonedFromId !== null
          && target.clonedFromId !== sourceYear.id))
    ) {
      globalBlockers.push({
        code: "TARGET_YEAR_HAS_RECORDS",
        message:
          "The incoming school year is not an unused prepared calendar shell.",
      });
    } else if (target && target.id !== sourceYear.id && target.count > 0) {
      globalBlockers.push({
        code: "TARGET_YEAR_HAS_RECORDS",
        message:
          "The incoming school year already contains operational records. Rollover will not delete them.",
      });
    }
  }

  const activeYears = await client.schoolYear.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  if (
    activeYears.length !== 1
    || activeYears[0]?.id !== sourceYear.id
  ) {
    globalBlockers.push({
      code: "ANOTHER_ACTIVE_YEAR_EXISTS",
      message:
        "The active school year records conflict with the selected operational school year.",
    });
  }

  const historyCount = await client.enrollmentHistory.count({
    where: { schoolYearId },
  });
  if (historyCount > 0) {
    globalBlockers.push({
      code: "ENROLLMENT_HISTORY_CONFLICT",
      message:
        "Enrollment history already exists for this school year. Resolve the conflict before rollover.",
    });
  }

  return {
    ready: blockers.length === 0 && globalBlockers.length === 0,
    schoolYearFinalized: sourceYear.isEosyFinalized,
    blockers,
    globalBlockers,
    formStatus: {
      currentSf5Count,
      totalSections: sourceYear.sections.length,
      sf6Recorded: sf6Status.recorded,
      sf6Current: sf6Status.current,
    },
  };
}

export async function getSchoolYearRolloverReadiness(
  schoolYearId: number,
): Promise<RolloverReadiness> {
  return getReadiness(prisma, schoolYearId);
}

export function getHistoricalProfileSnapshot(record: {
  academicDeficiencyNote?: string | null;
  learner: {
    lrn: string | null;
    firstName: string;
    middleName: string | null;
    lastName: string;
    extensionName: string | null;
    sex: string;
    birthdate: Date;
  };
  enrollmentApplication: {
    id: number;
    applicantType: ApplicantType;
    assignedProgram: ApplicantType | null;
    learnerType: string;
    isPrivacyConsentGiven: boolean;
    guardianRelationship: string | null;
    hasNoMother: boolean;
    hasNoFather: boolean;
    contactNumber: string | null;
    guardianName: string | null;
    addresses: Array<{
      addressType: string;
      houseNoStreet: string | null;
      street: string | null;
      sitio: string | null;
      barangay: string | null;
      cityMunicipality: string | null;
      province: string | null;
      country: string | null;
      zipCode: string | null;
    }>;
    familyMembers: Array<{
      relationship: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      extensionName: string | null;
      contactNumber: string | null;
      email: string | null;
      maidenName: string | null;
    }>;
  };
  section: {
    name: string;
    gradeLevelId: number;
    gradeLevel: { name: string; displayOrder: number };
  };
  enrolledBy: {
    firstName: string;
    lastName: string;
  };
}): Prisma.InputJsonObject {
  return {
    academicDeficiencyNote: record.academicDeficiencyNote ?? "",
    learner: {
      lrn: record.learner.lrn ?? "",
      firstName: record.learner.firstName,
      middleName: record.learner.middleName ?? "",
      lastName: record.learner.lastName,
      extensionName: record.learner.extensionName ?? "",
      sex: record.learner.sex,
      birthdate: record.learner.birthdate.toISOString(),
    },
    enrollmentApplicationId: record.enrollmentApplication.id,
    applicantType: record.enrollmentApplication.applicantType,
    assignedProgram: record.enrollmentApplication.assignedProgram ?? "",
    learnerType: record.enrollmentApplication.learnerType,
    privacyConsentGiven:
      record.enrollmentApplication.isPrivacyConsentGiven,
    guardianRelationship:
      record.enrollmentApplication.guardianRelationship ?? "",
    hasNoMother: record.enrollmentApplication.hasNoMother,
    hasNoFather: record.enrollmentApplication.hasNoFather,
    contactNumber: record.enrollmentApplication.contactNumber ?? "",
    guardianName: record.enrollmentApplication.guardianName ?? "",
    section: {
      name: record.section.name,
      gradeLevelId: record.section.gradeLevelId,
      gradeLevel: record.section.gradeLevel.name,
      gradeOrder: record.section.gradeLevel.displayOrder,
    },
    addresses: record.enrollmentApplication.addresses.map((address) => ({
      addressType: address.addressType,
      houseNoStreet: address.houseNoStreet ?? "",
      street: address.street ?? "",
      sitio: address.sitio ?? "",
      barangay: address.barangay ?? "",
      cityMunicipality: address.cityMunicipality ?? "",
      province: address.province ?? "",
      country: address.country ?? "",
      zipCode: address.zipCode ?? "",
    })),
    familyMembers: record.enrollmentApplication.familyMembers.map((member) => ({
      relationship: member.relationship,
      firstName: member.firstName,
      lastName: member.lastName,
      middleName: member.middleName ?? "",
      extensionName: member.extensionName ?? "",
      contactNumber: member.contactNumber ?? "",
      email: member.email ?? "",
      maidenName: member.maidenName ?? "",
    })),
    enrolledBy: {
      firstName: record.enrolledBy.firstName,
      lastName: record.enrolledBy.lastName,
    },
  };
}

function academicOutcomeSnapshot(
  outcome: {
    finalGeneralAverage: number | null;
    finalOutcome: string | null;
    academicDeficiencyNote: string | null;
    reportedGrades: Prisma.JsonValue | null;
  },
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (outcome.finalGeneralAverage === null && outcome.reportedGrades === null) {
    return Prisma.JsonNull;
  }

  const smartOutcome = readSmartOutcomeEnvelope(outcome.reportedGrades);
  return {
    finalGeneralAverage: outcome.finalGeneralAverage,
    finalOutcome: outcome.finalOutcome,
    academicDeficiencyNote: outcome.academicDeficiencyNote,
    smartOutcome: smartOutcome
      ? JSON.parse(JSON.stringify(smartOutcome)) as Prisma.InputJsonValue
      : null,
  };
}

async function cloneSectionStructure(input: {
  client: Pick<typeof prisma, "section">;
  targetSchoolYearId: number;
  sourceSections: SourceSectionSnapshot[];
}): Promise<void> {
  for (const section of input.sourceSections) {
    await input.client.section.create({
      data: {
        name: section.name,
        maxCapacity: section.maxCapacity,
        gradeLevelId: section.gradeLevelId,
        programType: section.programType,
        sortOrder: section.sortOrder,
        isHomogeneous: section.isHomogeneous,
        isSnake: section.isSnake,
        schoolYearId: input.targetSchoolYearId,
        sectionRank: section.sectionRank,
        isEosyFinalized: false,
      },
    });
  }
}

export async function executeSchoolYearRollover({
  sourceSchoolYearId,
  actingUserId,
  ipAddress,
  userAgent,
}: ExecuteRolloverInput): Promise<ExecuteRolloverResult> {
  return runWithAutomaticAuditSuppressed(() => prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceSchoolYearId})`;
      const readiness = await getReadiness(
        tx,
        sourceSchoolYearId,
      );
      if (!readiness.ready) {
        throw new RolloverNotReadyError(readiness);
      }

      const sourceYear = await tx.schoolYear.findUniqueOrThrow({
        where: { id: sourceSchoolYearId },
        select: {
          id: true,
          yearLabel: true,
        },
      });
      const expectedTargetLabel = nextYearLabel(sourceYear.yearLabel);
      if (!expectedTargetLabel) {
        throw new Error(
          "The current school year must use consecutive years in YYYY-YYYY format.",
        );
      }

      const [sourceRecords, sourceSections, gradeLevels, settingRows] =
        await Promise.all([
          tx.enrollmentRecord.findMany({
            where: { schoolYearId: sourceSchoolYearId },
            select: {
              learnerId: true,
              schoolYearId: true,
              sectionId: true,
              finalAverage: true,
              eosyStatus: true,
              academicDeficiencyNote: true,
              nextYearCurriculum: true,
              learner: {
                select: {
                  lrn: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  extensionName: true,
                  sex: true,
                  birthdate: true,
                },
              },
              enrolledBy: {
                select: { firstName: true, lastName: true },
              },
              section: {
                select: {
                  name: true,
                  gradeLevelId: true,
                  gradeLevel: {
                    select: { name: true, displayOrder: true },
                  },
                  advisers: {
                    where: { status: "ACTIVE" },
                    orderBy: [
                      { effectiveFrom: "desc" },
                      { id: "desc" },
                    ],
                    take: 1,
                    select: { teacherId: true },
                  },
                },
              },
              enrollmentApplication: {
                select: {
                  id: true,
                  applicantType: true,
                  assignedProgram: true,
                  learnerType: true,
                  isPrivacyConsentGiven: true,
                  guardianRelationship: true,
                  hasNoMother: true,
                  hasNoFather: true,
                  encodedById: true,
                  contactNumber: true,
                  guardianName: true,
                  reportedGrades: true,
                  addresses: {
                    select: {
                      addressType: true,
                      houseNoStreet: true,
                      street: true,
                      sitio: true,
                      barangay: true,
                      cityMunicipality: true,
                      province: true,
                      country: true,
                      zipCode: true,
                    },
                  },
                  familyMembers: {
                    select: {
                      relationship: true,
                      firstName: true,
                      lastName: true,
                      middleName: true,
                      extensionName: true,
                      contactNumber: true,
                      email: true,
                      maidenName: true,
                    },
                  },
                },
              },

            },
          }),
          tx.section.findMany({
            where: { schoolYearId: sourceSchoolYearId },
            select: {
              id: true,
              name: true,
              maxCapacity: true,
              gradeLevelId: true,
              programType: true,
              sortOrder: true,
              isHomogeneous: true,
              isSnake: true,
              sectionRank: true,
            },
          }),
          tx.gradeLevel.findMany({
            select: { id: true, displayOrder: true },
          }),
          tx.schoolSetting.findMany({ take: 2 }),
        ]);

      if (settingRows.length !== 1) {
        throw new Error(
          "Exactly one school settings record is required before rollover.",
        );
      }
      const setting = settingRows[0];

      const targetLabel = expectedTargetLabel;

      const targetOperational = await getTargetOperationalCount(
        tx,
        targetLabel,
      );
      if (!targetOperational) {
        throw new Error(
          "The incoming school year calendar has not been prepared.",
        );
      }
      if (
        targetOperational.status === "ACTIVE"
        || !targetOperational.calendarComplete
        || targetOperational.count > 0
        || (targetOperational.clonedFromId !== null
          && targetOperational.clonedFromId !== sourceSchoolYearId)
      ) {
        throw new Error(
          "The incoming school year is not an empty reviewed calendar shell.",
        );
      }

      const targetYear = {
        id: targetOperational.id,
        yearLabel: targetLabel,
        status: "ACTIVE",
      };


      await cloneSectionStructure({
        client: tx,
        targetSchoolYearId: targetYear.id,
        sourceSections,
      });

      const historyRows = sourceRecords.map((record) => ({
          learnerId: record.learnerId,
          learnerIdentifier: learnerIdentifier(
            record.learnerId,
            record.learner.lrn,
          ),
          schoolYearId: record.schoolYearId,
          gradeLevelId: record.section.gradeLevelId,
          sectionId: record.sectionId,
          adviserId: record.section.advisers[0]?.teacherId ?? null,
          genAve: record.finalAverage,
          eosyStatus: record.eosyStatus,
          academicDeficiencyNote: record.academicDeficiencyNote,
          learnerProfileSnapshot: getHistoricalProfileSnapshot(record),
          academicOutcomeSnapshot: academicOutcomeSnapshot({
            finalGeneralAverage: record.finalAverage,
            finalOutcome: record.eosyStatus,
            academicDeficiencyNote: record.academicDeficiencyNote,
            reportedGrades: record.enrollmentApplication.reportedGrades,
          }),
        }));
      const historyIdentifiers = historyRows.map(
        (row) => row.learnerIdentifier,
      );
      if (new Set(historyIdentifiers).size !== historyIdentifiers.length) {
        throw new Error(
          "Duplicate learner identifiers were found in the rollover source records.",
        );
      }
      if (historyIdentifiers.length > 0) {
        const existingHistory = await tx.enrollmentHistory.findFirst({
          where: {
            schoolYearId: sourceSchoolYearId,
            learnerIdentifier: { in: historyIdentifiers },
          },
          select: { id: true },
        });
        if (existingHistory) {
          throw new Error(
            "Enrollment history already exists for one or more rollover learners.",
          );
        }
        const createdHistory = await tx.enrollmentHistory.createMany({
          data: historyRows,
        });
        if (createdHistory.count !== sourceRecords.length) {
          throw new Error(
            "Not every source learner was archived into enrollment history.",
          );
        }
      }

      const targetGradeByOrder = new Map(
        gradeLevels.map((grade) => [grade.displayOrder, grade.id]),
      );
      const targetStartYear = Number.parseInt(
        targetYear.yearLabel.split("-")[0] ?? "",
        10,
      );
      let pendingConfirmations = 0;
      let remedialHolds = 0;
      let completers = 0;
      let archiveOnlyDepartures = 0;

      for (const record of sourceRecords) {
        const eosyStatus = record.eosyStatus as EosyStatus;
        const destination = resolveRolloverDestination({
          eosyStatus,
          sourceGradeOrder: record.section.gradeLevel.displayOrder,
        });
        await tx.learner.update({
          where: { id: record.learnerId },
          data: {
            previousGenAve: record.finalAverage,
            lastGradeLevel: record.section.gradeLevel.name,
            lastYearEnrolled: sourceYear.yearLabel,
            promotionStatus: eosyStatus,
            status:
              destination.kind === "JHS_COMPLETER"
                ? "JHS_COMPLETER"
                : destination.kind === "ARCHIVE_ONLY"
                  ? eosyStatus === "TRANSFERRED_OUT"
                    ? "TRANSFERRED_OUT"
                    : "DROPPED"
                  : "ACTIVE",
          },
        });

        if (destination.kind === "JHS_COMPLETER") {
          completers += 1;
          continue;
        }
        if (destination.kind === "ARCHIVE_ONLY") {
          archiveOnlyDepartures += 1;
          continue;
        }

        const targetGradeLevelId = targetGradeByOrder.get(
          destination.targetGradeOrder,
        );
        if (!targetGradeLevelId) {
          throw new Error(
            `Target grade level ${destination.targetGradeOrder} is not configured.`,
          );
        }
        const effectiveProgram =
          record.nextYearCurriculum
          ?? record.enrollmentApplication.assignedProgram
          ?? record.enrollmentApplication.applicantType;
        const application = await tx.enrollmentApplication.create({
          data: {
            learnerId: record.learnerId,
            schoolYearId: targetYear.id,
            gradeLevelId: targetGradeLevelId,
            applicantType: effectiveProgram,
            assignedProgram: effectiveProgram,
            learnerType: "CONTINUING",
            status:
              destination.kind === "REMEDIAL_HOLD"
                ? "REMEDIAL_HOLD"
                : "PENDING_CONFIRMATION",
            admissionChannel: "F2F",
            isPrivacyConsentGiven:
              record.enrollmentApplication.isPrivacyConsentGiven,
            guardianRelationship:
              record.enrollmentApplication.guardianRelationship,
            hasNoMother: record.enrollmentApplication.hasNoMother,
            hasNoFather: record.enrollmentApplication.hasNoFather,
            encodedById:
              record.enrollmentApplication.encodedById ?? actingUserId,
            academicStatus: destination.academicStatus,
            isRemedialRequired: destination.isRemedialRequired,
            confirmationConsent: null,
            contactNumber: record.enrollmentApplication.contactNumber,
            guardianName: record.enrollmentApplication.guardianName,
            addresses:
              record.enrollmentApplication.addresses.length > 0
                ? {
                    createMany: {
                      data: record.enrollmentApplication.addresses,
                    },
                  }
                : undefined,
            familyMembers:
              record.enrollmentApplication.familyMembers.length > 0
                ? {
                    createMany: {
                      data: record.enrollmentApplication.familyMembers,
                    },
                  }
                : undefined,
          },
          select: { id: true },
        });
        await tx.enrollmentApplication.update({
          where: { id: application.id },
          data: {
            trackingNumber:
              `REG-${targetStartYear}-${String(application.id).padStart(5, "0")}`,
          },
        });
        if (destination.kind === "REMEDIAL_HOLD") {
          remedialHolds += 1;
        } else {
          pendingConfirmations += 1;
        }
      }

      const rolloverTime = new Date();
      if (historyIdentifiers.length > 0) {
        const archivedCoverage = await tx.enrollmentHistory.count({
          where: {
            schoolYearId: sourceSchoolYearId,
            learnerIdentifier: { in: historyIdentifiers },
          },
        });
        if (archivedCoverage !== sourceRecords.length) {
          throw new Error(
            "Enrollment history coverage failed before live records were removed.",
          );
        }
      }
      await tx.enrollmentRecord.deleteMany({
        where: { schoolYearId: sourceSchoolYearId },
      });
      await tx.enrollmentApplication.deleteMany({
        where: { schoolYearId: sourceSchoolYearId },
      });
      await tx.sectionAdviser.updateMany({
        where: {
          schoolYearId: sourceSchoolYearId,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          effectiveTo: rolloverTime,
          updatedAt: rolloverTime,
        },
      });
      await tx.schoolYear.update({
        where: { id: sourceSchoolYearId },
        data: {
          status: "ARCHIVED",
          isEosyFinalized: true,
          settingsSnapshot: {
            steEnabled: setting.steEnabled,
            spaEnabled: setting.spaEnabled,
            spsEnabled: setting.spsEnabled,
            enableHomogeneousSections:
              setting.enableHomogeneousSections,
            homogeneousSectionCount:
              setting.homogeneousSectionCount,
            heterogeneousRoundRobin:
              setting.heterogeneousRoundRobin,
          },
        },
      });
      await tx.schoolYear.update({
        where: { id: targetYear.id },
        data: {
          status: "ACTIVE",
          clonedFromId: sourceSchoolYearId,
          isEosyFinalized: false,
        },
      });
      await tx.schoolSetting.update({
        where: { id: setting.id },
        data: {
          activeSchoolYearId: targetYear.id,
          systemPhase: "OFFICIAL_ENROLLMENT",
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          actionType: "SY_ROLLOVER_COMPLETED",
          description:
            `Archived ${sourceYear.yearLabel}, opened ${targetYear.yearLabel}, `
            + `created ${pendingConfirmations} pending enrollment record(s), `
            + `and placed ${remedialHolds} Grade 10 case(s) on remedial hold.`,
          subjectType: "SchoolYear",
          recordId: targetYear.id,
          ipAddress,
          userAgent,
          metadata: {
            archivedRecords: sourceRecords.length,
            pendingConfirmations,
            remedialHolds,
            completers,
            archiveOnlyDepartures,
          },
        },
      });

      return {
        year: targetYear,
        rolloverFrom: {
          id: sourceYear.id,
          yearLabel: sourceYear.yearLabel,
        },
        rolloverSummary: {
          archivedRecords: sourceRecords.length,
          pendingConfirmations,
          remedialHolds,
          completers,
          archiveOnlyDepartures,
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 60_000,
      maxWait: 5_000,
    },
  ));
}
