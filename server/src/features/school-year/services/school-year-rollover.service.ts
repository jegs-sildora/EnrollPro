import {
  Prisma,
  type ApplicantType,
  type EosyStatus,
} from "../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import { getSchoolFormArtifactStatus } from "../../enrollment/services/school-form-artifact.service.js";
import { resolveRolloverDestination } from "./school-year-transition.service.js";

type DatabaseClient = Pick<
  typeof prisma,
  | "schoolYear"
  | "schoolSetting"
  | "schoolYearCalendarPolicy"
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
    | "CALENDAR_POLICY_REQUIRED"
    | "CALENDAR_POLICY_NOT_APPROVED"
    | "CALENDAR_POLICY_YEAR_MISMATCH"
    | "SF6_NOT_RECORDED"
    | "SF6_STALE"
    | "TARGET_YEAR_HAS_RECORDS"
    | "ANOTHER_ACTIVE_YEAR_EXISTS";
  message: string;
}

export interface RolloverReadiness {
  ready: boolean;
  schoolYearFinalized: boolean;
  blockers: RolloverClassBlocker[];
  globalBlockers: RolloverGlobalBlocker[];
  calendarPolicy: {
    id: number;
    yearLabel: string;
    version: number;
    status: string;
    depedIssuance: string;
  } | null;
  formStatus: {
    currentSf5Count: number;
    totalSections: number;
    sf6Recorded: boolean;
    sf6Current: boolean;
  };
}

export interface ExecuteRolloverInput {
  sourceSchoolYearId: number;
  calendarPolicyId: number;
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
): Promise<{ id: number; count: number } | null> {
  const target = await client.schoolYear.findUnique({
    where: { yearLabel: targetYearLabel },
    select: {
      id: true,
      _count: {
        select: {
          sections: true,
          enrollmentApplications: true,
          enrollmentRecords: true,
          enrollmentHistories: true,
          sectionAdvisers: true,
          teacherDesignations: true,
          teacherSchedulePeriods: true,
        },
      },
    },
  });
  if (!target) return null;
  return {
    id: target.id,
    count: Object.values(target._count).reduce(
      (total, count) => total + count,
      0,
    ),
  };
}

