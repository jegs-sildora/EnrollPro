import { AppError } from "../../../lib/AppError.js";
import {
  generateTrackingNumber,
  getTrackingPrefix,
} from "../../../lib/tracking.js";
import type {
  EnrollmentApplication,
  ApplicationStatus,
} from "../../../generated/prisma/index.js";
import {
  APPLICATION_STATUS_TO_TRACKING_STATUS,
  APPLICATION_VALID_TRANSITIONS,
} from "@enrollpro/shared";
import type { AdmissionControllerDeps } from "./admission-controller.deps.js";

export type PublicProgramType = "REGULAR";

export type PublicTrackingStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "ASSESSMENT_IN_PROGRESS"
  | "QUALIFIED_FOR_ENROLLMENT"
  | "ENROLLED"
  | "NOT_QUALIFIED"
  | "REJECTED"
  | "WITHDRAWN"
  | "TRANSFERRED"
  | "DROPPED";

export type PublicCurrentStep =
  | "APPLICATION_SUBMITTED"
  | "REGISTRAR_REVIEW"
  | "ENROLLMENT_QUALIFICATION"
  | "ENROLLED";

export interface PublicAssessmentData {
  phaseStatus: "NOT_STARTED";
  latestSchedule: null;
  steps: [];
}

const NORMALIZED_TRACKING_STATUSES = new Set<PublicTrackingStatus>([
  "SUBMITTED",
  "IN_REVIEW",
  "ASSESSMENT_IN_PROGRESS",
  "QUALIFIED_FOR_ENROLLMENT",
  "ENROLLED",
  "NOT_QUALIFIED",
  "REJECTED",
  "WITHDRAWN",
  "TRANSFERRED",
  "DROPPED",
]);

const RAW_TO_TRACKING_STATUS = APPLICATION_STATUS_TO_TRACKING_STATUS as Record<
  ApplicationStatus,
  PublicTrackingStatus
>;

export function deriveProgramType(
  applicantType: string | null | undefined,
): PublicProgramType {
  return "REGULAR";
}

export function normalizeTrackingStatus(
  status: string | null | undefined,
): PublicTrackingStatus {
  const normalized = String(status ?? "SUBMITTED_BEERF")
    .trim()
    .toUpperCase();

  if (NORMALIZED_TRACKING_STATUSES.has(normalized as PublicTrackingStatus)) {
    return normalized as PublicTrackingStatus;
  }

  return RAW_TO_TRACKING_STATUS[normalized as ApplicationStatus] ?? "SUBMITTED";
}

export function resolveCurrentStep(
  status: PublicTrackingStatus,
  programType: PublicProgramType,
): PublicCurrentStep {
  switch (status) {
    case "SUBMITTED":
      return "APPLICATION_SUBMITTED";
    case "IN_REVIEW":
    case "ASSESSMENT_IN_PROGRESS":
      return "REGISTRAR_REVIEW";
    case "QUALIFIED_FOR_ENROLLMENT":
      return "ENROLLMENT_QUALIFICATION";
    case "ENROLLED":
    case "TRANSFERRED":
    case "DROPPED":
      return "ENROLLED";
    case "NOT_QUALIFIED":
      return "ENROLLMENT_QUALIFICATION";
    case "REJECTED":
    case "WITHDRAWN":
      return "REGISTRAR_REVIEW";
    default:
      return "APPLICATION_SUBMITTED";
  }
}

export function createInitialTrackingPayload(
  applicantType: string | null | undefined,
  submittedRawStatus: ApplicationStatus = "SUBMITTED_BEERF",
): {
  programType: PublicProgramType;
  status: PublicTrackingStatus;
  rawStatus: ApplicationStatus;
  currentStep: PublicCurrentStep;
  assessmentData: PublicAssessmentData | null;
} {
  const programType = deriveProgramType(applicantType);
  const status: PublicTrackingStatus = "SUBMITTED";
  const rawStatus: ApplicationStatus = submittedRawStatus;

  return {
    programType,
    status,
    rawStatus,
    currentStep: resolveCurrentStep(status, programType),
    assessmentData: {
      phaseStatus: "NOT_STARTED",
      latestSchedule: null,
      steps: [],
    },
  };
}

