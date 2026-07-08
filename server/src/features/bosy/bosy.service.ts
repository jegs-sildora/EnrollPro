// Refreshed status enum support
import {
  Prisma,
  ApplicationStatus,
  ApplicantType,
  type EosyStatus,
} from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import { resolveRolloverDestination } from "../school-year/services/school-year-transition.service.js";
import { classifyDocumentReadiness } from "./bosy-intake-policy.service.js";

export type BOSYQueueState =
  | "PENDING"
  | "CONFIRMED"
  | "TEMPORARY"
  | "TRANSFER_REQUEST"
  | "ENROLLED";

export interface BOSYReadiness {
  schoolYearId: number;
  schoolYearLabel: string;
  isEosyFinalized: boolean;
  irregularBlockerCount: number;
  pendingConfirmationCount: number;
  confirmedReadyCount: number;
  temporarilyEnrolledCount: number;
  readyForSectioningCount: number;
  enrolledCount: number;
  jhsCompleterCount: number;
  transferRequestCount: number;
  // Phase 2 BEEF intake counts
  scpPriorityCount: number;
  onlineBeefCount: number;
  walkInBeefCount: number;
  pendingBeefCount: number;
}

export interface Phase2QueueItem {
  applicationId: number;
  trackingNumber: string | null;
  status: string;
  admissionChannel: string;
  applicantType: string;
  learnerType: string;
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gradeLevelId: number;
  gradeLevelName: string;
}