async function getReadiness(
  client: DatabaseClient,
  schoolYearId: number,
  calendarPolicyId?: number,
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
              eosyStatus: true,
              smartAcademicOutcome: {
                select: { finalOutcome: true },
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
      calendarPolicy: null,
      formStatus: {
        currentSf5Count: 0,
        totalSections: 0,
        sf6Recorded: false,
        sf6Current: false,
      },
    };
  }

  const expectedTargetLabel = nextYearLabel(sourceYear.yearLabel);
  const [setting, requestedPolicy] = await Promise.all([
    client.schoolSetting.findFirst({
      select: { activeSchoolYearId: true, systemPhase: true },
    }),
    calendarPolicyId
      ? client.schoolYearCalendarPolicy.findUnique({
          where: { id: calendarPolicyId },
          select: {
            id: true,
            yearLabel: true,
            version: true,
            status: true,
            depedIssuance: true,
          },
        })
      : expectedTargetLabel
        ? client.schoolYearCalendarPolicy.findFirst({
            where: {
              yearLabel: expectedTargetLabel,
              status: "APPROVED",
            },
            orderBy: { version: "desc" },
            select: {
              id: true,
              yearLabel: true,
              version: true,
              status: true,
              depedIssuance: true,
            },
          })
        : null,
  ]);

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
  if (!requestedPolicy) {
    globalBlockers.push({
      code: "CALENDAR_POLICY_REQUIRED",
      message:
        "Encode and approve the official DepEd calendar for the incoming school year.",
    });
  } else {
    if (requestedPolicy.status !== "APPROVED") {
      globalBlockers.push({
        code: "CALENDAR_POLICY_NOT_APPROVED",
        message:
          "The incoming school-year calendar must be approved before rollover.",
      });
    }
    if (requestedPolicy.yearLabel !== expectedTargetLabel) {
      globalBlockers.push({
        code: "CALENDAR_POLICY_YEAR_MISMATCH",
        message:
          "The approved calendar does not match the incoming school year.",
      });
    }
  }

  let currentSf5Count = 0;
  const blockers: RolloverClassBlocker[] = [];
  for (const section of sourceYear.sections) {
    const reasons: RolloverBlockerReason[] = [];
    const recordsWithoutResult = section.enrollmentRecords.filter(
      (record) => record.eosyStatus === null,
    ).length;
    const missingSmartOutcomes = section.enrollmentRecords.filter(
      (record) =>
        !isDeparture(record.eosyStatus)
        && record.smartAcademicOutcome === null,
    ).length;
    const mismatchedSmartOutcomes = section.enrollmentRecords.filter(
      (record) =>
        record.smartAcademicOutcome
        && record.eosyStatus !== record.smartAcademicOutcome.finalOutcome,
    ).length;

    if (!section.isEosyFinalized) reasons.push("SECTION_NOT_FINALIZED");
    if (recordsWithoutResult > 0) {
      reasons.push("LEARNER_RESULT_NOT_FINALIZED");
    }
    if (missingSmartOutcomes > 0) reasons.push("SMART_OUTCOME_MISSING");
    if (mismatchedSmartOutcomes > 0) {
      reasons.push("SMART_OUTCOME_MISMATCH");
    }

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
        unfinishedLearnerCount:
          recordsWithoutResult
          + missingSmartOutcomes
          + mismatchedSmartOutcomes,
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

  if (requestedPolicy) {
    const target = await getTargetOperationalCount(
      client,
      requestedPolicy.yearLabel,
    );
    if (target && target.id !== sourceYear.id && target.count > 0) {
      globalBlockers.push({
        code: "TARGET_YEAR_HAS_RECORDS",
        message:
          "The incoming school year already contains operational records. Rollover will not delete them.",
      });
    }
    const otherActive = await client.schoolYear.findFirst({
      where: {
        status: "ACTIVE",
        id: {
          notIn: [sourceYear.id, ...(target ? [target.id] : [])],
        },
      },
      select: { id: true },
    });
    if (otherActive) {
      globalBlockers.push({
        code: "ANOTHER_ACTIVE_YEAR_EXISTS",
        message:
          "Another active school year must be resolved before rollover.",
      });
    }
  }

  return {
    ready: blockers.length === 0 && globalBlockers.length === 0,
    schoolYearFinalized: sourceYear.isEosyFinalized,
    blockers,
    globalBlockers,
    calendarPolicy: requestedPolicy,
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
  calendarPolicyId?: number,
): Promise<RolloverReadiness> {
  return getReadiness(prisma, schoolYearId, calendarPolicyId);
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
    contactNumber: string | null;
    guardianName: string | null;
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
    contactNumber: record.enrollmentApplication.contactNumber ?? "",
    guardianName: record.enrollmentApplication.guardianName ?? "",
    enrolledBy: {
      firstName: record.enrolledBy.firstName,
      lastName: record.enrolledBy.lastName,
    },
  };
}

