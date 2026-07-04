import {
  Prisma,
  type ApplicantType,
  type EosyStatus,
  type TermFormat,
} from "../../../generated/prisma/index.js"
import { prisma } from "../../../lib/prisma.js"
import { resolveRolloverDestination } from "./school-year-transition.service.js"

type TransactionClient = Prisma.TransactionClient

export type RolloverBlockerReason =
  | "SECTION_NOT_LOCKED"
  | "LEARNERS_WITHOUT_EOSY_STATUS"

export interface RolloverClassBlocker {
  sectionId: number
  gradeLevel: string
  sectionName: string
  unfinishedLearnerCount: number
  reasons: RolloverBlockerReason[]
}

export interface RolloverReadiness {
  ready: boolean
  schoolYearFinalized: boolean
  blockers: RolloverClassBlocker[]
}

export interface RolloverSchedule {
  classOpeningDate: Date
  classEndDate: Date
  enrollOpenDate: Date
  enrollCloseDate: Date
  term1Start: Date
  term1End: Date
  term2Start: Date
  term2End: Date
  term3Start: Date
  term3End: Date
  term4Start?: Date | null
  term4End?: Date | null
}

export interface ExecuteRolloverInput {
  sourceSchoolYearId: number
  targetYearLabel: string
  schedule: RolloverSchedule
  termFormat: TermFormat
  actingUserId: number
  ipAddress: string
  userAgent: string | null
}

export interface RolloverSummary {
  archivedRecords: number
  pendingConfirmations: number
  remedialHolds: number
  completers: number
  archiveOnlyDepartures: number
}

export interface ExecuteRolloverResult {
  year: {
    id: number
    yearLabel: string
    status: string
  }
  rolloverFrom: {
    id: number
    yearLabel: string
  }
  rolloverSummary: RolloverSummary
}

export class RolloverNotReadyError extends Error {
  readonly code = "ROLLOVER_NOT_READY"
  readonly readiness: RolloverReadiness

  constructor(readiness: RolloverReadiness) {
    const firstBlocker = readiness.blockers[0]
    const message = firstBlocker
      ? `Finish ${firstBlocker.gradeLevel} - ${firstBlocker.sectionName} before starting the new school year.`
      : "Finish and lock the current school year before starting the new one."
    super(message)
    this.name = "RolloverNotReadyError"
    this.readiness = readiness
  }
}

interface SourceSectionSnapshot {
  id: number
  name: string
  maxCapacity: number
  gradeLevelId: number
  programType: ApplicantType
  sortOrder: number
  isHomogeneous: boolean
  isSnake: boolean
  sectionRank: number | null
}

async function getReadiness(
  client: TransactionClient | typeof prisma,
  schoolYearId: number,
): Promise<RolloverReadiness> {
  const schoolYear = await client.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: {
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
          gradeLevel: {
            select: {
              name: true,
              displayOrder: true,
            },
          },
          enrollmentRecords: {
            select: { eosyStatus: true },
          },
        },
      },
    },
  })

  if (!schoolYear) {
    return {
      ready: false,
      schoolYearFinalized: false,
      blockers: [],
    }
  }

  const blockers = schoolYear.sections.flatMap((section) => {
    const recordsWithoutResult = section.enrollmentRecords.filter(
      (record) => record.eosyStatus === null,
    ).length
    const reasons: RolloverBlockerReason[] = []

    if (!section.isEosyFinalized) reasons.push("SECTION_NOT_LOCKED")
    if (recordsWithoutResult > 0) {
      reasons.push("LEARNERS_WITHOUT_EOSY_STATUS")
    }
    if (reasons.length === 0) return []

    return [{
      sectionId: section.id,
      gradeLevel: section.gradeLevel.name,
      sectionName: section.name,
      unfinishedLearnerCount: recordsWithoutResult,
      reasons,
    }]
  })

  return {
    ready: schoolYear.isEosyFinalized && blockers.length === 0,
    schoolYearFinalized: schoolYear.isEosyFinalized,
    blockers,
  }
}

export async function getSchoolYearRolloverReadiness(
  schoolYearId: number,
): Promise<RolloverReadiness> {
  return getReadiness(prisma, schoolYearId)
}

export function getHistoricalProfileSnapshot(record: {
  academicDeficiencyNote?: string | null
  learner: {
    lrn: string | null
    firstName: string
    middleName: string | null
    lastName: string
    extensionName: string | null
    sex: string
    birthdate: Date
  }
  enrollmentApplication: {
    id: number
    applicantType: ApplicantType
    assignedProgram: ApplicantType | null
    learnerType: string
    contactNumber: string | null
    guardianName: string | null
  }
  enrolledBy: {
    firstName: string
    lastName: string
  }
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
    academic: {
      deficiencyNote: record.academicDeficiencyNote ?? "",
    },
  }
}