export interface Phase2QueuePage {
  items: Phase2QueueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface BOSYQueueItem {
  applicationId: number;
  trackingNumber: string | null;
  status: string;
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gradeLevelId: number;
  gradeLevelName: string;
  gradeLevelDisplayOrder: number;
  academicStatus: string | null;
  isRemedialRequired: boolean;
  isTemporarilyEnrolled: boolean;
  credentialStatus: "COMPLETE" | "PENDING";
  missingDocuments: string[];
  priorSectionName: string | null;
  priorAdviserName: string | null;
  priorYearGenAve: number | null;
  priorYearDeficiencyNote: string | null;
}

export interface JHSCompleter {
  learnerId: number;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  lastGradeLevel: string | null;
  lastYearEnrolled: string | null;
  lastSectionName: string | null;
}

export interface BOSYQueuePage {
  items: BOSYQueueItem[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkConfirmResult {
  confirmed: number[];
  readyForSectioning: number[];
  temporarilyEnrolled: number[];
  failed: Array<{ id: number; reason: string }>;
}

export interface ConfirmReturnResult {
  applicationId: number;
  status: string;
  intakeState: "CONFIRMED" | "TEMPORARY";
  missingDocuments: string[];
}

interface BOSYRolloverRepairSource {
  learnerId: number;
  eosyStatus: EosyStatus;
  sourceGradeOrder: number;
  applicantType: ApplicantType;
  assignedProgram: ApplicantType | null;
  isPrivacyConsentGiven: boolean;
  guardianRelationship: string | null;
  hasNoMother: boolean;
  hasNoFather: boolean;
  contactNumber: string | null;
  guardianName: string | null;
}

function isJsonObject(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSnapshotString(
  snapshot: Prisma.JsonValue | null | undefined,
  key: string,
): string | null {
  if (!isJsonObject(snapshot)) return null;
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readSnapshotApplicantType(
  snapshot: Prisma.JsonValue | null | undefined,
  key: string,
): ApplicantType | null {
  const value = readSnapshotString(snapshot, key);
  return value &&
    Object.values(ApplicantType).includes(value as ApplicantType)
    ? (value as ApplicantType)
    : null;
}

function readSnapshotObject(
  snapshot: Prisma.JsonValue | null | undefined,
  key: string,
): Prisma.JsonObject | null {
  if (!isJsonObject(snapshot)) return null;
  const value = snapshot[key];
  return isJsonObject(value) ? value : null;
}

function readSnapshotStringFromObject(
  snapshot: Prisma.JsonValue | null | undefined,
  parentKey: string,
  childKey: string,
): string | null {
  const parent = readSnapshotObject(snapshot, parentKey);
  if (!parent) return null;
  const value = parent[childKey];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractDeficiencyNote(
  snapshot: Prisma.JsonValue | null | undefined,
): string | null {
  const directKeys = [
    "deficiencyNote",
    "deficiencyNotes",
    "backSubject",
    "backSubjects",
    "remedialNote",
    "remedialSubject",
  ];
  for (const key of directKeys) {
    const value = readSnapshotString(snapshot, key);
    if (value) return value;
  }

  const nestedPairs = [
    ["learner", "deficiencyNote"],
    ["learner", "backSubject"],
    ["learner", "remedialSubject"],
    ["academic", "deficiencyNote"],
    ["academic", "backSubject"],
    ["academic", "remedialSubject"],
  ] as const;

  for (const [parentKey, childKey] of nestedPairs) {
    const value = readSnapshotStringFromObject(snapshot, parentKey, childKey);
    if (value) return value;
  }

  return null;
}

export async function getBOSYReadiness(
  schoolYearId: number,
): Promise<BOSYReadiness> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: {
      id: true,
      yearLabel: true,
      isEosyFinalized: true,
      clonedFromId: true,
    },
  });

  if (!schoolYear) {
    throw Object.assign(new Error("School year not found."), { status: 404 });
  }

  const [
    irregularBlockerCount,
    existingPendingCount,
    confirmedReadyCount,
    temporarilyEnrolledCount,
    enrolledCount,
    jhsCompleterCount,
    transferRequestCount,
    scpPriorityCount,
    onlineBeefCount,
    walkInBeefCount,
    pendingBeefCount,
  ] = await Promise.all([
    prisma.enrollmentRecord.count({
      where: { schoolYearId, eosyStatus: "CONDITIONALLY_PROMOTED" },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: "PENDING_CONFIRMATION",
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: "READY_FOR_SECTIONING",
        isTemporarilyEnrolled: false,
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: "READY_FOR_SECTIONING",
        isTemporarilyEnrolled: true,
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: {
          in: ["OFFICIALLY_ENROLLED", "ENROLLED", "SECTIONED"],
        },
      },
    }),
    prisma.learner.count({
      where: { status: "JHS_COMPLETER" },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: "TRANSFERRING_OUT",
      },
    }),
    // Phase 2: SCP Priority (passed screening, returning for physical BEEF)
    prisma.enrollmentApplication.count({
      where: { schoolYearId, status: "VERIFIED" },
    }),
    // Phase 2: Online Digital BEEF (submitted via Learner Portal)
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        status: "VERIFIED",
        admissionChannel: "ONLINE",
      },
    }),
    // Phase 2: Walk-In BEEF (encoded F2F on site)
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        status: "VERIFIED",
        admissionChannel: "F2F",
      },
    }),
    // Phase 2: Pending / Incomplete (docs missing after BEEF submission)
    prisma.enrollmentApplication.count({
      where: { schoolYearId, status: "VERIFIED" },
    }),
  ]);

  return {
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.yearLabel,
    isEosyFinalized: schoolYear.isEosyFinalized,
    irregularBlockerCount,
    pendingConfirmationCount: existingPendingCount,
    confirmedReadyCount,
    temporarilyEnrolledCount,
    readyForSectioningCount:
      confirmedReadyCount + temporarilyEnrolledCount,
    enrolledCount,
    jhsCompleterCount,
    transferRequestCount,
    scpPriorityCount,
    onlineBeefCount,
    walkInBeefCount,
    pendingBeefCount,
  };
}

