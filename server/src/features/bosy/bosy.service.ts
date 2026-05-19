// Refreshed status enum support
import {
  PrismaClient,
  ApplicationStatus,
  LearnerType,
  ApplicantType,
  TleSectioningStatus,
} from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

export interface BOSYReadiness {
  schoolYearId: number;
  schoolYearLabel: string;
  isEosyFinalized: boolean;
  irregularBlockerCount: number;
  pendingConfirmationCount: number;
  readyForSectioningCount: number;
  enrolledCount: number;
  jhsCompleterCount: number;
  droppedCount: number;
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
  priorSectionName: string | null;
  priorAdviserName: string | null;
  tleProgramId: number | null;
  tleProgramName: string | null;
  tleProgramCategory: string | null;
  tleStatus: string | null;
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
  failed: Array<{ id: number; reason: string }>;
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

  const prevSchoolYearId = schoolYear.clonedFromId;

  // If we have a previous year, we need to count learners who WERE enrolled but DON'T have an application yet.
  // These are "missing" from the current year's PENDING_CONFIRMATION queue but SHOULD be there.
  let missingContinuingCount = 0;
  if (prevSchoolYearId) {
    // Subquery: learner IDs who already have an application in the current year
    const existingAppLearnerIds = await prisma.enrollmentApplication.findMany({
      where: { schoolYearId },
      select: { learnerId: true },
    });
    const excludedIds = existingAppLearnerIds.map((a) => a.learnerId);

    missingContinuingCount = await prisma.enrollmentRecord.count({
      where: {
        schoolYearId: prevSchoolYearId,
        learnerId: excludedIds.length > 0 ? { notIn: excludedIds } : undefined,
        enrollmentApplication: {
          status: {
            in: ["ENROLLED", "OFFICIALLY_ENROLLED", "TEMPORARILY_ENROLLED"],
          },
        },
        OR: [
          { eosyStatus: { equals: null } },
          {
            eosyStatus: {
              notIn: ["DROPPED_OUT", "TRANSFERRED_OUT", "CONDITIONALLY_PROMOTED"],
            },
          },
        ],
        // Exclude Grade 10 Promoted (they graduate JHS)
        NOT: {
          AND: [
            { section: { gradeLevel: { displayOrder: 10 } } },
            {
              OR: [
                { eosyStatus: { equals: null } },
                { eosyStatus: "PROMOTED" },
              ],
            },
          ],
        },
      },
    });
  }

  const [
    irregularBlockerCount,
    existingPendingCount,
    readyForSectioningCount,
    enrolledCount,
    jhsCompleterCount,
    droppedCount,
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
      },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: { in: ["ENROLLED", "OFFICIALLY_ENROLLED"] },
      },
    }),
    prisma.learner.count({
      where: { status: "JHS_COMPLETER" },
    }),
    prisma.enrollmentApplication.count({
      where: {
        schoolYearId,
        learnerType: "CONTINUING",
        status: { in: ["DROPPED", "TRANSFERRED_OUT", "TRANSFERRING_OUT"] },
      },
    }),
  ]);

  return {
    schoolYearId: schoolYear.id,
    schoolYearLabel: schoolYear.yearLabel,
    isEosyFinalized: schoolYear.isEosyFinalized,
    irregularBlockerCount,
    pendingConfirmationCount: existingPendingCount + missingContinuingCount,
    readyForSectioningCount,
    enrolledCount,
    jhsCompleterCount,
    droppedCount,
  };
}