function academicOutcomeSnapshot(
  outcome: {
    finalGeneralAverage: number;
    finalOutcome: string;
    smartRevision: string;
    publishedAt: Date;
    syncedAt: Date;
    payloadHash: string;
    learningAreaResults: Array<{
      learningAreaCode: string;
      learningAreaName: string;
      finalGrade: number;
      result: string;
    }>;
  } | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!outcome) return Prisma.JsonNull;
  return {
    finalGeneralAverage: outcome.finalGeneralAverage,
    finalOutcome: outcome.finalOutcome,
    smartRevision: outcome.smartRevision,
    publishedAt: outcome.publishedAt.toISOString(),
    syncedAt: outcome.syncedAt.toISOString(),
    payloadHash: outcome.payloadHash,
    learningAreas: outcome.learningAreaResults.map((area) => ({
      code: area.learningAreaCode,
      name: area.learningAreaName,
      finalGrade: area.finalGrade,
      result: area.result,
    })),
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
  calendarPolicyId,
  actingUserId,
  ipAddress,
  userAgent,
}: ExecuteRolloverInput): Promise<ExecuteRolloverResult> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceSchoolYearId})`;
      const readiness = await getReadiness(
        tx,
        sourceSchoolYearId,
        calendarPolicyId,
      );
      if (!readiness.ready) {
        throw new RolloverNotReadyError(readiness);
      }

      const [sourceYear, sourceRecords, sourceSections, gradeLevels, setting, policy] =
        await Promise.all([
          tx.schoolYear.findUniqueOrThrow({
            where: { id: sourceSchoolYearId },
            select: { id: true, yearLabel: true },
          }),
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
              smartAcademicOutcome: {
                include: {
                  learningAreaResults: {
                    orderBy: { learningAreaCode: "asc" },
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
          tx.schoolSetting.findFirst(),
          tx.schoolYearCalendarPolicy.findUniqueOrThrow({
            where: { id: calendarPolicyId },
          }),
        ]);

      const targetOperational = await getTargetOperationalCount(
        tx,
        policy.yearLabel,
      );
      if (targetOperational?.count) {
        throw new Error(
          "The incoming school year contains operational records and cannot be overwritten.",
        );
      }

      const targetYear = targetOperational
        ? await tx.schoolYear.update({
            where: { id: targetOperational.id },
            data: {
              status: "ACTIVE",
              clonedFromId: sourceSchoolYearId,
              calendarPolicyId: policy.id,
              classOpeningDate: policy.classOpeningDate,
              classEndDate: policy.classEndDate,
              enrollOpenDate: policy.enrollOpenDate,
              enrollCloseDate: policy.enrollCloseDate,
              termFormat: policy.termFormat,
              term1Start: policy.term1Start,
              term1End: policy.term1End,
              term2Start: policy.term2Start,
              term2End: policy.term2End,
              term3Start: policy.term3Start,
              term3End: policy.term3End,
              term4Start: policy.term4Start,
              term4End: policy.term4End,
              isEosyFinalized: false,
            },
            select: { id: true, yearLabel: true, status: true },
          })
        : await tx.schoolYear.create({
            data: {
              yearLabel: policy.yearLabel,
              status: "ACTIVE",
              clonedFromId: sourceSchoolYearId,
              calendarPolicyId: policy.id,
              classOpeningDate: policy.classOpeningDate,
              classEndDate: policy.classEndDate,
              enrollOpenDate: policy.enrollOpenDate,
              enrollCloseDate: policy.enrollCloseDate,
              termFormat: policy.termFormat,
              term1Start: policy.term1Start,
              term1End: policy.term1End,
              term2Start: policy.term2Start,
              term2End: policy.term2End,
              term3Start: policy.term3Start,
              term3End: policy.term3End,
              term4Start: policy.term4Start,
              term4End: policy.term4End,
            },
            select: { id: true, yearLabel: true, status: true },
          });

      await cloneSectionStructure({
        client: tx,
        targetSchoolYearId: targetYear.id,
        sourceSections,
      });

      await tx.enrollmentHistory.createMany({
        data: sourceRecords.map((record) => ({
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
          academicOutcomeSnapshot: academicOutcomeSnapshot(
            record.smartAcademicOutcome,
          ),
        })),
        skipDuplicates: true,
      });

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
          settingsSnapshot: setting
            ? {
                steEnabled: setting.steEnabled,
                spaEnabled: setting.spaEnabled,
                spsEnabled: setting.spsEnabled,
                enableHomogeneousSections:
                  setting.enableHomogeneousSections,
                homogeneousSectionCount:
                  setting.homogeneousSectionCount,
                heterogeneousRoundRobin:
                  setting.heterogeneousRoundRobin,
              }
            : undefined,
        },
      });
      await tx.schoolYearCalendarPolicy.update({
        where: { id: policy.id },
        data: {
          status: "APPLIED",
          appliedAt: rolloverTime,
        },
      });
      await tx.schoolSetting.updateMany({
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
            calendarPolicyId: policy.id,
            calendarPolicyVersion: policy.version,
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
        rolloverFrom: sourceYear,
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
  );
}