export async function getBOSYQueue(params: {
  schoolYearId: number;
  gradeLevelId?: number;
  targetGradeOrder?: number;
  queueState?: BOSYQueueState;
  status?: string;
  search?: string;
  previousSectionName?: string;
  curricularProgram?: string;
  page: number;
  limit: number;
}): Promise<BOSYQueuePage> {
  const {
    schoolYearId,
    gradeLevelId,
    targetGradeOrder,
    queueState,
    status,
    search,
    previousSectionName,
    curricularProgram,
    page,
    limit,
  } = params;
  const skip = (page - 1) * limit;
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { clonedFromId: true },
  });
  const previousSchoolYearId = schoolYear?.clonedFromId ?? null;
  const learnerConditions: Prisma.LearnerWhereInput[] = [];

  if (search) {
    learnerConditions.push({
      AND: search.split(/\s+/).filter(Boolean).map((term) => ({
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { lrn: { contains: term, mode: "insensitive" } },
        ],
      })),
    });
  }
  if (previousSectionName && previousSchoolYearId) {
    learnerConditions.push({
      enrollmentHistories: {
        some: {
          schoolYearId: previousSchoolYearId,
          section: { name: previousSectionName },
        },
      },
    });
  }

  const where: Prisma.EnrollmentApplicationWhereInput = {
    schoolYearId,
    learnerType: "CONTINUING" as const,
    ...(gradeLevelId ? { gradeLevelId } : {}),
    ...(targetGradeOrder
      ? { gradeLevel: { displayOrder: targetGradeOrder } }
      : {}),
    ...(curricularProgram && curricularProgram !== "ALL"
      ? {
        OR: [
          { applicantType: curricularProgram as ApplicantType },
          { assignedProgram: curricularProgram as ApplicantType },
        ],
      }
      : {}),
    ...(queueState
      ? {
        ...getQueueStateWhere(queueState),
      }
      : status
        ? {
          status:
            status.trim() === "ENROLLED"
              ? {
                in: [
                  "OFFICIALLY_ENROLLED",
                  "ENROLLED",
                  "SECTIONED",
                ] as ApplicationStatus[],
              }
              : (status.trim() as ApplicationStatus),
        }
        : {}),
    ...(learnerConditions.length > 0
      ? { learner: { AND: learnerConditions } }
      : {}),
  };

  const [applicationsRaw, total] = await Promise.all([
    prisma.enrollmentApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        { learner: { lastName: "asc" } },
        { learner: { firstName: "asc" } },
      ],
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        gradeLevel: {
          select: { id: true, name: true, displayOrder: true },
        },
        academicStatus: true,
        isRemedialRequired: true,
        isTemporarilyEnrolled: true,
        isMissingSf9: true,
        hasSf9CertificationLetter: true,
        learner: {
          select: {
            id: true,
            lrn: true,
            firstName: true,
            lastName: true,
            middleName: true,
            hasPsaBirthCertificate: true,
            missingRequirements: true,
          },
        },
      },
    }),
    prisma.enrollmentApplication.count({ where }),
  ]);

  const applications = applicationsRaw;

  // Resolve prior-year section and adviser for each learner in one batch
  const learnerIds = applications.map((a) => a.learner.id);
  const priorRecords = previousSchoolYearId
    ? await prisma.enrollmentHistory.findMany({
      where: {
        learnerId: { in: learnerIds },
        schoolYearId: previousSchoolYearId,
      },
      orderBy: { createdAt: "desc" },
      distinct: ["learnerId"],
      select: {
        learnerId: true,
        genAve: true,
        academicDeficiencyNote: true,
        learnerProfileSnapshot: true,
        section: {
          select: {
            name: true,
          },
        },
        adviser: {
          select: { firstName: true, lastName: true },
        },
      },
    })
    : [];

  const priorByLearner = new Map(
    priorRecords.map((record) => [
      record.learnerId,
      {
        section: record.section,
        adviser: record.adviser,
        genAve: record.genAve,
        deficiencyNote:
          record.academicDeficiencyNote
          ?? extractDeficiencyNote(record.learnerProfileSnapshot),
      },
    ]),
  );

  const items: BOSYQueueItem[] = applications.map((a) => {
    const prior = priorByLearner.get(a.learner.id) ?? null;
    const section = prior?.section ?? null;
    const adviser = prior?.adviser ?? null;
    const documentReadiness = classifyDocumentReadiness({
      isMissingSf9: a.isMissingSf9,
      hasSf9CertificationLetter: a.hasSf9CertificationLetter,
      hasPsaBirthCertificate: a.learner.hasPsaBirthCertificate,
      missingRequirements: a.learner.missingRequirements,
    });
    return {
      applicationId: a.id,
      trackingNumber: a.trackingNumber,
      status: a.status,
      learnerId: a.learner.id,
      lrn: a.learner.lrn,
      firstName: a.learner.firstName,
      lastName: a.learner.lastName,
      middleName: a.learner.middleName,
      gradeLevelId: a.gradeLevel.id,
      gradeLevelName: a.gradeLevel.name,
      gradeLevelDisplayOrder: a.gradeLevel.displayOrder,
      academicStatus: a.academicStatus ?? null,
      isRemedialRequired: a.isRemedialRequired,
      isTemporarilyEnrolled: a.isTemporarilyEnrolled,
      credentialStatus: documentReadiness.isTemporarilyEnrolled
        ? "PENDING"
        : "COMPLETE",
      missingDocuments: documentReadiness.missingDocuments,
      priorSectionName: section?.name ?? null,
      priorAdviserName: adviser
        ? `${adviser.firstName} ${adviser.lastName}`.trim()
        : null,
      priorYearGenAve: prior?.genAve ?? null,
      priorYearDeficiencyNote: prior?.deficiencyNote ?? null,
    };
  });

  return { items, total, page, limit };
}

