import { prisma } from "../../lib/prisma.js";
import type {
  ApplicantType,
  Prisma,
  ApplicationStatus,
} from "../../generated/prisma/index.js";

type StudentSortOrder = "asc" | "desc";

const PROGRAM_TYPES: ApplicantType[] = [
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
];

const ACTIVE_STATUS_DEFAULTS: ApplicationStatus[] = [
  "SECTIONED",
  "ENROLLED",
  "OFFICIALLY_ENROLLED",
  "TEMPORARILY_ENROLLED"
];
const INACTIVE_OUTCOMES = ["TRANSFERRED_OUT", "DROPPED_OUT"] as const;
const INACTIVE_OUTCOME_SET = new Set<string>(INACTIVE_OUTCOMES);
const APPLICATION_STATUS_VALUES: ApplicationStatus[] = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ENROLLED",
  "SECTIONED",
  "OFFICIALLY_ENROLLED",
  "TEMPORARILY_ENROLLED"
];
const APPLICATION_STATUS_SET = new Set<string>(APPLICATION_STATUS_VALUES);

const parsePositiveInt = (value: unknown): number | undefined => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const normalizeProgramType = (value: unknown): ApplicantType | undefined => {
  if (typeof value !== "string") return undefined;
  const upper = value.trim().toUpperCase() as ApplicantType;
  return PROGRAM_TYPES.includes(upper) ? upper : undefined;
};

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
};

const buildSectionFilter = (
  programType: ApplicantType | undefined,
  isHomogeneous: boolean | undefined,
): Prisma.SectionWhereInput | undefined => {
  if (programType === undefined && isHomogeneous === undefined) {
    return undefined;
  }

  return {
    ...(programType !== undefined ? { programType } : {}),
    ...(isHomogeneous !== undefined ? { isHomogeneous } : {}),
  };
};

const normalizeStatuses = (value: unknown): ApplicationStatus[] | undefined => {
  if (typeof value !== "string" && !Array.isArray(value)) {
    return undefined;
  }

  const rawStatuses = Array.isArray(value) ? value : String(value).split(",");

  const statuses = rawStatuses
    .map((status) => String(status).trim().toUpperCase())
    .filter((status) => status.length > 0 && status !== "ALL")
    .filter((status): status is ApplicationStatus =>
      APPLICATION_STATUS_SET.has(status),
    );

  return statuses.length > 0 ? statuses : undefined;
};

const normalizeSortOrder = (value: unknown): Prisma.SortOrder =>
  String(value).toLowerCase() === "asc" ? "asc" : "desc";

const resolveStudentOrderBy = (
  sortBy: unknown,
  sortOrder: Prisma.SortOrder,
): Prisma.EnrollmentApplicationOrderByWithRelationInput[] => {
  const key = String(sortBy ?? "");

  switch (key) {
    case "lastName":
      return [{ learner: { lastName: sortOrder } }, { id: "asc" }];
    case "lrn":
      return [{ learner: { lrn: sortOrder } }, { id: "asc" }];
    case "gradeLevel":
      return [{ gradeLevel: { displayOrder: sortOrder } }, { id: "asc" }];
    case "section":
      // Fallback to createdAt if enrollmentRecord might be null
      return [
        { enrollmentRecord: { section: { name: sortOrder } } },
        { createdAt: sortOrder },
        { id: "asc" },
      ];
    case "dateEnrolled":
    case "enrolledAt":
      // Primary sort by enrolledAt, fallback to createdAt for robustness
      return [
        { enrollmentRecord: { enrolledAt: sortOrder } },
        { createdAt: sortOrder },
        { id: "asc" },
      ];
    case "createdAt":
      return [{ createdAt: sortOrder }, { id: "asc" }];
    case "updatedAt":
      return [{ updatedAt: sortOrder }, { id: "asc" }];
    default:
      // Default to dateEnrolled descending if possible, else createdAt
      return [
        { enrollmentRecord: { enrolledAt: "desc" } },
        { createdAt: "desc" },
        { id: "asc" },
      ];
  }
};

