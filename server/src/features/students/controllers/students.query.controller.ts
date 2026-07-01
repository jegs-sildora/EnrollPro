import { Request, Response } from "express";
import {
  ApplicationStatus,
  type Prisma,
} from "../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import { generatePortalPin } from "../../learner/portal-pin.service.js";
import { normalizeDateToUtcNoon } from "../../school-year/school-year.service.js";
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
  if (Object.values(ApplicationStatus).includes(status as any)) {
    return status as ApplicationStatus;
  }

  return undefined;
};


  export const getStudents = async (req: Request, res: Response) => {
    try {
      // Prioritize query param, but fallback to the global SY context (req.schoolYearId)
      const schoolYearId = parsePositiveInt(req.query.schoolYearId) ?? req.schoolYearId;
      const learnerStatus = parseQueryString(req.query.learnerStatus);

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
        programType: parseQueryString(req.query.programType),
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

        return {
          learningProgram:
            applicant.enrollmentRecord?.section?.programType ||
            "REGULAR",
          dateEnrolled:
            applicant.enrollmentRecord?.enrolledAt || applicant.createdAt,
          id: applicant.id || applicant.learner?.id,
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
          tleSpecialization: null,
          studentPhoto: applicant.learner?.studentPhoto || null,
          portalStatus: applicant.learner?.user?.isActive ? "ACTIVE" : "LOCKED",
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

      let applicant: any = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
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

      const schoolYearId = Number(req.query.schoolYearId) || req.schoolYearId;

      // Prevent ID collision: if parsedId is actually a Learner ID, findUnique on EnrollmentApplication 
      // might find a completely unrelated application for a different school year.
      if (applicant && applicant.schoolYearId !== schoolYearId) {
        applicant = null;
      }

      let actualLearnerId = applicant?.learnerId;

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

        // Fetch application for the selected school year to strictly isolate data
        const appForYear = await prisma.enrollmentApplication.findFirst({
          where: { learnerId: actualLearnerId, schoolYearId },
          include: { addresses: true, familyMembers: true, previousSchool: true }
        });

        // Create a dummy applicant-like object to satisfy the frontend mapped type
        applicant = {
          id: fallbackLearner.id, // Fake ID for the UI
          learnerId: fallbackLearner.id,
          learner: fallbackLearner,
          firstName: fallbackLearner.firstName,
          lastName: fallbackLearner.lastName,
          middleName: fallbackLearner.middleName,
          extensionName: fallbackLearner.extensionName,
          status: historyForYear?.eosyStatus === "DROPPED_OUT" ? "DROPPED" : historyForYear?.eosyStatus === "TRANSFERRED_OUT" ? "TRANSFERRED_OUT" : "ENROLLED",
          applicantType: "REGULAR" as any,
          gradeLevelId: historyForYear?.gradeLevelId || 0,
          schoolYearId,
          addresses: appForYear?.addresses || [],
          familyMembers: appForYear?.familyMembers || [],
          previousSchool: appForYear?.previousSchool || null,
          enrollmentRecord: historyForYear ? {
            section: historyForYear.section,
            enrolledAt: historyForYear.createdAt,
            eosyStatus: historyForYear.eosyStatus,
          } : null,
          gradeLevel: historyForYear?.gradeLevel || null,
          schoolYear: historyForYear?.schoolYear || null,
          createdAt: historyForYear?.createdAt || fallbackLearner.createdAt,
          updatedAt: fallbackLearner.updatedAt,
        } as any;
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
        schoolYear: h.schoolYear.yearLabel
      }));

      const activeAdviser =
        applicant.enrollmentRecord?.section?.advisers?.[0]?.teacher ?? null;

      const addresses = (applicant.addresses || []) as AddressLike[];
      const familyMembers = (applicant.familyMembers ||
        []) as FamilyMemberLike[];
      const currentAddr = addresses.find((a) => a.addressType === "CURRENT");
      const permanentAddr = addresses.find(
        (a) => a.addressType === "PERMANENT",
      );
      const mother = familyMembers.find((f) => f.relationship === "MOTHER");
      const father = familyMembers.find((f) => f.relationship === "FATHER");
      const guardian = familyMembers.find((f) => f.relationship === "GUARDIAN");
      const parentOrGuardian = pickParentOrGuardian(familyMembers);

      const student = {
        id: applicant.id,
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
        is4PsBeneficiary: applicant.learner?.is4PsBeneficiary,
        isLearnerWithDisability: applicant.learner?.isLearnerWithDisability,
        disabilityTypes: applicant.learner?.disabilityTypes,
        isBalikAral: applicant.learner?.isBalikAral,
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
              enrolledBy: applicant.enrollmentRecord.enrolledBy ? `${applicant.enrollmentRecord.enrolledBy.lastName}, ${applicant.enrollmentRecord.enrolledBy.firstName}` : "System / Unknown",
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

      const applicant = await prisma.enrollmentApplication.findUnique({
        where: { id: parsedId },
        select: {
          learnerId: true,
          enrollmentRecord: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!applicant) {
        return res.status(404).json({ message: "Student not found" });
      }

      const page = parsePositiveInt(req.query.page) ?? 1;
      const limit = Math.min(parsePositiveInt(req.query.limit) ?? 25, 1000000);
      const skip = (page - 1) * limit;

      const subjectFilters: Prisma.AuditLogWhereInput[] = [
        {
          subjectType: "EnrollmentApplication",
          recordId: parsedId,
        },
        {
          subjectType: "Learner",
          recordId: applicant.learnerId,
        },
      ];

      if (applicant.enrollmentRecord) {
        subjectFilters.push({
          subjectType: "EnrollmentRecord",
          recordId: applicant.enrollmentRecord.id,
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

  export const getStudentApplicationIdBySY = async (req: Request, res: Response) => {
    try {
      const learnerId = parsePositiveInt(req.params.learnerId);
      const schoolYearId = parsePositiveInt(req.query.schoolYearId);

      if (!learnerId || !schoolYearId) {
        return res
          .status(400)
          .json({ message: "learnerId and schoolYearId are required" });
      }

      // Try enrollment application first
      const enrollmentApp = await prisma.enrollmentApplication.findFirst({
        where: { learnerId, schoolYearId },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (enrollmentApp) {
        return res.json({ id: enrollmentApp.id });
      }

      return res
        .status(404)
        .json({
          message:
            "No record found for this student in the specified school year",
        });
    } catch (error) {
      console.error("[getStudentApplicationIdBySY] Error:", error);
      res.status(500).json({ message: "Failed to look up student record" });
    }
  };