async function cloneSectionStructure(params: {
  client: TransactionClient
  targetSchoolYearId: number
  sourceSections: SourceSectionSnapshot[]
}): Promise<number> {
  const {
    client,
    targetSchoolYearId,
    sourceSections,
  } = params

  let createdSections = 0

  for (const section of sourceSections) {
    const createdSection = await client.section.create({
      data: {
        name: section.name,
        maxCapacity: section.maxCapacity,
        gradeLevelId: section.gradeLevelId,
        programType: section.programType,
        sortOrder: section.sortOrder,
        isHomogeneous: section.isHomogeneous,
        isSnake: section.isSnake,
        schoolYearId: targetSchoolYearId,
        sectionRank: section.sectionRank,
        isEosyFinalized: false,
      },
      select: { id: true },
    })
    createdSections += 1
  }

  return createdSections
}

export async function repairClonedSchoolYearSections(
  schoolYearId: number,
): Promise<{ repaired: boolean; createdSections: number }> {
  return prisma.$transaction(async (tx) => {
    const schoolYear = await tx.schoolYear.findUnique({
      where: { id: schoolYearId },
      select: {
        id: true,
        clonedFromId: true,
        _count: {
          select: {
            sections: true,
          },
        },
      },
    })

    if (!schoolYear?.clonedFromId || schoolYear._count.sections > 0) {
      return { repaired: false, createdSections: 0 }
    }

    const sourceSections = await tx.section.findMany({
      where: { schoolYearId: schoolYear.clonedFromId },
      orderBy: [
        { gradeLevel: { displayOrder: "asc" } },
        { sortOrder: "asc" },
      ],
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
    })

    if (sourceSections.length === 0) {
      return { repaired: false, createdSections: 0 }
    }

    const createdSections = await cloneSectionStructure({
      client: tx as unknown as TransactionClient,
      targetSchoolYearId: schoolYear.id,
      sourceSections,
    })

    return {
      repaired: createdSections > 0,
      createdSections,
    }
  })
}