export async function getBOSYQueue(params: {
  schoolYearId: number;
  gradeLevelId?: number;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}): Promise<BOSYQueuePage> {
  const { schoolYearId, gradeLevelId, status, search, page, limit } = params;
  const skip = (page - 1) * limit;

  const where: any = {
    schoolYearId,
    learnerType: "CONTINUING" as const,
    ...(gradeLevelId ? { gradeLevelId } : {}),
    ...(status
      ? {
          status:
            status.trim() === "ENROLLED"
              ? {
                  in: [
                    "ENROLLED",
                    "OFFICIALLY_ENROLLED",
                  ] as ApplicationStatus[],
                }
              : status.trim() === "DROPPED" ||
                  status.trim() === "TRANSFERRED_OUT"
                ? {
                    in: [
                      "DROPPED",
                      "TRANSFERRED_OUT",
                      "TRANSFERRING_OUT",
                    ] as ApplicationStatus[],
                  }
                : (status.trim() as ApplicationStatus),
        }
      : {}),
    ...(search
      ? {
          learner: search.includes(",")
            ? {
                AND: [
                  {
                    lastName: {
                      contains: search.split(",")[0].trim(),
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    firstName: {
                      contains: (search.split(",")[1] || "").trim(),
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {
                OR: [
                  {
                    firstName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    lastName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  { lrn: { contains: search, mode: "insensitive" as const } },
                ],
              },
        }
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
        tleProgramId: true,
        tleStatus: true,
        learner: {
          select: {
            id: true,
            lrn: true,
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
        gradeLevel: {
          select: { id: true, name: true, displayOrder: true },
        },
        checklist: {
          select: { academicStatus: true },
        },
        tleProgram: {
          select: { id: true, name: true, category: true },
        },
      },
    }),
    prisma.enrollmentApplication.count({ where }),
  ]);

  const applications = applicationsRaw as unknown as Array<{
    id: number;
    trackingNumber: string | null;
    status: ApplicationStatus;
    tleProgramId: number | null;
    learner: {
      id: number;
      lrn: string | null;
      firstName: string;
      lastName: string;
      middleName: string | null;
    };
    gradeLevel: { id: number; name: string; displayOrder: number };
    checklist: { academicStatus: any } | null;
    tleProgram: { id: number; name: string; category: string } | null;
    tleStatus: string | null;
  }>;

  // Resolve prior-year section and adviser for each learner in one batch
  const learnerIds = applications.map((a) => a.learner.id);
  const priorRecords = await prisma.enrollmentRecord.findMany({
    where: {
      learnerId: { in: learnerIds },
      schoolYear: {
        status: "ARCHIVED",
      },
    },
    orderBy: { enrolledAt: "desc" },
    distinct: ["learnerId"],
    select: {
      learnerId: true,
      section: {
        select: {
          name: true,
          advisers: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              teacher: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  const priorByLearner = new Map(
    priorRecords.map((r) => [r.learnerId, r.section]),
  );

  const items: BOSYQueueItem[] = applications.map((a) => {
    const section = priorByLearner.get(a.learner.id) ?? null;
    const adviser = section?.advisers[0]?.teacher ?? null;
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
      academicStatus: a.checklist?.academicStatus ?? null,
      priorSectionName: section?.name ?? null,
      priorAdviserName: adviser
        ? `${adviser.firstName} ${adviser.lastName}`.trim()
        : null,
      tleProgramId: a.tleProgram?.id ?? null,
      tleProgramName: a.tleProgram?.name ?? null,
      tleProgramCategory: a.tleProgram?.category ?? null,
      tleStatus: a.tleStatus ?? null,
    };
  });

  return { items, total, page, limit };
}

export async function syncBOSYQueue(
  schoolYearId: number,
  actingUserId: number,
): Promise<{ created: number }> {
  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, yearLabel: true, clonedFromId: true },
  });

  if (!schoolYear || !schoolYear.clonedFromId) {
    return { created: 0 };
  }

  const prevSchoolYearId = schoolYear.clonedFromId;
  const parsedStartYear = Number.parseInt(
    schoolYear.yearLabel.split("-")[0]?.trim() ?? "",
    10,
  );
  const startYear = Number.isFinite(parsedStartYear)
    ? parsedStartYear
    : new Date().getFullYear();

  // Find all eligible records from previous year
  const sourceRecords = (await prisma.enrollmentRecord.findMany({
    where: {
      schoolYearId: prevSchoolYearId,
      enrollmentApplication: {
        status: {
          in: ["ENROLLED", "OFFICIALLY_ENROLLED", "TEMPORARILY_ENROLLED"],
        },
      },
      OR: [
        { eosyStatus: { equals: null } },
        {
          eosyStatus: {
              notIn: ["DROPPED_OUT", "TRANSFERRED_OUT", "CONDITIONALLY_PROMOTED"],
          },
        },
      ],
      // Exclude Grade 10 Promoted
      NOT: {
        AND: [
          { section: { gradeLevel: { displayOrder: 10 } } },
          {
            OR: [{ eosyStatus: { equals: null } }, { eosyStatus: "PROMOTED" }],
          },
        ],
      },
    },
    select: {
      eosyStatus: true,
      learnerId: true,
      enrollmentApplication: {
        select: {
          applicantType: true,
          isPrivacyConsentGiven: true,
          guardianRelationship: true,
          hasNoMother: true,
          hasNoFather: true,
          tleProgramId: true,
        },
      },
      section: {
        select: {
          gradeLevel: { select: { displayOrder: true } },
        },
      },
    },
  })) as Array<{
    eosyStatus: string | null;
    learnerId: number;
    enrollmentApplication: {
      applicantType: ApplicantType;
      isPrivacyConsentGiven: boolean | null;
      guardianRelationship: string | null;
      hasNoMother: boolean | null;
      hasNoFather: boolean | null;
      tleProgramId: number | null;
    } | null;
    section: { gradeLevel: { displayOrder: number } } | null;
  }>;

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

  for (const record of sourceRecords) {
    if (existingLearnerIds.has(record.learnerId)) continue;

    const eosyStatus = record.eosyStatus ?? "PROMOTED";
    const section = record.section;
    const application = record.enrollmentApplication;
    if (!section || !application) continue;

    const sourceOrder = section.gradeLevel.displayOrder;
    const targetOrder =
      eosyStatus === "PROMOTED" ? sourceOrder + 1 : sourceOrder;
    const targetGradeLevelId = gradeLevelByOrder.get(targetOrder);

    if (!targetGradeLevelId) continue;

    const newApp = await prisma.enrollmentApplication.create({
      data: {
        learnerId: record.learnerId,
        schoolYearId,
        gradeLevelId: targetGradeLevelId,
        applicantType: application.applicantType,
        learnerType: "CONTINUING",
        status: "PENDING_CONFIRMATION",
        admissionChannel: "F2F",
        isPrivacyConsentGiven: application.isPrivacyConsentGiven ?? false,
        guardianRelationship: application.guardianRelationship,
        hasNoMother: application.hasNoMother ?? false,
        hasNoFather: application.hasNoFather ?? false,
        // G9→G10: carry forward the existing TLE program; G8→G9: learner must re-select
        tleProgramId: sourceOrder === 9 ? application.tleProgramId : null,
        encodedById: actingUserId,
      },
    });

    const trackingNumber = `REG-${startYear}-${String(newApp.id).padStart(5, "0")}`;
    await prisma.enrollmentApplication.update({
      where: { id: newApp.id },
      data: { trackingNumber },
    });

    await prisma.applicationChecklist.create({
      data: {
        enrollmentId: newApp.id,
        academicStatus: eosyStatus === "PROMOTED" ? "PROMOTED" : "RETAINED",
        updatedById: actingUserId,
      },
    });

    existingLearnerIds.add(record.learnerId);
    createdCount++;
  }

  return { created: createdCount };
}

export async function confirmReturn(
  applicationId: number,
  actingUserId: number,
  tleProgramId?: number | null,
): Promise<{ applicationId: number; status: string }> {
  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      learnerType: true,
      gradeLevel: { select: { displayOrder: true } },
      learner: {
        select: { id: true, lrn: true, firstName: true, lastName: true },
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

  // TLE is required for G9 and G10
  const requiresTle = [9, 10].includes(application.gradeLevel.displayOrder);
  if (requiresTle && !tleProgramId) {
    throw Object.assign(
      new Error(
        "A TLE program selection is required for Grade 9 and Grade 10 learners.",
      ),
      { status: 422 },
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "READY_FOR_SECTIONING",
      confirmationConsent: true,
      encodedById: actingUserId,
      ...(requiresTle ? { tleProgramId: tleProgramId ?? null } : {}),
      ...(requiresTle && tleProgramId
        ? { tleStatus: TleSectioningStatus.READY_FOR_TLE_SECTIONING }
        : {}),
    },
    select: { id: true, status: true },
  });

  return { applicationId: updated.id, status: updated.status };
}

export async function bulkConfirmReturn(
  applicationIds: number[],
  schoolYearId: number,
  actingUserId: number,
  tleProgramMap?: Record<number, number | null>,
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
      gradeLevel: { select: { displayOrder: true } },
    },
  });

  const appMap = new Map(applications.map((a) => [a.id, a]));

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
    const requiresTle = [9, 10].includes(app.gradeLevel.displayOrder);
    const tleProgramId = tleProgramMap?.[id] ?? null;
    if (requiresTle && !tleProgramId) {
      failed.push({
        id,
        reason:
          "A TLE program selection is required for Grade 9 and Grade 10 learners.",
      });
      continue;
    }
    confirmed.push(id);
  }

  // Update each confirmed application individually to set its tleProgramId
  for (const id of confirmed) {
    const app = appMap.get(id)!;
    const requiresTle = [9, 10].includes(app.gradeLevel.displayOrder);
    const tleProgramId = tleProgramMap?.[id] ?? null;
    await prisma.enrollmentApplication.update({
      where: { id },
      data: {
        status: "READY_FOR_SECTIONING",
        confirmationConsent: true,
        encodedById: actingUserId,
        ...(requiresTle ? { tleProgramId } : {}),
        ...(requiresTle && tleProgramId
          ? { tleStatus: TleSectioningStatus.READY_FOR_TLE_SECTIONING }
          : {}),
      },
    });
  }

  return { confirmed, failed };
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
      ? search.includes(",")
        ? {
            AND: [
              {
                lastName: {
                  contains: search.split(",")[0].trim(),
                  mode: "insensitive" as const,
                },
              },
              {
                firstName: {
                  contains: (search.split(",")[1] || "").trim(),
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { lrn: { contains: search, mode: "insensitive" as const } },
            ],
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

export async function getTLEPrograms(schoolYearId: number): Promise<
  Array<{
    id: number;
    name: string;
    category: string;
    isActive: boolean;
    maxSlots: number | null;
    availableSlots: number | null;
  }>
> {
  const programs = await prisma.tLEProgram.findMany({
    where: { trackType: "SPECIALIZATION", isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  // Calculate current occupancy per program for the given school year
  const occupancyRaw = await prisma.enrollmentApplication.groupBy({
    by: ["tleProgramId"],
    where: {
      schoolYearId,
      status: { in: ["READY_FOR_SECTIONING", "ENROLLED", "OFFICIALLY_ENROLLED"] },
      tleProgramId: { not: null },
    },
    _count: {
      id: true,
    },
  });

  const occupancyMap = new Map(
    occupancyRaw.map((o) => [o.tleProgramId, o._count.id]),
  );

  return programs.map((p) => {
    const max = p.maxSlots;
    const current = occupancyMap.get(p.id) || 0;
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      isActive: p.isActive,
      maxSlots: max,
      availableSlots: max != null ? Math.max(0, max - current) : null,
    };
  });
}