function getQueueStateWhere(
  queueState: BOSYQueueState,
): Prisma.EnrollmentApplicationWhereInput {
  switch (queueState) {
    case "PENDING":
      return { status: "PENDING_CONFIRMATION" }
    case "CONFIRMED":
      return {
        status: "READY_FOR_SECTIONING",
        isTemporarilyEnrolled: false,
      }
    case "TEMPORARY":
      return {
        status: "READY_FOR_SECTIONING",
        isTemporarilyEnrolled: true,
      }
    case "TRANSFER_REQUEST":
      return { status: "TRANSFERRING_OUT" }
    case "ENROLLED":
      return {
        status: {
          in: ["OFFICIALLY_ENROLLED", "ENROLLED", "SECTIONED"],
        },
      }
  }
}

export async function getPreviousSections(schoolYearId: number): Promise<string[]> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { clonedFromId: true },
  });

  if (!schoolYear?.clonedFromId) return [];

  const sections = await prisma.section.findMany({
    where: { schoolYearId: schoolYear.clonedFromId },
    select: { name: true },
    orderBy: { name: "asc" },
  });

  return sections.map((s) => s.name);
}

export async function syncBOSYQueue(
  schoolYearId: number,
  actingUserId: number,
): Promise<{ created: number; remedialHolds: number }> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, yearLabel: true, clonedFromId: true },
  });

  if (!schoolYear || !schoolYear.clonedFromId) {
    return { created: 0, remedialHolds: 0 };
  }

  const prevSchoolYearId = schoolYear.clonedFromId;
  const parsedStartYear = Number.parseInt(
    schoolYear.yearLabel.split("-")[0]?.trim() ?? "",
    10,
  );
  const startYear = Number.isFinite(parsedStartYear)
    ? parsedStartYear
    : new Date().getFullYear();

  const liveSourceRecords = await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: prevSchoolYearId,
      eosyStatus: { not: null },
    },
    select: {
      eosyStatus: true,
      learnerId: true,
      enrollmentApplication: {
        select: {
          applicantType: true,
          assignedProgram: true,
          isPrivacyConsentGiven: true,
          guardianRelationship: true,
          hasNoMother: true,
          hasNoFather: true,
          contactNumber: true,
          guardianName: true,
        },
      },
      section: {
        select: {
          gradeLevel: { select: { displayOrder: true } },
        },
      },
    },
  });
  const sourceRecords: BOSYRolloverRepairSource[] =
    liveSourceRecords.flatMap((record) =>
      record.eosyStatus
        ? [{
          learnerId: record.learnerId,
          eosyStatus: record.eosyStatus,
          sourceGradeOrder: record.section.gradeLevel.displayOrder,
          applicantType: record.enrollmentApplication.applicantType,
          assignedProgram: record.enrollmentApplication.assignedProgram,
          isPrivacyConsentGiven:
            record.enrollmentApplication.isPrivacyConsentGiven,
          guardianRelationship:
            record.enrollmentApplication.guardianRelationship,
          hasNoMother: record.enrollmentApplication.hasNoMother,
          hasNoFather: record.enrollmentApplication.hasNoFather,
          contactNumber: record.enrollmentApplication.contactNumber,
          guardianName: record.enrollmentApplication.guardianName,
        }]
        : [],
    );

  if (sourceRecords.length === 0) {
    const archivedSourceRecords = await prisma.enrollmentHistory.findMany({
      where: {
        schoolYearId: prevSchoolYearId,
        eosyStatus: { not: null },
      },
      select: {
        learnerId: true,
        eosyStatus: true,
        learnerProfileSnapshot: true,
        gradeLevel: { select: { displayOrder: true } },
      },
    });

    for (const record of archivedSourceRecords) {
      if (!record.eosyStatus) continue;
      const applicantType =
        readSnapshotApplicantType(
          record.learnerProfileSnapshot,
          "applicantType",
        ) ?? ApplicantType.REGULAR;
      sourceRecords.push({
        learnerId: record.learnerId,
        eosyStatus: record.eosyStatus,
        sourceGradeOrder: record.gradeLevel.displayOrder,
        applicantType,
        assignedProgram:
          readSnapshotApplicantType(
            record.learnerProfileSnapshot,
            "assignedProgram",
          ) ?? applicantType,
        isPrivacyConsentGiven: false,
        guardianRelationship: null,
        hasNoMother: false,
        hasNoFather: false,
        contactNumber: readSnapshotString(
          record.learnerProfileSnapshot,
          "contactNumber",
        ),
        guardianName: readSnapshotString(
          record.learnerProfileSnapshot,
          "guardianName",
        ),
      });
    }
  }

  // Find existing applications to avoid duplicates
  const existingApplications = await prisma.enrollmentApplication.findMany({
    where: { schoolYearId },
    select: { learnerId: true },
  });
  const existingLearnerIds = new Set(
    existingApplications.map((a) => a.learnerId),
  );

  const gradeLevels = await prisma.gradeLevel.findMany({
    select: { id: true, displayOrder: true },
  });
  const gradeLevelByOrder = new Map(
    gradeLevels.map((g) => [g.displayOrder, g.id]),
  );

  let createdCount = 0;
  let remedialHolds = 0;

  for (const record of sourceRecords) {
    if (existingLearnerIds.has(record.learnerId)) continue;

    const destination = resolveRolloverDestination({
      eosyStatus: record.eosyStatus,
      sourceGradeOrder: record.sourceGradeOrder,
    });

    if (destination.kind === "JHS_COMPLETER") {
      await prisma.learner.update({
        where: { id: record.learnerId },
        data: { status: "JHS_COMPLETER" },
      });
      continue;
    }
    if (destination.kind === "ARCHIVE_ONLY") {
      await prisma.learner.update({
        where: { id: record.learnerId },
        data: {
          status:
            record.eosyStatus === "TRANSFERRED_OUT"
              ? "TRANSFERRED_OUT"
              : "DROPPED",
        },
      });
      continue;
    }

    const targetGradeLevelId = gradeLevelByOrder.get(
      destination.targetGradeOrder,
    );
    if (!targetGradeLevelId) continue;

    const newApp = await prisma.enrollmentApplication.upsert({
      where: {
        uq_enrollment_learner_sy: {
          learnerId: record.learnerId,
          schoolYearId,
        },
      },
      update: {},
      create: {
        learnerId: record.learnerId,
        schoolYearId,
        gradeLevelId: targetGradeLevelId,
        applicantType: record.assignedProgram ?? record.applicantType,
        assignedProgram: record.assignedProgram ?? record.applicantType,
        learnerType: "CONTINUING",
        learningModalities: [],
        status:
          destination.kind === "REMEDIAL_HOLD"
            ? "REMEDIAL_HOLD"
            : "PENDING_CONFIRMATION",
        admissionChannel: "F2F",
        isPrivacyConsentGiven: record.isPrivacyConsentGiven,
        guardianRelationship: record.guardianRelationship,
        hasNoMother: record.hasNoMother,
        hasNoFather: record.hasNoFather,
        contactNumber: record.contactNumber,
        guardianName: record.guardianName,
        encodedById: actingUserId,
        academicStatus: destination.academicStatus,
        isRemedialRequired: destination.isRemedialRequired,
      },
    });

    const trackingNumber = `REG-${startYear}-${String(newApp.id).padStart(5, "0")}`;
    await prisma.enrollmentApplication.update({
      where: { id: newApp.id },
      data: { trackingNumber },
    });

    existingLearnerIds.add(record.learnerId);
    createdCount++;
    if (destination.kind === "REMEDIAL_HOLD") {
      remedialHolds++;
    }
  }

  return { created: createdCount, remedialHolds };
}