export async function findStudents(query: {
  schoolYearId?: number | string;
  learnerId?: number | string;
  search?: string;
  gradeLevelId?: number | string;
  sectionId?: number | string;
  sectionIds?: string;
  programType?: ApplicantType | string;
  isHomogeneous?: boolean | string;
  status?: ApplicationStatus | string | string[];
  learnerStatus?: string;
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: StudentSortOrder;
}) {
  const {
    schoolYearId,
    learnerId,
    search,
    gradeLevelId,
    sectionId,
    sectionIds,
    programType,
    isHomogeneous,
    status,
    learnerStatus,
    page,
    limit,
    sortBy,
    sortOrder,
  } = query;

  const resolvedSchoolYearId = parsePositiveInt(schoolYearId);
  const resolvedLearnerId = parsePositiveInt(learnerId);
  const resolvedPage = parsePositiveInt(page) ?? 1;
  const resolvedLimit = Math.min(parsePositiveInt(limit) ?? 15, 1000000);
  const resolvedGradeLevelId = parsePositiveInt(gradeLevelId);
  const resolvedSectionId = parsePositiveInt(sectionId);
  const resolvedSectionIds = sectionIds ? sectionIds.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n)) : undefined;
  const resolvedProgramType = normalizeProgramType(programType);
  const resolvedIsHomogeneous = normalizeBoolean(isHomogeneous);
  const resolvedSectionFilter = buildSectionFilter(
    resolvedProgramType,
    resolvedIsHomogeneous,
  );
  const resolvedStatuses = normalizeStatuses(status) ?? (resolvedSchoolYearId ? ACTIVE_STATUS_DEFAULTS : undefined);
  const resolvedSortOrder = normalizeSortOrder(sortOrder);
  
  const skip = (resolvedPage - 1) * resolvedLimit;
  const orderBy = resolveStudentOrderBy(sortBy, resolvedSortOrder);

  let isArchived = false;
  if (resolvedSchoolYearId) {
    const sy = await prisma.schoolYear.findUnique({
      where: { id: resolvedSchoolYearId },
      select: { status: true },
    });
    isArchived = sy?.status === "ARCHIVED";
  }

  // Define filters for the Learner model
  const learnerWhere: Prisma.LearnerWhereInput = {};
  
  if (learnerStatus) {
    const statuses = learnerStatus.split(",").map(s => s.trim().toUpperCase());
    learnerWhere.status = statuses.length === 1 ? (statuses[0] as any) : { in: statuses as any[] };
  }

  if (search) {
    const s = String(search);
    const searchFilter = {
      OR: [
        { lrn: { contains: s, mode: "insensitive" as const } },
        { firstName: { contains: s, mode: "insensitive" as const } },
        { lastName: { contains: s, mode: "insensitive" as const } },
      ],
    };
    Object.assign(learnerWhere, { ...learnerWhere, ...searchFilter });
  }

  // GLOBAL SEARCH (Alumni, Inactive) - No School Year provided
  if (!resolvedSchoolYearId && learnerStatus) {
    // For global search, we still want to filter by grade/section if provided
    // but since we are searching Learners, we look at their LATEST enrollment application
    const applicationWhere: Prisma.EnrollmentApplicationWhereInput = {};
    if (resolvedGradeLevelId) applicationWhere.gradeLevelId = resolvedGradeLevelId;
    
    const enrollmentRecordFilters: Prisma.EnrollmentRecordWhereInput = {};
    if (resolvedSectionId) enrollmentRecordFilters.sectionId = resolvedSectionId;
    if (resolvedSectionIds && resolvedSectionIds.length > 0) enrollmentRecordFilters.sectionId = { in: resolvedSectionIds };
    if (resolvedSectionFilter) {
      enrollmentRecordFilters.section = resolvedSectionFilter;
    }
    
    if (Object.keys(enrollmentRecordFilters).length > 0) {
      applicationWhere.enrollmentRecord = enrollmentRecordFilters;
    }

    // If application filters are present, we must join with enrollmentApplications
    if (Object.keys(applicationWhere).length > 0) {
      learnerWhere.enrollmentApplications = {
        some: applicationWhere
      };
    }

    const total = await prisma.learner.count({ where: learnerWhere });
    const learners = await prisma.learner.findMany({
      where: learnerWhere,
      include: {
        user: { select: { isActive: true } },
        enrollmentApplications: {
          orderBy: { schoolYear: { yearLabel: "desc" } },
          take: 1,
          include: {
            schoolYear: { select: { yearLabel: true } },
            gradeLevel: true,
            enrollmentRecord: {
              include: {
                section: { select: { id: true, name: true, programType: true } },
              },
            },
            addresses: true,
            familyMembers: true,
          },
        },
      },
      skip,
      take: resolvedLimit,
      orderBy: sortBy === "lastName" ? { lastName: resolvedSortOrder } : { createdAt: "desc" },
    });

    const mappedApplications = learners.map((l) => {
      const latestApp = l.enrollmentApplications[0];
      return {
        ...latestApp,
        id: latestApp?.id || l.id,
        learnerId: l.id,
        createdAt: latestApp?.createdAt || l.createdAt,
        learner: l,
        // Ensure status reflects the learner's actual status if no application status matches
        status: latestApp?.status || (l.status === "JHS_COMPLETER" ? "ALUMNI" : "INACTIVE"),
        gradeLevel: latestApp?.gradeLevel,
        enrollmentRecord: latestApp?.enrollmentRecord,
        schoolYear: latestApp?.schoolYear,
      };
    });

    return {
      applications: mappedApplications,
      total,
      page: resolvedPage,
      limit: resolvedLimit,
    };
  }

  // SCHOOL YEAR SEARCH (Active Enrolled)
  if (isArchived) {
    const historyWhere: Prisma.EnrollmentHistoryWhereInput = {
      schoolYearId: resolvedSchoolYearId,
      learner: learnerWhere,
    };

    if (resolvedGradeLevelId) historyWhere.gradeLevelId = resolvedGradeLevelId;
    if (resolvedSectionId) historyWhere.sectionId = resolvedSectionId;
    if (resolvedSectionIds && resolvedSectionIds.length > 0) historyWhere.sectionId = { in: resolvedSectionIds };
    if (resolvedSectionFilter) {
      historyWhere.section = resolvedSectionFilter;
    }

    const shouldExcludeInactiveOutcomes = resolvedStatuses?.every(
      (applicationStatus) => ACTIVE_STATUS_DEFAULTS.includes(applicationStatus as ApplicationStatus),
    ) ?? false;

    if (shouldExcludeInactiveOutcomes) {
      historyWhere.OR = [
        { eosyStatus: null },
        { eosyStatus: { notIn: [...INACTIVE_OUTCOMES] } },
      ];
    }

    if (learnerStatus === "DROPPED,TRANSFERRED_OUT") {
      historyWhere.eosyStatus = { in: ["DROPPED_OUT", "TRANSFERRED_OUT"] };
      delete learnerWhere.status;
      delete historyWhere.OR;
    } else if (learnerStatus === "DROPPED") {
      historyWhere.eosyStatus = "DROPPED_OUT";
      delete learnerWhere.status;
      delete historyWhere.OR;
    } else if (learnerStatus === "TRANSFERRED_OUT") {
      historyWhere.eosyStatus = "TRANSFERRED_OUT";
      delete learnerWhere.status;
      delete historyWhere.OR;
    } else if (learnerStatus === "JHS_COMPLETER") {
      historyWhere.eosyStatus = "PROMOTED";
      historyWhere.gradeLevel = { name: "Grade 10" };
      delete learnerWhere.status;
      delete historyWhere.OR;
    }

    if (search) {
      const s = String(search);
      const historySearch = {
        OR: [
          { learner: { lrn: { contains: s, mode: "insensitive" as const } } },
          { learner: { firstName: { contains: s, mode: "insensitive" as const } } },
          { learner: { lastName: { contains: s, mode: "insensitive" as const } } },
        ],
      };
      historyWhere.AND = [{ learner: learnerWhere }, historySearch];
      delete historyWhere.learner;
    }

    const total = await prisma.enrollmentHistory.count({ where: historyWhere });
    const histories = await prisma.enrollmentHistory.findMany({
      where: historyWhere,
      include: {
        learner: {
          include: {
            user: { select: { isActive: true } },
            enrollmentApplications: {
              where: { schoolYearId: resolvedSchoolYearId },
              take: 1,
              orderBy: { createdAt: "desc" },
              include: {
                addresses: true,
                familyMembers: true,
              },
            },
          },
        },
        gradeLevel: true,
        section: { select: { id: true, name: true, programType: true } },
      },
      orderBy: sortBy === "lastName" ? { learner: { lastName: resolvedSortOrder } } : { createdAt: "desc" },
      skip,
      take: resolvedLimit,
    });

    const mappedApplications = histories.map((h) => {
      const app = h.learner.enrollmentApplications?.[0] || {};
      return {
        ...app,
        learner: h.learner,
        status: h.eosyStatus === "DROPPED_OUT" ? "DROPPED" : h.eosyStatus === "TRANSFERRED_OUT" ? "TRANSFERRED_OUT" : "ENROLLED",
        gradeLevel: h.gradeLevel,
        enrollmentRecord: {
          section: h.section,
          sectionId: h.sectionId,
          enrolledAt: h.createdAt,
          eosyStatus: h.eosyStatus,
        },
        familyMembers: (app as any).familyMembers || [],
        addresses: (app as any).addresses || [],
      } as any;
    });

    return {
      applications: mappedApplications,
      total,
      page: resolvedPage,
      limit: resolvedLimit,
    };
  }

  const where: Prisma.EnrollmentApplicationWhereInput = {
    schoolYearId: resolvedSchoolYearId,
    learner: learnerWhere,
  };

  if (resolvedLearnerId) {
    where.learnerId = resolvedLearnerId;
  }
  
  if (resolvedStatuses) {
    where.status = resolvedStatuses.length === 1
        ? resolvedStatuses[0]
        : { in: resolvedStatuses };
  }

  const enrollmentRecordFilters: Prisma.EnrollmentRecordWhereInput = {};
  
  if (learnerStatus === "DROPPED,TRANSFERRED_OUT") {
    enrollmentRecordFilters.eosyStatus = { in: ["DROPPED_OUT", "TRANSFERRED_OUT"] };
    delete where.status; // Override default application status filter
    delete learnerWhere.status;
  } else if (learnerStatus === "DROPPED") {
    enrollmentRecordFilters.eosyStatus = "DROPPED_OUT";
    delete where.status;
    delete learnerWhere.status;
  } else if (learnerStatus === "TRANSFERRED_OUT") {
    enrollmentRecordFilters.eosyStatus = "TRANSFERRED_OUT";
    delete where.status;
    delete learnerWhere.status;
  } else if (learnerStatus === "JHS_COMPLETER") {
    enrollmentRecordFilters.eosyStatus = "PROMOTED";
    where.gradeLevel = { name: "Grade 10" };
    delete where.status;
    delete learnerWhere.status;
  } else {
    const shouldExcludeInactiveOutcomes = resolvedStatuses?.every(
      (applicationStatus) => ACTIVE_STATUS_DEFAULTS.includes(applicationStatus),
    ) ?? false;

    if (shouldExcludeInactiveOutcomes) {
      enrollmentRecordFilters.OR = [
        { eosyStatus: null },
        { eosyStatus: { notIn: [...INACTIVE_OUTCOMES] } },
      ];
    }
  }

  if (resolvedGradeLevelId) where.gradeLevelId = resolvedGradeLevelId;
  if (resolvedSectionId) enrollmentRecordFilters.sectionId = resolvedSectionId;
  if (resolvedSectionIds && resolvedSectionIds.length > 0) enrollmentRecordFilters.sectionId = { in: resolvedSectionIds };
  if (resolvedSectionFilter) {
    enrollmentRecordFilters.section = resolvedSectionFilter;
  }

  if (Object.keys(enrollmentRecordFilters).length > 0) {
    where.enrollmentRecord = enrollmentRecordFilters;
  }

  // Add search to the application level as well if needed (tracking number)
  if (search) {
    const s = String(search);
    const appSearch = {
      OR: [
        { trackingNumber: { contains: s, mode: "insensitive" as const } },
        { learner: { lrn: { contains: s, mode: "insensitive" as const } } },
        { learner: { firstName: { contains: s, mode: "insensitive" as const } } },
        { learner: { lastName: { contains: s, mode: "insensitive" as const } } },
      ]
    };
    // Combine with the learner status filter
    where.AND = [
      { learner: learnerWhere },
      appSearch
    ];
    delete where.learner; // Use AND instead
  }

  const total = await prisma.enrollmentApplication.count({ where });
  const applications = await prisma.enrollmentApplication.findMany({
    where,
    include: {
      learner: {
        include: {
          user: { select: { isActive: true } },
        },
      },
      gradeLevel: true,
      enrollmentRecord: {
        include: {
          section: { select: { id: true, name: true, programType: true } },
        },
      },
      addresses: true,
      familyMembers: true,
    },
    orderBy,
    skip,
    take: resolvedLimit,
  });

  return {
    applications,
    total,
    page: resolvedPage,
    limit: resolvedLimit,
  };
}

