import { Request, Response } from "express";
import {
  ApplicationStatus,
  type Prisma,
} from "../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import {
  findStudents,
  getStudentsSummary as fetchStudentsSummary,
} from "../students.service.js";

type FamilyMemberLike = {
  relationship: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  maidenName?: string | null;
  contactNumber?: string | null;
};

type AddressLike = {
  addressType: string;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

type StudentSearchResult = Awaited<
  ReturnType<typeof findStudents>
>;
type StudentSearchItem = StudentSearchResult["applications"][number];

type StudentRecordHistoryRow = {
  id: number;
  createdAt: Date;
  actionType: string;
  description: string;
  subjectType: string | null;
  recordId: number | null;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    roles: string[];
  } | null;
};

const OPERATIONAL_ACTION_TYPES = new Set<string>([
  "APPLICATION_SUBMITTED",
  "APPLICATION_TEMPORARILY_ENROLLED",
  "APPLICATION_ENROLLED",
  "APPLICATION_UNENROLLED",
  "STATUS_CHANGE",
  "STATUS_CHANGED",
  "LEARNER_SECTION_SHIFTED",
  "LEARNER_SECTIONED_INLINE",
  "BATCH_SECTION_ASSIGNMENT",
  "BATCH_SECTIONING_COMMITTED",
  "LEARNER_LRN_ASSIGNED",
  "STUDENT_UPDATED",
  "DEFICIENCY_CLEARED",
  "PSA_VERIFIED",
  "SECONDARY_BIRTH_DOC_VERIFIED",
  "CHECKLIST_UPDATED",
  "CHECKLIST_REMOVED",
  "LEARNER_TRANSFERRED_OUT",
  "LEARNER_DROPPED_OUT",
]);

const buildFullName = (person: {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
}): string => {
  const middle = person.middleName ? ` ${person.middleName.charAt(0)}.` : "";
  const suffix = person.suffix ? ` ${person.suffix}` : "";
  return `${person.lastName}, ${person.firstName}${middle}${suffix}`;
};

const pickParentOrGuardian = (
  familyMembers: FamilyMemberLike[] = [],
): { name: string | null; contact: string | null } => {
  const mother = familyMembers.find((f) => f.relationship === "MOTHER");
  const father = familyMembers.find((f) => f.relationship === "FATHER");
  const guardian = familyMembers.find((f) => f.relationship === "GUARDIAN");

  const selected = guardian ?? mother ?? father;
  return {
    name: selected ? `${selected.firstName} ${selected.lastName}` : null,
    contact:
      guardian?.contactNumber ??
      mother?.contactNumber ??
      father?.contactNumber ??
      null,
  };
};

const buildAddress = (addresses: AddressLike[] = []): string | null => {
  const currentAddress = addresses.find((a) => a.addressType === "CURRENT");
  if (!currentAddress) {
    return null;
  }

  return [
    currentAddress.barangay,
    currentAddress.cityMunicipality,
    currentAddress.province,
  ]
    .filter(Boolean)
    .join(", ");
};

const parsePositiveInt = (value: unknown): number | null => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseQueryString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const first = value.find(
      (item): item is string => typeof item === "string",
    );
    if (!first) {
      return undefined;
    }

    const trimmed = first.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
};

const parseQueryStringList = (value: unknown): string[] | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : undefined;
  }

  if (Array.isArray(value)) {
    const values = value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    );

    return values.length > 0 ? values : undefined;
  }

  return undefined;
};

const parseSortOrder = (value: unknown): "asc" | "desc" | undefined => {
  const normalized = parseQueryString(value);
  if (!normalized) {
    return undefined;
  }

  const lower = normalized.toLowerCase();
  if (lower === "asc" || lower === "desc") {
    return lower;
  }

  return undefined;
};