export async function confirmReturn(
  applicationId: number,
  actingUserId: number,
): Promise<ConfirmReturnResult> {
  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      learnerType: true,
      isMissingSf9: true,
      hasSf9CertificationLetter: true,
      gradeLevel: { select: { displayOrder: true } },
      learner: {
        select: {
          id: true, lrn: true, firstName: true, lastName: true,
          hasPsaBirthCertificate: true, missingRequirements: true
        },
      },
    },
  });

  if (!application) {
    throw Object.assign(new Error("Application not found."), { status: 404 });
  }

  if (application.status !== "PENDING_CONFIRMATION") {
    throw Object.assign(
      new Error(
        `Cannot confirm return: application is in status "${application.status}", expected "PENDING_CONFIRMATION".`,
      ),
      { status: 422 },
    );
  }

  const documentReadiness = classifyDocumentReadiness({
    isMissingSf9: application.isMissingSf9,
    hasSf9CertificationLetter: application.hasSf9CertificationLetter,
    hasPsaBirthCertificate: application.learner.hasPsaBirthCertificate,
    missingRequirements: application.learner.missingRequirements,
  });

  const setting = await prisma.schoolSetting.findFirst({ select: { systemPhase: true } });

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "READY_FOR_SECTIONING",
      confirmationConsent: true,
      encodedById: actingUserId,
      isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
      isTemporarilyEnrolled: documentReadiness.isTemporarilyEnrolled,
      complianceStatus: documentReadiness.isTemporarilyEnrolled
        ? "PENDING"
        : "COMPLIED",
    },
    select: { id: true, status: true },
  });

  return {
    applicationId: updated.id,
    status: updated.status,
    intakeState: documentReadiness.isTemporarilyEnrolled
      ? "TEMPORARY"
      : "CONFIRMED",
    missingDocuments: documentReadiness.missingDocuments,
  };
}

