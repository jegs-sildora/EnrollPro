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
  "OFFICIALLY_ENROLLED",
  "ENROLLED",
];
const INACTIVE_OUTCOMES = ["TRANSFERRED_OUT", "DROPPED_OUT"] as const;
const INACTIVE_OUTCOME_SET = new Set<string>(INACTIVE_OUTCOMES);
const APPLICATION_STATUS_VALUES: ApplicationStatus[] = [
  "EARLY_REG_SUBMITTED",
  "PRE_REGISTERED",
  "PENDING_VERIFICATION",
  "READY_FOR_SECTIONING",
  "OFFICIALLY_ENROLLED",
  "SUBMITTED",
  "VERIFIED",
  "UNDER_REVIEW",
  "FOR_REVISION",
  "ELIGIBLE",
  "EXAM_SCHEDULED",
  "ASSESSMENT_TAKEN",
  "PASSED",
  "INTERVIEW_SCHEDULED",
  "READY_FOR_ENROLLMENT",
  "TEMPORARILY_ENROLLED",
  "FAILED_ASSESSMENT",
  "ENROLLED",
  "REJECTED",
  "WITHDRAWN",
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
      return [
        { enrollmentRecord: { section: { name: sortOrder } } },
        { id: "asc" },
      ];
    case "dateEnrolled":
    case "enrolledAt":
      return [{ enrollmentRecord: { enrolledAt: sortOrder } }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: sortOrder }, { id: "asc" }];
    case "updatedAt":
      return [{ updatedAt: sortOrder }, { id: "asc" }];
    default:
      return [{ enrollmentRecord: { enrolledAt: "desc" } }, { id: "asc" }];
  }
};

export async function findStudents(query: {
  schoolYearId?: number | string;
  search?: string;
  gradeLevelId?: number | string;
  sectionId?: number | string;
  programType?: ApplicantType | string;
  status?: ApplicationStatus | string | string[];
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: StudentSortOrder;
}) {
  const {
    schoolYearId,
    search,
    gradeLevelId,
    sectionId,
    programType,
    status,
    page,
    limit,
    sortBy,
    sortOrder,
  } = query;
  const resolvedSchoolYearId = parsePositiveInt(schoolYearId);
  if (!resolvedSchoolYearId) {
    throw new Error("schoolYearId is required");
  }

  const resolvedPage = parsePositiveInt(page) ?? 1;
  const resolvedLimit = Math.min(parsePositiveInt(limit) ?? 15, 100);
  const resolvedGradeLevelId = parsePositiveInt(gradeLevelId);
  const resolvedSectionId = parsePositiveInt(sectionId);
  const resolvedProgramType = normalizeProgramType(programType);
  const resolvedStatuses = normalizeStatuses(status) ?? ACTIVE_STATUS_DEFAULTS;
  const resolvedSortOrder = normalizeSortOrder(sortOrder);
  const orderBy = resolveStudentOrderBy(sortBy, resolvedSortOrder);

  const skip = (resolvedPage - 1) * resolvedLimit;

  const where: Prisma.EnrollmentApplicationWhereInput = {
    schoolYearId: resolvedSchoolYearId,
    status:
      resolvedStatuses.length === 1
        ? resolvedStatuses[0]
        : { in: resolvedStatuses },
  };

  const enrollmentRecordFilters: Prisma.EnrollmentRecordWhereInput = {};
  const shouldExcludeInactiveOutcomes = resolvedStatuses.every(
    (applicationStatus) => ACTIVE_STATUS_DEFAULTS.includes(applicationStatus),
  );

  if (shouldExcludeInactiveOutcomes) {
    enrollmentRecordFilters.OR = [
      {
        eosyStatus: null,
      },
      {
        eosyStatus: {
          notIn: [...INACTIVE_OUTCOMES],
        },
      },
    ];
  }

  if (search) {
    const s = String(search);
    where.OR = [
      { learner: { lrn: { contains: s, mode: "insensitive" } } },
      { learner: { firstName: { contains: s, mode: "insensitive" } } },
      { learner: { lastName: { contains: s, mode: "insensitive" } } },
      { trackingNumber: { contains: s, mode: "insensitive" } },
    ];
  }

  if (resolvedGradeLevelId) where.gradeLevelId = resolvedGradeLevelId;

  if (resolvedSectionId) {
    enrollmentRecordFilters.sectionId = resolvedSectionId;
  }

  if (resolvedProgramType) {
    enrollmentRecordFilters.section = { programType: resolvedProgramType };
  }

  if (Object.keys(enrollmentRecordFilters).length > 0) {
    where.enrollmentRecord = enrollmentRecordFilters;
  }

  const total = await prisma.enrollmentApplication.count({ where });
  const applications = await prisma.enrollmentApplication.findMany({
    where,
    include: {
      learner: true,
      gradeLevel: true,
      programDetail: {
        select: {
          scpType: true,
        },
      },
      enrollmentRecord: {
        include: {
          section: {
            select: {
              id: true,
              name: true,
              programType: true,
            },
          },
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

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId: resolvedSchoolYearId,
      status:
        resolvedStatuses.length === 1
          ? resolvedStatuses[0]
          : { in: resolvedStatuses },
    },
    select: {
      learner: {
        select: {
          sex: true,
        },
      },
      programDetail: {
        select: {
          scpType: true,
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
      application.enrollmentRecord?.section.programType ||
      application.programDetail?.scpType ||
      "REGULAR";

    programBreakdown[programType] += 1;
  }

  const totalEnrolled =
    genderBreakdown.male + genderBreakdown.female + genderBreakdown.other;

  return {
    totalEnrolled,
    genderBreakdown,
    programBreakdown,
  };
}