const normalizeStatus = (value: unknown): ApplicationStatus | undefined => {
  if (typeof value !== "string") return undefined;
  const status = value.trim().toUpperCase();
  if (!status || status === "ALL") return undefined;

  // Validate against runtime enum values to prevent Prisma validation errors
  if (Object.values(ApplicationStatus).some((value) => value === status)) {
    return status as ApplicationStatus;
  }

  return undefined;
};


  export const getStudents = async (req: Request, res: Response) => {
    try {
      // Prioritize query param, but fallback to the global SY context (req.schoolYearId)
      const rawSchoolYearId = parsePositiveInt(req.query.schoolYearId) ?? req.schoolYearId;
      const learnerStatus = parseQueryString(req.query.learnerStatus);

      // JHS_COMPLETER (alumni) queries must bypass the school year context
      // to trigger the global search path in findStudents. Alumni are a
      // permanent institutional record that is not scoped to any single year.
      const isAlumniQuery = learnerStatus?.includes("JHS_COMPLETER")
      const schoolYearId = isAlumniQuery ? undefined : rawSchoolYearId

      if (!schoolYearId && !learnerStatus) {
        return res.status(400).json({
          message: "schoolYearId or learnerStatus is required",
        });
      }

      const {
        applications,
        total,
        page: pageNum,
        limit: limitNum,
      } = await findStudents({
        schoolYearId,
        search: parseQueryString(req.query.search),
        gradeLevelId: parseQueryString(req.query.gradeLevelId),
        sectionId: parseQueryString(req.query.sectionId),
        sectionIds: parseQueryString(req.query.sectionIds),
        programType: parseQueryString(req.query.programType),
        isHomogeneous: parseQueryString(req.query.isHomogeneous),
        status: parseQueryStringList(req.query.status),
        learnerStatus,
        page: parseQueryString(req.query.page),
        limit: parseQueryString(req.query.limit),
        sortBy: parseQueryString(req.query.sortBy),
        sortOrder: parseSortOrder(req.query.sortOrder),
      });

      const students = applications.map((applicant: StudentSearchItem) => {
        const parentOrGuardian = pickParentOrGuardian(
          applicant.familyMembers as FamilyMemberLike[],
        );

        // Extract the school year label for Batch/Year Completed column
        const schoolYearInfo = "schoolYear" in applicant
          ? (applicant as StudentSearchItem & { schoolYear?: { yearLabel: string } }).schoolYear
          : undefined

        return {
          learningProgram:
            applicant.enrollmentRecord?.section?.programType ||
            "REGULAR",
          dateEnrolled:
            applicant.enrollmentRecord?.enrolledAt || applicant.createdAt,
          id: applicant.learner.id,
          lrn: applicant.learner?.lrn,
          fullName: applicant.learner ? buildFullName(applicant.learner) : "",
          firstName: applicant.learner?.firstName,
          lastName: applicant.learner?.lastName,
          middleName: applicant.learner?.middleName,
          suffix: applicant.learner?.extensionName,
          sex: applicant.learner?.sex,
          birthDate: applicant.learner?.birthdate,
          address: buildAddress(applicant.addresses as AddressLike[]),
          parentGuardianName: parentOrGuardian.name,
          parentGuardianContact: parentOrGuardian.contact,
          emailAddress: null,
          trackingNumber: applicant.trackingNumber,
          status: applicant.status,
          learnerStatus: applicant.learner?.status || "ACTIVE",
          applicantType: applicant.applicantType,
          gradeLevel: applicant.gradeLevel?.name || "Unknown",
          gradeLevelId: applicant.gradeLevelId,
          section: applicant.enrollmentRecord?.section?.name || null,
          sectionId: applicant.enrollmentRecord?.sectionId || null,
          sectionIsHomogeneous: applicant.enrollmentRecord?.section?.isHomogeneous || false,
          studentPhoto: applicant.learner?.studentPhoto || null,
          portalStatus: applicant.learner?.user?.isActive ? "ACTIVE" : "LOCKED",
          schoolYear: schoolYearInfo,
          createdAt: applicant.createdAt,
          updatedAt: applicant.updatedAt,
        };
      });

      res.json({
        students,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({
        message: "Failed to fetch students",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  export const getStudentsSummary = async (req: Request, res: Response) => {
    try {
      const schoolYearId = parsePositiveInt(req.query.schoolYearId);
      if (!schoolYearId) {
        return res.status(400).json({ message: "schoolYearId is required" });
      }

      const summary = await fetchStudentsSummary({
        schoolYearId,
        status: normalizeStatus(req.query.status),
      });

      res.json(summary);
    } catch (error) {
      console.error("Error fetching students summary:", error);
      res.status(500).json({ message: "Failed to fetch students summary" });
    }
  };

  export const getStudentById = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const schoolYearId = Number(req.query.schoolYearId) || req.schoolYearId;

      const liveApplicant = await prisma.enrollmentApplication.findFirst({
        where: { learnerId: parsedId, schoolYearId },
        include: {
          learner: {
            include: {
              user: {
                select: {
                  id: true,
                  isActive: true,
                  lastLoginAt: true,
                  mustChangePassword: true,
                  roles: true,
                },
              },
            },
          },
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          enrollmentRecord: {
            include: {
              section: {
                include: {
                  advisers: {
                    where: { status: "ACTIVE" },
                    include: {
                      teacher: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          middleName: true,
                        },
                      },
                    },
                  },
                },
              },
              enrolledBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
      type StudentDetailApplication = NonNullable<typeof liveApplicant>;
      let applicant: StudentDetailApplication | null = liveApplicant;

      let actualLearnerId = applicant?.learnerId ?? parsedId;
      let historicalAdviser: {
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null = null;

      if (!applicant) {
        // Fallback: If no application matches the ID, parsedId might actually be a Learner ID.
        // This happens for archived years where the student only exists in EnrollmentHistory.
        const fallbackLearner = await prisma.learner.findUnique({
          where: { id: parsedId },
          include: {
            user: {
              select: { id: true, isActive: true, lastLoginAt: true, mustChangePassword: true, roles: true },
            },
          },
        });
        
        if (!fallbackLearner) {
          return res.status(404).json({ message: "Student not found" });
        }
        
        actualLearnerId = fallbackLearner.id;

        // Fetch history for the specific selected school year to populate the dummy applicant
        const historyForYear = await prisma.enrollmentHistory.findFirst({
          where: { learnerId: actualLearnerId, schoolYearId },
          include: {
            gradeLevel: true,
            schoolYear: true,
            adviser: true,
            section: {
              include: {
                advisers: {
                  where: { status: "ACTIVE" },
                  include: {
                    teacher: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        middleName: true,
                      },
                    },
                  },
                },
              },
            },
          }
        });

        // Fetch application for the selected school year (if it somehow still exists)
        const appForYear = await prisma.enrollmentApplication.findFirst({
          where: { learnerId: actualLearnerId, schoolYearId },
          include: { addresses: true, familyMembers: true, previousSchool: true }
        });

        const snapshotData = asRecord(historyForYear?.learnerProfileSnapshot);
        const snapshotAddresses = Array.isArray(snapshotData?.addresses)
          ? snapshotData.addresses
          : [];
        const snapshotFamilyMembers = Array.isArray(snapshotData?.familyMembers)
          ? snapshotData.familyMembers
          : [];
        const snapshotApplicantType =
          typeof snapshotData?.applicantType === "string"
            ? snapshotData.applicantType
            : "REGULAR";
        const snapshotContactNumber =
          typeof snapshotData?.contactNumber === "string"
            ? snapshotData.contactNumber
            : null;
        const addressesToUse = appForYear?.addresses ?? snapshotAddresses;
        const familyMembersToUse =
          appForYear?.familyMembers ?? snapshotFamilyMembers;
        const previousSchoolToUse = appForYear?.previousSchool ?? null;
        historicalAdviser = historyForYear?.adviser ?? null;

        // Normalize immutable history into the same response shape as a live application.
        applicant = {
          id: appForYear?.id ?? fallbackLearner.id,
          learnerId: fallbackLearner.id,
          learner: fallbackLearner,
          status: historyForYear?.eosyStatus === "DROPPED_OUT" ? "DROPPED" : historyForYear?.eosyStatus === "TRANSFERRED_OUT" ? "TRANSFERRED_OUT" : "OFFICIALLY_ENROLLED",
          applicantType: snapshotApplicantType,
          contactNumber: snapshotContactNumber ?? appForYear?.contactNumber ?? null,
          gradeLevelId: historyForYear?.gradeLevelId || 0,
          schoolYearId,
          addresses: addressesToUse,
          familyMembers: familyMembersToUse,
          previousSchool: previousSchoolToUse,
          enrollmentRecord: historyForYear ? {
            section: historyForYear.section,
            enrolledAt: historyForYear.createdAt,
            eosyStatus: historyForYear.eosyStatus,
            enrolledBy: null,
          } : null,
          gradeLevel: historyForYear?.gradeLevel || null,
          schoolYear: historyForYear?.schoolYear || null,
          createdAt: historyForYear?.createdAt || fallbackLearner.createdAt,
          updatedAt: fallbackLearner.updatedAt,
        } as unknown as StudentDetailApplication;
      }

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }
      // Fetch historical grades up to the selected school year
      const histories = await prisma.enrollmentHistory.findMany({
        where: { 
          learnerId: actualLearnerId,
          schoolYearId: { lte: schoolYearId },
          gradeLevel: { name: { in: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] } }
        },
        include: { gradeLevel: true, schoolYear: true },
        orderBy: { schoolYearId: 'asc' }
      });
      
      const historicalGrades = histories.map(h => ({
        gradeLevel: h.gradeLevel.name,
        genAve: h.genAve,
        schoolYear: h.schoolYear.yearLabel,
        completedAt: h.createdAt
      }));

      const activeAdviser =
        historicalAdviser ??
        applicant.enrollmentRecord?.section?.advisers?.[0]?.teacher ??
        null;

      let addresses = (applicant.addresses || []) as AddressLike[];
      let familyMembers = (applicant.familyMembers || []) as FamilyMemberLike[];
      let previousSchool = applicant.previousSchool || null;

      if (!addresses.length || !familyMembers.length) {
        const latestAppWithData = await prisma.enrollmentApplication.findFirst({
          where: { 
            learnerId: actualLearnerId,
            OR: [
              { addresses: { some: {} } },
              { familyMembers: { some: {} } }
            ]
          },
          orderBy: { schoolYearId: 'desc' },
          include: { addresses: true, familyMembers: true, previousSchool: true }
        });
        if (latestAppWithData) {
          if (!addresses.length) addresses = latestAppWithData.addresses as AddressLike[];
          if (!familyMembers.length) familyMembers = latestAppWithData.familyMembers as FamilyMemberLike[];
          if (!previousSchool) previousSchool = latestAppWithData.previousSchool;
        }
      }
      const currentAddr = addresses.find((a) => a.addressType === "CURRENT");
      const permanentAddr = addresses.find(
        (a) => a.addressType === "PERMANENT",
      );
      const mother = familyMembers.find((f) => f.relationship === "MOTHER");
      const father = familyMembers.find((f) => f.relationship === "FATHER");
      const guardian = familyMembers.find((f) => f.relationship === "GUARDIAN");
      const parentOrGuardian = pickParentOrGuardian(familyMembers);

      const student = {
        id: applicant.learner?.id || applicant.learnerId || applicant.id,
        lrn: applicant.learner?.lrn,
        fullName: applicant.learner ? buildFullName(applicant.learner) : "",
        firstName: applicant.learner?.firstName,
        lastName: applicant.learner?.lastName,
        middleName: applicant.learner?.middleName,
        suffix: applicant.learner?.extensionName,
        sex: applicant.learner?.sex,
        birthDate: applicant.learner?.birthdate,
        address: buildAddress(addresses),
        currentAddress: currentAddr || null,
        permanentAddress: permanentAddr || null,
        motherName: mother || null,
        fatherName: father || null,
        guardianInfo: guardian || null,
        parentGuardianName: parentOrGuardian.name,
        parentGuardianContact: parentOrGuardian.contact,
        emailAddress: null,
        contactNumber: applicant.contactNumber,
        religion: applicant.learner?.religion,
        learnerStatus: applicant.learner?.status || "ACTIVE",
        userId: applicant.learner?.userId || null,
        userAccount: applicant.learner?.user
          ? {
              id: applicant.learner.user.id,
              isActive: applicant.learner.user.isActive,
              lastLoginAt: applicant.learner.user.lastLoginAt
                ? applicant.learner.user.lastLoginAt.toISOString()
                : null,
              mustChangePassword: applicant.learner.user.mustChangePassword,
              roles: applicant.learner.user.roles,
            }
          : null,
        portalStatus: applicant.learner?.user?.isActive ? "ACTIVE" : "LOCKED",
        isIpCommunity: applicant.learner?.isIpCommunity,
        ipGroupName: applicant.learner?.ipGroupName,
        is4PsBeneficiary: applicant.learner?.is4PsBeneficiary,
        isLearnerWithDisability: applicant.learner?.isLearnerWithDisability,
        disabilityTypes: applicant.learner?.disabilityTypes,
        isBalikAral: applicant.learner?.isBalikAral,
        motherTongue: applicant.learner?.motherTongue,
        trackingNumber: applicant.trackingNumber,
        status: applicant.status,
        applicantType: applicant.applicantType,
        rejectionReason: applicant.rejectionReason,
        gradeLevel: applicant.gradeLevel?.name || "Unknown",
        gradeLevelId: applicant.gradeLevelId,
        studentPhoto: applicant.learner?.studentPhoto || null,
        schoolYear: applicant.schoolYear?.yearLabel || "Unknown",
        schoolYearId: applicant.schoolYearId,
        enrollment: applicant.enrollmentRecord
          ? {
              id: applicant.enrollmentRecord.id,
              section: applicant.enrollmentRecord.section?.name || null,
              sectionId: applicant.enrollmentRecord.sectionId,
              advisingTeacher: activeAdviser
                ? buildFullName(activeAdviser)
                : null,
              enrolledAt: applicant.enrollmentRecord.enrolledAt,
              enrolledBy: applicant.enrollmentRecord.enrolledBy 
                ? (typeof applicant.enrollmentRecord.enrolledBy === "string" 
                  ? applicant.enrollmentRecord.enrolledBy 
                  : `${applicant.enrollmentRecord.enrolledBy.lastName || ""}, ${applicant.enrollmentRecord.enrolledBy.firstName || ""}`)
                : "System / Unknown",
              eosyStatus: applicant.enrollmentRecord.eosyStatus,
              dropOutReason: applicant.enrollmentRecord.dropOutReason,
              dropOutDate: applicant.enrollmentRecord.dropOutDate,
              transferOutDate: applicant.enrollmentRecord.transferOutDate,
              transferOutSchoolName: applicant.enrollmentRecord.transferOutSchoolName,
              transferOutReason: applicant.enrollmentRecord.transferOutReason,
            }
          : null,
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      };

      res.json({ student, historicalGrades });
    } catch (error) {
      console.error("[getStudentById] Error:", error);
      res.status(500).json({
        message: "Failed to fetch student details",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  export const getStudentRecordHistory = async (req: Request, res: Response) => {
    try {
      const parsedId = Number.parseInt(String(req.params.id ?? ""), 10);
      if (Number.isNaN(parsedId)) {
        return res.status(400).json({ message: "Invalid student id" });
      }

      const learner = await prisma.learner.findUnique({
        where: { id: parsedId },
        select: {
          id: true,
        },
      });

      if (!learner) {
        return res.status(404).json({ message: "Student not found" });
      }

      const applications = await prisma.enrollmentApplication.findMany({
        where: { learnerId: learner.id },
        select: {
          id: true,
          enrollmentRecord: {
            select: { id: true },
          },
        },
      });
      const applicationIds = applications.map((application) => application.id);
      const enrollmentRecordIds = applications
        .map((application) => application.enrollmentRecord?.id)
        .filter((recordId): recordId is number => recordId !== undefined);

      const page = parsePositiveInt(req.query.page) ?? 1;
      const limit = Math.min(parsePositiveInt(req.query.limit) ?? 25, 1000000);
      const skip = (page - 1) * limit;

      const subjectFilters: Prisma.AuditLogWhereInput[] = [
        {
          subjectType: "EnrollmentApplication",
          recordId: { in: applicationIds },
        },
        {
          subjectType: "Learner",
          recordId: learner.id,
        },
      ];

      if (enrollmentRecordIds.length > 0) {
        subjectFilters.push({
          subjectType: "EnrollmentRecord",
          recordId: { in: enrollmentRecordIds },
        });
      }

      const where: Prisma.AuditLogWhereInput = {
        actionType: {
          in: [...OPERATIONAL_ACTION_TYPES],
        },
        OR: subjectFilters,
      };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          select: {
            id: true,
            createdAt: true,
            actionType: true,
            description: true,
            subjectType: true,
            recordId: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                roles: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.auditLog.count({ where }),
      ]);

      const recordHistory = (logs as StudentRecordHistoryRow[]).map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        actionType: log.actionType,
        description: log.description,
        subjectType: log.subjectType,
        recordId: log.recordId,
        performedBy: log.user
          ? `${log.user.firstName} ${log.user.lastName}`
          : "System / Guest",
        performedByRole: log.user?.roles?.join(', ') ?? null,
      }));

      res.json({
        logs: recordHistory,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error("Error fetching student record history:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch student record history" });
    }
  };