export async function markTransferRequest(
  applicationId: number,
  actingUserId: number,
): Promise<{ applicationId: number; status: string }> {
  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      learnerType: true,
    },
  });

  if (!application) {
    throw Object.assign(new Error("Application not found."), { status: 404 });
  }
  if (application.learnerType !== "CONTINUING") {
    throw Object.assign(
      new Error("Only continuing learners can be marked as transfer requests."),
      { status: 422 },
    );
  }
  if (application.status !== "PENDING_CONFIRMATION") {
    throw Object.assign(
      new Error(
        `Cannot mark transfer request: application is in status "${application.status}", expected "PENDING_CONFIRMATION".`,
      ),
      { status: 422 },
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "TRANSFERRING_OUT",
      confirmationConsent: false,
      encodedById: actingUserId,
    },
    select: { id: true, status: true },
  });

  return { applicationId: updated.id, status: updated.status };
}

export async function revokeConfirmedReturn(
  applicationId: number,
  actingUserId: number,
): Promise<{ applicationId: number; status: string }> {
  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      learnerType: true,
      enrollmentRecord: {
        select: { id: true },
      },
    },
  });

  if (!application) {
    throw Object.assign(new Error("Application not found."), { status: 404 });
  }
  if (application.learnerType !== "CONTINUING") {
    throw Object.assign(
      new Error("Only continuing learners can be returned to pending confirmation."),
      { status: 422 },
    );
  }
  if (application.status !== "READY_FOR_SECTIONING") {
    throw Object.assign(
      new Error(
        `Cannot Unenroll: application is in status "${application.status}", expected "READY_FOR_SECTIONING".`,
      ),
      { status: 422 },
    );
  }
  if (application.enrollmentRecord) {
    throw Object.assign(
      new Error("This learner is already assigned to a class section and can no longer be reversed here."),
      { status: 422 },
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "PENDING_CONFIRMATION",
      confirmationConsent: false,
      isTemporarilyEnrolled: false,
      complianceStatus: null,
      encodedById: actingUserId,
    },
    select: { id: true, status: true },
  });

  return { applicationId: updated.id, status: updated.status };
}