export async function getStudentsSummary(query: {
  schoolYearId?: number | string;
  status?: ApplicationStatus | string | string[];
}) {
  const resolvedSchoolYearId = parsePositiveInt(query.schoolYearId);
  if (!resolvedSchoolYearId) {
    throw new Error("schoolYearId is required");
  }

  const resolvedStatuses =
    normalizeStatuses(query.status) ?? ACTIVE_STATUS_DEFAULTS;

  const sy = await prisma.schoolYear.findUnique({
    where: { id: resolvedSchoolYearId },
    select: { status: true },
  });
  const isArchived = sy?.status === "ARCHIVED";

  let applications: any[] = [];

  if (isArchived) {
    const histories = await prisma.enrollmentHistory.findMany({
      where: {
        schoolYearId: resolvedSchoolYearId,
      },
      select: {
        eosyStatus: true,
        learner: {
          select: {
            sex: true,
            is4PsBeneficiary: true,
            isBalikAral: true,
            enrollmentApplications: {
              where: { schoolYearId: resolvedSchoolYearId },
              take: 1,
              select: { learnerType: true },
            },
          },
        },
        gradeLevel: {
          select: {
            name: true,
          },
        },
        section: {
          select: {
            programType: true,
          },
        },
      },
    });

    applications = histories.map((h) => ({
      learnerType: h.learner?.enrollmentApplications?.[0]?.learnerType || "CONTINUING",
      learner: h.learner,
      gradeLevel: h.gradeLevel,
      enrollmentRecord: {
        eosyStatus: h.eosyStatus,
        section: h.section,
      },
    }));
  } else {
    applications = await prisma.enrollmentApplication.findMany({
      where: {
        schoolYearId: resolvedSchoolYearId,
        status:
          resolvedStatuses.length === 1
            ? resolvedStatuses[0]
            : { in: resolvedStatuses },
      },
      select: {
        learnerType: true,
        learner: {
          select: {
            sex: true,
            is4PsBeneficiary: true,
            isBalikAral: true,
          },
        },
        gradeLevel: {
          select: {
            name: true,
          },
        },
        enrollmentRecord: {
          select: {
            eosyStatus: true,
            section: {
              select: {
                programType: true,
              },
            },
          },
        },
      },
    });
  }

  const genderBreakdown = {
    male: 0,
    female: 0,
    other: 0,
  };

  const programBreakdown = PROGRAM_TYPES.reduce<Record<ApplicantType, number>>(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<ApplicantType, number>,
  );

  const gradeBreakdown: Record<string, number> = {};
  const specialDemographics = { fourPs: 0, balikAral: 0, transfereesIn: 0 };

  for (const application of applications) {
    const lifecycleOutcome = application.enrollmentRecord?.eosyStatus;
    if (lifecycleOutcome && INACTIVE_OUTCOME_SET.has(lifecycleOutcome)) {
      continue;
    }

    const normalizedSex = String(application.learner?.sex ?? "")
      .trim()
      .toUpperCase();

    if (normalizedSex.startsWith("M")) {
      genderBreakdown.male += 1;
    } else if (normalizedSex.startsWith("F")) {
      genderBreakdown.female += 1;
    } else {
      genderBreakdown.other += 1;
    }

    const programType =
      (application.enrollmentRecord?.section?.programType as ApplicantType) ||
      "REGULAR";

    if (programBreakdown[programType] !== undefined) {
      programBreakdown[programType] += 1;
    } else {
      programBreakdown["REGULAR"] += 1;
    }

    // Grade level breakdown
    const gradeName = application.gradeLevel?.name ?? "";
    if (gradeName) {
      gradeBreakdown[gradeName] = (gradeBreakdown[gradeName] ?? 0) + 1;
    }

    // Special demographics / DepEd flags
    if (application.learner?.is4PsBeneficiary) specialDemographics.fourPs += 1;
    if (application.learner?.isBalikAral) specialDemographics.balikAral += 1;
    if (application.learnerType === "TRANSFEREE") specialDemographics.transfereesIn += 1;
  }

  const totalEnrolled =
    genderBreakdown.male + genderBreakdown.female + genderBreakdown.other;

  return {
    totalEnrolled,
    genderBreakdown,
    programBreakdown,
    gradeBreakdown,
    specialDemographics,
  };
}