export const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  ...(APPLICATION_VALID_TRANSITIONS as Record<string, ApplicationStatus[]>),
  ENROLLED: ["WITHDRAWN", "TRANSFERRING_OUT", "TRANSFERRED_OUT", "DROPPED"],
  TRANSFERRING_OUT: ["TRANSFERRED_OUT", "WITHDRAWN"],
  TRANSFERRED_OUT: [],
  DROPPED: [],
  PENDING_CONFIRMATION: ["READY_FOR_SECTIONING", "WITHDRAWN"],
};

function isRegularApplicant(applicantType: string | null | undefined): boolean {
  return true; // SCP removed, so all applicants are treated as regular JHS path enrollees.
}

export function resolveAllowedTransitionsForApplicant(application: {
  status: ApplicationStatus;
  applicantType?: string | null;
}): ApplicationStatus[] {
  if (
    application.status === "SUBMITTED_BEERF"
  ) {
    return ["PENDING_BEEF"];
  }

  return VALID_TRANSITIONS[application.status] ?? [];
}

export function createEarlyRegistrationSharedService(
  deps: AdmissionControllerDeps,
) {

  async function findApplicantOrThrow(
    id: number,
    tx?: any,
  ): Promise<{ data: any; type: "ENROLLMENT" }> {
    const p = tx || deps.prisma;
    const applicant = await p.enrollmentApplication.findUnique({
      where: { id },
      include: {
        learner: true,
        gradeLevel: true,
        previousSchool: true,
      },
    });

    if (!applicant) throw new AppError(404, "Application not found");
    return { data: applicant, type: "ENROLLMENT" };
  }

  function assertTransition(
    application: {
      status: ApplicationStatus;
      applicantType?: string | null;
    },
    to: ApplicationStatus,
    contextMessage?: string,
  ): void {
    if (!resolveAllowedTransitionsForApplicant(application).includes(to)) {
      throw new AppError(
        422,
        contextMessage ??
          `Cannot transition from "${application.status}" to "${to}".`,
      );
    }
  }

  async function flattenAssessmentData(application: Record<string, any>) {
    const programType = deriveProgramType(application.applicantType);
    const trackingStatus = normalizeTrackingStatus(application.status);
    const currentStep = resolveCurrentStep(trackingStatus, programType);

    // Normalize name fields if it's joined from learner table
    const learner = application.learner || application;

    // Map family members (Enrollment uses 'familyMembers' relation)
    const familyMembers = (application.familyMembers || []) as any[];
    const mother = familyMembers.find((m) => m.relationship === "MOTHER");
    const father = familyMembers.find((m) => m.relationship === "FATHER");
    const guardian = familyMembers.find((m) => m.relationship === "GUARDIAN");

    const prevSchool = application.previousSchool || null;

    // Map addresses (Enrollment uses 'addresses' relation)
    const addresses = (application.addresses || []) as any[];
    const currentAddr = addresses.find((a) => a.addressType === "CURRENT");
    const permanentAddr = addresses.find((a) => a.addressType === "PERMANENT");

    const primaryContact = application.primaryContact ?? null;

    const motherEmail = mother?.email ?? application.motherName?.email ?? null;
    const fatherEmail = father?.email ?? application.fatherName?.email ?? null;
    const guardianEmail =
      guardian?.email ?? application.guardianInfo?.email ?? null;

    const primaryContactEmail =
      primaryContact === "MOTHER"
        ? motherEmail
        : primaryContact === "FATHER"
          ? fatherEmail
          : primaryContact === "GUARDIAN"
            ? guardianEmail
            : null;

    const learningProgram =
      application.enrollmentRecord?.section?.programType ?? "REGULAR";

    return {
      ...application,
      status: application.status,
      learnerStatus: learner.status,
      firstName: learner.firstName || application.firstName,
      lastName: learner.lastName || application.lastName,
      middleName: learner.middleName || application.middleName,
      suffix:
        learner.extensionName ||
        application.extensionName ||
        application.suffix,
      lrn: learner.lrn || application.lrn,
      isPendingLrnCreation: Boolean(
        learner.isPendingLrnCreation ??
        application.isPendingLrnCreation ??
        application.learner?.isPendingLrnCreation ??
        false,
      ),
      birthDate:
        learner.birthdate || application.birthdate || application.birthDate,
      sex: learner.sex || application.sex,
      placeOfBirth: learner.placeOfBirth || application.placeOfBirth,
      religion: learner.religion || application.religion,
      motherTongue: learner.motherTongue || application.motherTongue,
      isIpCommunity:
        learner.isIpCommunity ?? application.isIpCommunity ?? false,
      ipGroupName: learner.ipGroupName || application.ipGroupName,
      is4PsBeneficiary:
        learner.is4PsBeneficiary ?? application.is4PsBeneficiary ?? false,
      householdId4Ps: learner.householdId4Ps || application.householdId4Ps,
      isLearnerWithDisability:
        learner.isLearnerWithDisability ??
        application.isLearnerWithDisability ??
        false,
      disabilityTypes:
        learner.disabilityTypes || application.disabilityTypes || [],
      studentPhoto: learner.studentPhoto || application.studentPhoto || null,
      hasPsaBirthCertificate: Boolean(learner.hasPsaBirthCertificate),
      birthCertificateType: learner.birthCertificateType || null,
      birthCertificateVerifiedBy: learner.birthCertificateVerifiedBy || null,
      birthCertificateVerifiedDate:
        learner.birthCertificateVerifiedDate || null,

      // Standardize address format for frontend
      currentAddress: currentAddr
        ? {
            houseNo: currentAddr.houseNo,
            street: currentAddr.street,
            sitio: currentAddr.sitio,
            barangay: currentAddr.barangay,
            cityMunicipality: currentAddr.cityMunicipality,
            province: currentAddr.province,
            country: currentAddr.country,
            zipCode: currentAddr.zipCode,
          }
        : null,
      permanentAddress: permanentAddr
        ? {
            houseNo: permanentAddr.houseNo,
            street: permanentAddr.street,
            sitio: permanentAddr.sitio,
            barangay: permanentAddr.barangay,
            cityMunicipality: permanentAddr.cityMunicipality,
            province: permanentAddr.province,
            country: permanentAddr.country,
            zipCode: permanentAddr.zipCode,
          }
        : null,

      motherName: mother
        ? {
            firstName: mother.firstName,
            lastName: mother.lastName,
            middleName: mother.middleName,
            contactNumber: mother.contactNumber,
            email: motherEmail,
          }
        : application.motherName || null,
      fatherName: father
        ? {
            firstName: father.firstName,
            lastName: father.lastName,
            middleName: father.middleName,
            contactNumber: father.contactNumber,
            email: fatherEmail,
          }
        : application.fatherName || null,
      guardianInfo: guardian
        ? {
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            middleName: guardian.middleName,
            contactNumber: guardian.contactNumber,
            email: guardianEmail,
            relationship: "GUARDIAN",
          }
        : application.guardianInfo || null,
      primaryContact,
      emailAddress:
        primaryContactEmail ||
        application.emailAddress ||
        application.email ||
        guardianEmail ||
        motherEmail ||
        fatherEmail ||
        null,

      lastSchoolName:
        prevSchool?.schoolName ||
        (application.reportedGrades as any)?.lastSchoolName ||
        null,
      lastSchoolId:
        prevSchool?.schoolDepedId ||
        (application.reportedGrades as any)?.lastSchoolId ||
        null,
      lastGradeCompleted:
        prevSchool?.gradeCompleted || application.lastGradeCompleted,
      schoolYearLastAttended:
        prevSchool?.schoolYearAttended || application.schoolYearLastAttended,
      lastSchoolAddress:
        prevSchool?.schoolAddress || application.lastSchoolAddress,
      lastSchoolType: prevSchool?.schoolType || application.lastSchoolType,
      generalAverage:
        prevSchool?.generalAverage ||
        application.previousSchool?.generalAverage ||
        application.checklist?.finalGeneralAverage ||
        (application.reportedGrades as any)?.generalAverage ||
        (learner as any)?.enrollmentRecords?.[0]?.finalAverage ||
        (learner as any)?.previousGenAve ||
        null,

      learningProgram,
      programType,
      trackingStatus,
      currentStep,
      assessmentData: null,

      isScpApplication: false,
      scpType: null,
      artField: null,
      foreignLanguage: null,
      sportsList: [],
      assessmentSteps: [],
      assessmentType: null,
      examDate: null,
      examVenue: null,
      examScore: null,
      examResult: null,
      examNotes: null,
      interviewDate: null,
      interviewScore: null,
      interviewResult: null,
      interviewNotes: null,
    };
  }

  async function getDetailedApplicationOrThrow(
    id: number,
    options: {
      includeAuditLogs?: boolean;
      allowEnrollmentFallback?: boolean;
    } = {},
  ) {
    const { includeAuditLogs = false } = options;

    const application = await deps.prisma.enrollmentApplication.findUnique({
      where: { id },
      include: {
        learner: true,
        gradeLevel: true,
        schoolYear: true,
        addresses: true,
        familyMembers: true,
        previousSchool: true,
        checklist: {
          include: {
            updatedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        encodedBy: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
        enrollmentRecord: {
          include: {
            section: {
              include: {
                advisers: {
                  where: { status: "ACTIVE" },
                  include: {
                    teacher: {
                      select: { id: true, firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
            enrolledBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!application) {
      throw new AppError(404, "Application not found");
    }

    if (includeAuditLogs) {
      const auditLogs = await deps.prisma.auditLog.findMany({
        where: {
          subjectType: {
            in: [
              "Applicant",
              "EnrollmentApplication",
            ],
          },
          recordId: id,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return flattenAssessmentData({ ...application, auditLogs });
    }

    return flattenAssessmentData(application);
  }

  function toUpperCaseRecursive(obj: unknown): unknown {
    const skipKeys = ["studentPhoto", "email", "emailAddress", "password"];

    if (Array.isArray(obj)) {
      return obj.map((v) => toUpperCaseRecursive(v));
    }

    if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
      const newObj: Record<string, unknown> = {};
      for (const key in obj as Record<string, unknown>) {
        if (skipKeys.includes(key)) {
          newObj[key] = (obj as Record<string, unknown>)[key];
        } else {
          newObj[key] = toUpperCaseRecursive(
            (obj as Record<string, unknown>)[key],
          );
        }
      }
      return newObj;
    }

    if (typeof obj === "string") {
      return obj.trim().toUpperCase();
    }

    return obj;
  }

  async function updateApplicationStatus(
    id: number,
    status: ApplicationStatus,
    extraData: any = {},
    tx?: any,
  ) {
    const p = tx || deps.prisma;
    const enrollment = await p.enrollmentApplication.findUnique({
      where: { id },
      select: { id: true },
    });

    if (enrollment) {
      return p.enrollmentApplication.update({
        where: { id },
        data: { status, ...extraData },
      });
    }

    throw new AppError(404, "Application not found");
  }

  return {
    findApplicantOrThrow,
    assertTransition,
    flattenAssessmentData,
    getDetailedApplicationOrThrow,
    toUpperCaseRecursive,
    updateApplicationStatus,
  };
}