export async function markConfirmedTransferOut(
  applicationId: number,
  actingUserId: number,
): Promise<{ applicationId: number; status: string }> {
  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      learnerType: true,
      enrollmentRecord: {
        select: { id: true },
      },
    },
  });

  if (!application) {
    throw Object.assign(new Error("Application not found."), { status: 404 });
  }
  if (application.learnerType !== "CONTINUING") {
    throw Object.assign(
      new Error("Only continuing learners can be marked as transfer out from this queue."),
      { status: 422 },
    );
  }
  if (application.status !== "READY_FOR_SECTIONING") {
    throw Object.assign(
      new Error(
        `Cannot mark transfer out: application is in status "${application.status}", expected "READY_FOR_SECTIONING".`,
      ),
      { status: 422 },
    );
  }
  if (application.enrollmentRecord) {
    throw Object.assign(
      new Error("This learner is already assigned to a class section and can no longer be transferred here."),
      { status: 422 },
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "TRANSFERRING_OUT",
      confirmationConsent: false,
      isTemporarilyEnrolled: false,
      complianceStatus: null,
      encodedById: actingUserId,
    },
    select: { id: true, status: true },
  });

  return { applicationId: updated.id, status: updated.status };
}

export async function bulkConfirmReturn(
  applicationIds: number[],
  schoolYearId: number,
  actingUserId: number,
): Promise<BulkConfirmResult> {
  const confirmed: number[] = [];
  const failed: Array<{ id: number; reason: string }> = [];

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      id: { in: applicationIds },
      schoolYearId,
    },
    select: {
      id: true,
      status: true,
      isMissingSf9: true,
      hasSf9CertificationLetter: true,
      gradeLevel: { select: { displayOrder: true } },
      learner: {
        select: {
          hasPsaBirthCertificate: true,
          missingRequirements: true,
        },
      },
    },
  });

  const appMap = new Map(applications.map((a) => [a.id, a]));
  const completeIds: number[] = [];
  const lackingIds: number[] = [];

  for (const id of applicationIds) {
    const app = appMap.get(id);
    if (!app) {
      failed.push({
        id,
        reason: "Application not found or belongs to a different school year.",
      });
      continue;
    }
    if (app.status !== "PENDING_CONFIRMATION") {
      failed.push({
        id,
        reason: `Status is "${app.status}", expected "PENDING_CONFIRMATION".`,
      });
      continue;
    }

    confirmed.push(id);

    const documentReadiness = classifyDocumentReadiness({
      isMissingSf9: app.isMissingSf9,
      hasSf9CertificationLetter: app.hasSf9CertificationLetter,
      hasPsaBirthCertificate: app.learner.hasPsaBirthCertificate,
      missingRequirements: app.learner.missingRequirements,
    });

    if (documentReadiness.isTemporarilyEnrolled) {
      lackingIds.push(id);
    } else {
      completeIds.push(id);
    }
  }

  const setting = await prisma.schoolSetting.findFirst({ select: { systemPhase: true } });
  const isLate = setting?.systemPhase === "CLASSES_ONGOING";

  if (completeIds.length > 0) {
    await prisma.enrollmentApplication.updateMany({
      where: { id: { in: completeIds } },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        encodedById: actingUserId,
        isLateEnrollee: isLate,
        isTemporarilyEnrolled: false,
        complianceStatus: "COMPLIED",
      },
    });
  }

  if (lackingIds.length > 0) {
    await prisma.enrollmentApplication.updateMany({
      where: { id: { in: lackingIds } },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        encodedById: actingUserId,
        isLateEnrollee: isLate,
        isTemporarilyEnrolled: true,
        complianceStatus: "PENDING",
      },
    });
  }

  return {
    confirmed,
    readyForSectioning: completeIds,
    temporarilyEnrolled: lackingIds,
    failed,
  };
}