export async function executeSchoolYearRollover({
  sourceSchoolYearId,
  targetYearLabel,
  schedule,
  termFormat,
  actingUserId,
  ipAddress,
  userAgent,
}: ExecuteRolloverInput): Promise<ExecuteRolloverResult> {
  return prisma.$transaction(
    async (tx) => {
      const readiness = await getReadiness(
        tx as unknown as TransactionClient,
        sourceSchoolYearId,
      )
      if (!readiness.ready) {
        throw new RolloverNotReadyError(readiness)
      }

      const [sourceYear, sourceRecords, sourceSections, gradeLevels, setting] =
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
                    select: {
                      name: true,
                      displayOrder: true,
                    },
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
        ])

      const targetGradeByOrder = new Map(
        gradeLevels.map((gradeLevel) => [
          gradeLevel.displayOrder,
          gradeLevel.id,
        ]),
      )
      const existingTargetYear = await tx.schoolYear.findUnique({
        where: { yearLabel: targetYearLabel },
        select: { id: true, status: true },
      })
      if (
        existingTargetYear
        && existingTargetYear.status !== "ACTIVE"
        && existingTargetYear.status !== "ARCHIVED"
      ) {
        throw new Error("The next school year is already active or archived.")
      }

      const targetYear = existingTargetYear
        ? await tx.schoolYear.update({
            where: { id: existingTargetYear.id },
            data: {
              status: "ACTIVE",
              clonedFromId: sourceSchoolYearId,
              ...schedule,
              termFormat,
            },
            select: { id: true, yearLabel: true, status: true },
          })
        : await tx.schoolYear.create({
            data: {
              yearLabel: targetYearLabel,
              status: "ACTIVE",
              clonedFromId: sourceSchoolYearId,
              ...schedule,
              termFormat,
            },
            select: { id: true, yearLabel: true, status: true },
          })

      await tx.schoolSetting.updateMany({
        data: {
          systemPhase: "OFFICIAL_ENROLLMENT",
        },
      })

      if (existingTargetYear) {
        await tx.enrollmentRecord.deleteMany({
          where: { schoolYearId: targetYear.id },
        })
        await tx.enrollmentApplication.deleteMany({
          where: { schoolYearId: targetYear.id },
        })
        await tx.section.deleteMany({
          where: { schoolYearId: targetYear.id },
        })
      }

      await cloneSectionStructure({
        client: tx as unknown as TransactionClient,
        targetSchoolYearId: targetYear.id,
        sourceSections,
      })

      if (sourceRecords.length > 0) {
        await tx.enrollmentHistory.createMany({
          data: sourceRecords.map((record) => ({
            learnerId: record.learnerId,
            schoolYearId: record.schoolYearId,
            gradeLevelId: record.section.gradeLevelId,
            sectionId: record.sectionId,
            adviserId: record.section.advisers[0]?.teacherId ?? null,
            genAve: record.finalAverage,
            eosyStatus: record.eosyStatus,
            academicDeficiencyNote: record.academicDeficiencyNote,
            learnerProfileSnapshot: getHistoricalProfileSnapshot(record),
          })),
        })
      }

      const pendingApplicationIds: number[] = []
      let remedialHolds = 0
      let completers = 0
      let archiveOnlyDepartures = 0
      const targetStartYear = Number.parseInt(
        targetYearLabel.split("-")[0] ?? "",
        10,
      )

      for (const record of sourceRecords) {
        const eosyStatus = record.eosyStatus as EosyStatus
        const destination = resolveRolloverDestination({
          eosyStatus,
          sourceGradeOrder: record.section.gradeLevel.displayOrder,
        })

        await tx.learner.update({
          where: { id: record.learnerId },
          data: {
            previousGenAve: record.finalAverage,
            lastGradeLevel: record.section.gradeLevel.name,
            lastYearEnrolled: sourceYear.yearLabel,
            promotionStatus: eosyStatus,
            ...(destination.kind === "JHS_COMPLETER"
              ? { status: "JHS_COMPLETER" as const }
              : destination.kind === "ARCHIVE_ONLY"
                ? {
                    status:
                      eosyStatus === "TRANSFERRED_OUT"
                        ? "TRANSFERRED_OUT" as const
                        : "DROPPED" as const,
                  }
                : { status: "ACTIVE" as const }),
          },
        })

        if (destination.kind === "JHS_COMPLETER") {
          completers += 1
          continue
        }
        if (destination.kind === "ARCHIVE_ONLY") {
          archiveOnlyDepartures += 1
          continue
        }
        const targetGradeLevelId = targetGradeByOrder.get(
          destination.targetGradeOrder,
        )
        if (!targetGradeLevelId) {
          throw new Error(
            `Target grade level ${destination.targetGradeOrder} is not configured.`,
          )
        }

        const effectiveProgram =
          record.nextYearCurriculum
          ?? record.enrollmentApplication.assignedProgram
          ?? record.enrollmentApplication.applicantType
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
        })
        if (destination.kind === "REMEDIAL_HOLD") {
          remedialHolds += 1
        } else {
          pendingApplicationIds.push(application.id)
        }

        const trackingNumber = `REG-${targetStartYear}-${String(application.id).padStart(5, "0")}`
        await tx.enrollmentApplication.update({
          where: { id: application.id },
          data: { trackingNumber },
        })
      }

      await tx.enrollmentRecord.deleteMany({
        where: { schoolYearId: sourceSchoolYearId },
      })
      await tx.enrollmentApplication.deleteMany({
        where: { schoolYearId: sourceSchoolYearId },
      })
      await tx.sectionAdviser.updateMany({
        where: {
          schoolYearId: sourceSchoolYearId,
          status: "ACTIVE",
        },
        data: {
          status: "REVOKED",
          effectiveTo: new Date(),
          updatedAt: new Date(),
        },
      })
      await tx.schoolYear.update({
        where: { id: sourceSchoolYearId },
        data: {
          status: "ARCHIVED",
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
      })
      await tx.schoolSetting.updateMany({
        data: {
          activeSchoolYearId: targetYear.id,
          systemPhase: "OFFICIAL_ENROLLMENT",
        },
      })
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          actionType: "SY_ROLLOVER_COMPLETED",
          description:
            `Archived ${sourceYear.yearLabel}, opened ${targetYear.yearLabel}, created ${pendingApplicationIds.length} pending confirmation record(s), and placed ${remedialHolds} Grade 10 case(s) on remedial hold.`,
          subjectType: "SchoolYear",
          recordId: targetYear.id,
          ipAddress,
          userAgent,
        },
      })

      return {
        year: targetYear,
        rolloverFrom: sourceYear,
        rolloverSummary: {
          archivedRecords: sourceRecords.length,
          pendingConfirmations: pendingApplicationIds.length,
          remedialHolds,
          completers,
          archiveOnlyDepartures,
        },
      }
    },
    {
      timeout: 30_000,
      maxWait: 5_000,
    },
  )
}