export async function getJHSCompleters(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{
  items: JHSCompleter[];
  total: number;
  page: number;
  limit: number;
}> {
  const { page, limit, search } = params;
  const skip = (page - 1) * limit;

  const where = {
    status: "JHS_COMPLETER" as const,
    ...(search
      ? {
        AND: search.split(/\s+/).filter(Boolean).map(term => ({
          OR: [
            { firstName: { contains: term, mode: "insensitive" as const } },
            { lastName: { contains: term, mode: "insensitive" as const } },
            { lrn: { contains: term, mode: "insensitive" as const } },
          ]
        }))
      }
      : {}),
  };

  const [learners, total] = await Promise.all([
    prisma.learner.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        lrn: true,
        firstName: true,
        lastName: true,
        middleName: true,
        lastGradeLevel: true,
        lastYearEnrolled: true,
        enrollmentRecords: {
          orderBy: { enrolledAt: "desc" },
          take: 1,
          select: {
            section: { select: { name: true } },
          },
        },
      },
    }),
    prisma.learner.count({ where }),
  ]);

  const items: JHSCompleter[] = learners.map((l) => ({
    learnerId: l.id,
    lrn: l.lrn,
    firstName: l.firstName,
    lastName: l.lastName,
    middleName: l.middleName,
    lastGradeLevel: l.lastGradeLevel,
    lastYearEnrolled: l.lastYearEnrolled,
    lastSectionName: l.enrollmentRecords[0]?.section?.name ?? null,
  }));

  return { items, total, page, limit };
}

export async function getPhase2Queue(params: {
  schoolYearId: number;
  status: string | string[];
  admissionChannel?: "ONLINE" | "F2F";
  search?: string;
  page: number;
  limit: number;
}): Promise<Phase2QueuePage> {
  const { schoolYearId, status, admissionChannel, search, page, limit } = params;
  const skip = (page - 1) * limit;
  const statuses = (Array.isArray(status) ? status : [status]) as ApplicationStatus[];

  const where: Prisma.EnrollmentApplicationWhereInput = {
    schoolYearId,
    status: { in: statuses },
    ...(admissionChannel ? { admissionChannel } : {}),
    ...(search
      ? {
        learner: {
          AND: search.split(/\s+/).filter(Boolean).map(term => ({
            OR: [
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { lrn: { contains: term, mode: "insensitive" as const } },
            ]
          }))
        }
      }
      : {}),
  };

  const [raw, total] = await Promise.all([
    prisma.enrollmentApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ learner: { lastName: "asc" } }, { learner: { firstName: "asc" } }],
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        admissionChannel: true,
        applicantType: true,
        learnerType: true,
        readingProfileLevel: true,
        learner: {
          select: { id: true, lrn: true, firstName: true, lastName: true, middleName: true },
        },
        gradeLevel: { select: { id: true, name: true } },
      },
    }),
    prisma.enrollmentApplication.count({ where }),
  ]);

  const items: Phase2QueueItem[] = raw.map((a) => ({
    applicationId: a.id,
    trackingNumber: a.trackingNumber,
    status: a.status,
    admissionChannel: a.admissionChannel,
    applicantType: a.applicantType,
    learnerType: a.learnerType,
    readingProfileLevel: a.readingProfileLevel ?? null,
    learnerId: a.learner.id,
    lrn: a.learner.lrn,
    firstName: a.learner.firstName,
    lastName: a.learner.lastName,
    middleName: a.learner.middleName,
    gradeLevelId: a.gradeLevel.id,
    gradeLevelName: a.gradeLevel.name,
  }));

  return { items, total, page, limit };
}

