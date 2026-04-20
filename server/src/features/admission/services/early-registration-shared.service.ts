import { AppError } from "../../../lib/AppError.js";
import type {
  EnrollmentApplication,
  EarlyRegistrationApplication,
  ApplicationStatus,
} from "../../../generated/prisma/index.js";
import {
  APPLICATION_STATUS_TO_TRACKING_STATUS,
  APPLICATION_VALID_TRANSITIONS,
} from "@enrollpro/shared";
import type { AdmissionControllerDeps } from "./admission-controller.deps.js";

export type PublicProgramType = "REGULAR" | "SCP";

export type PublicTrackingStatus =
  | "SUBMITTED"
  | "IN_REVIEW"
  | "ASSESSMENT_IN_PROGRESS"
  | "QUALIFIED_FOR_ENROLLMENT"
  | "ENROLLED"
  | "NOT_QUALIFIED"
  | "REJECTED"
  | "WITHDRAWN";

export type PublicCurrentStep =
  | "APPLICATION_SUBMITTED"
  | "REGISTRAR_REVIEW"
  | "ASSESSMENT_PHASE"
  | "ENROLLMENT_QUALIFICATION"
  | "ENROLLED";

type PublicAssessmentStepStatus = "PENDING" | "SCHEDULED" | "COMPLETED";

interface PublicAssessmentStep {
  stepOrder: number;
  kind: string;
  label: string;
  status: PublicAssessmentStepStatus;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  result: string | null;
  score: number | null;
  notes: string | null;
  conductedAt: string | null;
}

export interface PublicAssessmentData {
  phaseStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  latestSchedule: {
    stepOrder: number;
    label: string;
    kind: string;
    scheduledDate: string | null;
    scheduledTime: string | null;
    venue: string | null;
  } | null;
  steps: PublicAssessmentStep[];
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
]);

const RAW_TO_TRACKING_STATUS = APPLICATION_STATUS_TO_TRACKING_STATUS as Record<
  ApplicationStatus,
  PublicTrackingStatus
>;

export function deriveProgramType(
  applicantType: string | null | undefined,
): PublicProgramType {
  return applicantType && applicantType !== "REGULAR" ? "SCP" : "REGULAR";
}

export function normalizeTrackingStatus(
  status: string | null | undefined,
): PublicTrackingStatus {
  const normalized = String(status ?? "SUBMITTED")
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
      return "REGISTRAR_REVIEW";
    case "ASSESSMENT_IN_PROGRESS":
      return programType === "SCP" ? "ASSESSMENT_PHASE" : "REGISTRAR_REVIEW";
    case "QUALIFIED_FOR_ENROLLMENT":
      return "ENROLLMENT_QUALIFICATION";
    case "ENROLLED":
      return "ENROLLED";
    case "NOT_QUALIFIED":
      return programType === "SCP"
        ? "ASSESSMENT_PHASE"
        : "ENROLLMENT_QUALIFICATION";
    case "REJECTED":
    case "WITHDRAWN":
      return "REGISTRAR_REVIEW";
    default:
      return "APPLICATION_SUBMITTED";
  }
}

function resolveAssessmentPhaseStatus(
  steps: PublicAssessmentStep[],
): "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" {
  if (steps.length === 0) {
    return "NOT_STARTED";
  }

  if (steps.every((step) => step.status === "COMPLETED")) {
    return "COMPLETED";
  }

  if (
    steps.some(
      (step) =>
        step.status === "SCHEDULED" ||
        step.status === "COMPLETED" ||
        Boolean(step.scheduledDate),
    )
  ) {
    return "IN_PROGRESS";
  }

  return "NOT_STARTED";
}

function buildAssessmentData(
  programType: PublicProgramType,
  steps: PublicAssessmentStep[],
): PublicAssessmentData | null {
  if (programType !== "SCP") {
    return null;
  }

  const latestScheduleCandidate = [...steps]
    .filter((step) => Boolean(step.scheduledDate))
    .sort((a, b) => b.stepOrder - a.stepOrder)[0];

  return {
    phaseStatus: resolveAssessmentPhaseStatus(steps),
    latestSchedule: latestScheduleCandidate
      ? {
          stepOrder: latestScheduleCandidate.stepOrder,
          label: latestScheduleCandidate.label,
          kind: latestScheduleCandidate.kind,
          scheduledDate: latestScheduleCandidate.scheduledDate,
          scheduledTime: latestScheduleCandidate.scheduledTime,
          venue: latestScheduleCandidate.venue,
        }
      : null,
    steps,
  };
}

export function createInitialTrackingPayload(
  applicantType: string | null | undefined,
): {
  programType: PublicProgramType;
  status: PublicTrackingStatus;
  rawStatus: ApplicationStatus;
  currentStep: PublicCurrentStep;
  assessmentData: PublicAssessmentData | null;
} {
  const programType = deriveProgramType(applicantType);
  const status: PublicTrackingStatus = "IN_REVIEW";
  const rawStatus: ApplicationStatus = "PENDING_VERIFICATION";

  return {
    programType,
    status,
    rawStatus,
    currentStep: resolveCurrentStep(status, programType),
    assessmentData: buildAssessmentData(programType, []),
  };
}

export const VALID_TRANSITIONS = APPLICATION_VALID_TRANSITIONS as Record<
  string,
  ApplicationStatus[]
>;

export function createEarlyRegistrationSharedService(
  deps: AdmissionControllerDeps,
) {
  const LINKABLE_EARLY_REG_STATUSES = new Set<ApplicationStatus>([
    "EARLY_REG_SUBMITTED",
    "PRE_REGISTERED",
    "PENDING_VERIFICATION",
    "READY_FOR_SECTIONING",
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
  ]);

  async function findApplicantOrThrow(
    id: number,
    tx?: any,
  ): Promise<{ data: any; type: "ENROLLMENT" | "EARLY_REGISTRATION" }> {
    const p = tx || deps.prisma;
    const applicant = await p.enrollmentApplication.findUnique({
      where: { id },
      include: { learner: true, earlyRegistration: true, gradeLevel: true },
    });

    if (applicant) return { data: applicant, type: "ENROLLMENT" };

    // Fallback to early registration table
    const earlyReg = await p.earlyRegistrationApplication.findUnique({
      where: { id },
      include: { learner: true, gradeLevel: true },
    });

    if (!earlyReg) throw new AppError(404, "Application not found");
    return { data: earlyReg, type: "EARLY_REGISTRATION" };
  }

  async function findEarlyRegOrThrow(id: number): Promise<
    EarlyRegistrationApplication & {
      learner: { firstName: string; lastName: string; lrn: string | null };
    }
  > {
    const earlyReg = await deps.prisma.earlyRegistrationApplication.findUnique({
      where: { id },
      include: { learner: true },
    });
    if (!earlyReg)
      throw new AppError(404, "Early registration application not found");
    return earlyReg as any;
  }

  function assertTransition(
    application: { status: ApplicationStatus },
    to: ApplicationStatus,
    contextMessage?: string,
  ): void {
    if (!(VALID_TRANSITIONS[application.status]?.includes(to) ?? false)) {
      throw new AppError(
        422,
        contextMessage ??
          `Cannot transition from "${application.status}" to "${to}".`,
      );
    }
  }

  async function queueEmail(
    applicationId: number,
    recipient: string | null,
    subject: string,
    trigger: any,
  ): Promise<void> {
    if (!recipient) return;
    try {
      await deps.prisma.emailLog.create({
        data: { recipient, subject, trigger, status: "PENDING", applicationId },
      });
    } catch {
      // Non-critical: don't fail request on email queue errors
    }
  }

  async function flattenAssessmentData(application: Record<string, any>) {
    // Check if it's EarlyRegistrationApplication or EnrollmentApplication
    const assessments = (application.assessments ||
      application.earlyRegistration?.assessments ||
      []) as Array<{
      id: number;
      type: string;
      stepOrder: number | null;
      scheduledDate: string | null;
      scheduledTime: string | null;
      venue: string | null;
      score: number | null;
      result: string | null;
      notes: string | null;
      conductedAt: string | null;
    }>;

    const scpDetail = application.programDetail ?? null;

    let pipelineSteps: Array<{
      stepOrder: number;
      kind: string;
      label: string;
      description: string | null;
      isRequired: boolean;
      scheduledDate: string | null;
      scheduledTime: string | null;
      venue: string | null;
      notes: string | null;
      cutoffScore: number | null;
    }> = [];

    if (application.applicantType !== "REGULAR") {
      const scpConfig = await deps.prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: application.schoolYearId,
            scpType: application.applicantType,
          },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });

      if (scpConfig) {
        pipelineSteps = scpConfig.steps.map((s) => ({
          stepOrder: s.stepOrder,
          kind: s.kind,
          label: s.label,
          description: s.description,
          isRequired: s.isRequired,
          scheduledDate: s.scheduledDate?.toISOString() ?? null,
          scheduledTime: s.scheduledTime,
          venue: s.venue,
          notes: s.notes,
          cutoffScore: s.cutoffScore ?? null,
        }));
      }
    }

    const steps = pipelineSteps.map((step) => {
      const matchesForKind = assessments.filter((a) => a.type === step.kind);
      const match =
        matchesForKind.length > 1
          ? matchesForKind.reduce((latest, current) =>
              current.id > latest.id ? current : latest,
            )
          : (matchesForKind[0] ?? null);

      let stepStatus: "PENDING" | "SCHEDULED" | "COMPLETED" = "PENDING";
      if (match?.conductedAt || match?.result != null || match?.score != null) {
        stepStatus = "COMPLETED";
      } else if (match?.scheduledDate) {
        stepStatus = "SCHEDULED";
      }

      return {
        stepOrder: step.stepOrder,
        kind: step.kind,
        label: step.label,
        description: step.description,
        isRequired: step.isRequired,
        configDate: step.scheduledDate,
        configTime: step.scheduledTime,
        configVenue: step.venue,
        configNotes: step.notes,
        cutoffScore: step.cutoffScore ?? null,
        assessmentId: match?.id ?? null,
        scheduledDate: match?.scheduledDate ?? null,
        scheduledTime: match?.scheduledTime ?? null,
        venue: match?.venue ?? null,
        score: match?.score ?? null,
        result: match?.result ?? null,
        notes: match?.notes ?? null,
        conductedAt: match?.conductedAt ?? null,
        status: stepStatus,
      };
    });

    const primary = assessments[0] ?? null;
    const interview = assessments.find((a) => a.type === "INTERVIEW") ?? null;

    const programType = deriveProgramType(application.applicantType);
    const trackingStatus = normalizeTrackingStatus(application.status);
    const currentStep = resolveCurrentStep(trackingStatus, programType);
    const publicAssessmentSteps: PublicAssessmentStep[] = steps.map((step) => ({
      stepOrder: step.stepOrder,
      kind: step.kind,
      label: step.label,
      status: step.status,
      scheduledDate: step.scheduledDate ?? step.configDate ?? null,
      scheduledTime: step.scheduledTime ?? step.configTime ?? null,
      venue: step.venue ?? step.configVenue ?? null,
      result: step.result ?? null,
      score: step.score ?? null,
      notes: step.notes ?? step.configNotes ?? null,
      conductedAt: step.conductedAt ?? null,
    }));
    const assessmentData = buildAssessmentData(
      programType,
      publicAssessmentSteps,
    );

    // Normalize name fields if it's joined from learner table
    const learner = application.learner || application;

    // Map family members (Early Registration and Enrollment use 'familyMembers' relation)
    const familyMembers = (application.familyMembers || []) as any[];
    const mother = familyMembers.find((m) => m.relationship === "MOTHER");
    const father = familyMembers.find((m) => m.relationship === "FATHER");
    const guardian = familyMembers.find((m) => m.relationship === "GUARDIAN");

    const prevSchool = application.previousSchool || null;

    // Map addresses (Enrollment uses 'addresses' relation)
    const addresses = (application.addresses || []) as any[];
    const currentAddr = addresses.find((a) => a.addressType === "CURRENT");
    const permanentAddr = addresses.find((a) => a.addressType === "PERMANENT");

    const primaryContact =
      application.primaryContact ??
      application.earlyRegistration?.primaryContact ??
      null;

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
      application.enrollmentRecord?.section?.programType ??
      scpDetail?.scpType ??
      application.applicantType ??
      "REGULAR";

    return {
      ...application,
      status: application.status,
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
        application.earlyRegistration?.email ||
        application.emailAddress ||
        application.email ||
        guardianEmail ||
        motherEmail ||
        fatherEmail ||
        null,

      lastSchoolName: prevSchool?.schoolName || application.lastSchoolName,
      lastSchoolId: prevSchool?.schoolDepedId || application.lastSchoolId,
      lastGradeCompleted:
        prevSchool?.gradeCompleted || application.lastGradeCompleted,
      schoolYearLastAttended:
        prevSchool?.schoolYearAttended || application.schoolYearLastAttended,
      lastSchoolAddress:
        prevSchool?.schoolAddress || application.lastSchoolAddress,
      lastSchoolType: prevSchool?.schoolType || application.lastSchoolType,

      learningProgram,
      programType,
      trackingStatus,
      currentStep,
      assessmentData,

      isScpApplication: application.applicantType !== "REGULAR",
      scpType:
        scpDetail?.scpType ??
        (application.applicantType !== "REGULAR"
          ? application.applicantType
          : null),
      artField: scpDetail?.artField ?? null,
      foreignLanguage: scpDetail?.foreignLanguage ?? null,
      sportsList: scpDetail?.sportsList ?? [],
      assessmentSteps: steps,
      assessmentType: primary?.type ?? null,
      examDate: primary?.scheduledDate ?? null,
      examVenue: primary?.venue ?? null,
      examScore: primary?.score ?? null,
      examResult: primary?.result ?? null,
      examNotes: primary?.notes ?? null,
      interviewDate: interview?.scheduledDate ?? null,
      interviewResult: interview?.result ?? null,
      interviewNotes: interview?.notes ?? null,
    };
  }

  async function getDetailedApplicationOrThrow(
    id: number,
    options: {
      includeAuditLogs?: boolean;
      allowEnrollmentFallback?: boolean;
    } = {},
  ) {
    const { includeAuditLogs = false, allowEnrollmentFallback = true } =
      options;

    let application: Record<string, any> | null = null;

    if (allowEnrollmentFallback) {
      application = await deps.prisma.enrollmentApplication.findUnique({
        where: { id },
        include: {
          learner: true,
          gradeLevel: true,
          schoolYear: true,
          addresses: true,
          familyMembers: true,
          previousSchool: true,
          earlyRegistration: {
            include: {
              assessments: { orderBy: { createdAt: "desc" } },
            },
          },
          programDetail: true,
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
                  advisingTeacher: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
              enrolledBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          emailLogs: {
            orderBy: { attemptedAt: "desc" },
            take: 10,
          },
        },
      });
    }

    if (!application) {
      application = await deps.prisma.earlyRegistrationApplication.findUnique({
        where: { id },
        include: {
          learner: true,
          gradeLevel: true,
          schoolYear: true,
          familyMembers: true,
          addresses: true,
          assessments: { orderBy: { createdAt: "desc" } },
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
          verifiedBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      });
    }

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
              "EarlyRegistrationApplication",
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

    const earlyReg = await p.earlyRegistrationApplication.findUnique({
      where: { id },
      select: { id: true },
    });

    if (earlyReg) {
      return p.earlyRegistrationApplication.update({
        where: { id },
        data: { status, ...extraData },
      });
    }

    throw new AppError(404, "Application not found");
  }

  async function resolveLinkedEarlyRegistration(
    params: {
      requestedEarlyRegistrationId: unknown;
      activeSchoolYearId: number;
      submittedLrn: string | null;
      expectedApplicantType: string;
    },
    tx?: any,
  ): Promise<{
    linkedEarlyRegistrationId: number | null;
    reason:
      | "missing"
      | "invalid"
      | "school_year_mismatch"
      | "lrn_mismatch"
      | "applicant_type_mismatch"
      | "status_ineligible"
      | "ok";
  }> {
    const {
      requestedEarlyRegistrationId,
      activeSchoolYearId,
      submittedLrn,
      expectedApplicantType,
    } = params;

    if (
      typeof requestedEarlyRegistrationId !== "number" ||
      !Number.isInteger(requestedEarlyRegistrationId) ||
      requestedEarlyRegistrationId <= 0
    ) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "missing",
      };
    }

    const p = tx || deps.prisma;
    const linkedEarlyRegistration =
      await p.earlyRegistrationApplication.findUnique({
        where: { id: requestedEarlyRegistrationId },
        select: {
          id: true,
          schoolYearId: true,
          status: true,
          applicantType: true,
          learner: { select: { lrn: true } },
        },
      });

    if (!linkedEarlyRegistration) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "invalid",
      };
    }

    if (linkedEarlyRegistration.schoolYearId !== activeSchoolYearId) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "school_year_mismatch",
      };
    }

    if (
      submittedLrn &&
      linkedEarlyRegistration.learner?.lrn &&
      linkedEarlyRegistration.learner.lrn !== submittedLrn
    ) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "lrn_mismatch",
      };
    }

    if (
      expectedApplicantType !== "REGULAR" &&
      linkedEarlyRegistration.applicantType !== expectedApplicantType
    ) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "applicant_type_mismatch",
      };
    }

    if (!LINKABLE_EARLY_REG_STATUSES.has(linkedEarlyRegistration.status)) {
      return {
        linkedEarlyRegistrationId: null,
        reason: "status_ineligible",
      };
    }

    return {
      linkedEarlyRegistrationId: linkedEarlyRegistration.id,
      reason: "ok",
    };
  }

  async function migrateEarlyRegToEnrollment(
    earlyRegId: number,
    userId: number,
    tx?: any,
  ): Promise<EnrollmentApplication> {
    const p = tx || deps.prisma;

    // 1. Fetch early registration record with all needed relations
    const earlyReg = await p.earlyRegistrationApplication.findUnique({
      where: { id: earlyRegId },
      include: {
        learner: true,
        addresses: true,
        familyMembers: true,
        gradeLevel: true,
      },
    });

    if (!earlyReg) {
      throw new AppError(404, "Early registration not found for migration.");
    }

    const runMigration = async (ptx: any): Promise<EnrollmentApplication> => {
      const existingEnrollment = await ptx.enrollmentApplication.findFirst({
        where: { earlyRegistrationId: earlyReg.id },
        include: {
          learner: true,
          earlyRegistration: true,
          gradeLevel: true,
        },
      });

      // Idempotency guard: re-use existing phase 2 record instead of creating duplicates.
      if (existingEnrollment) {
        await ptx.earlyRegistrationApplication.update({
          where: { id: earlyReg.id },
          data: { status: "PRE_REGISTERED" },
        });

        return existingEnrollment;
      }

      const year = new Date().getFullYear();

      // Create Phase 2 Enrollment Application
      const created = await ptx.enrollmentApplication.create({
        data: {
          learnerId: earlyReg.learnerId,
          earlyRegistrationId: earlyReg.id,
          schoolYearId: earlyReg.schoolYearId,
          gradeLevelId: earlyReg.gradeLevelId,
          applicantType: earlyReg.applicantType,
          learnerType: earlyReg.learnerType,
          status: "PENDING_VERIFICATION",
          admissionChannel: "F2F", // Registrar-initiated migration
          encodedById: userId,
          studentPhoto: earlyReg.studentPhoto,
          isPrivacyConsentGiven: earlyReg.isPrivacyConsentGiven,
          guardianRelationship: earlyReg.guardianRelationship,
          hasNoMother: earlyReg.hasNoMother,
          hasNoFather: earlyReg.hasNoFather,
        },
      });

      // Generate Phase 2 Tracking Number
      let prefix = "ENR";
      if (earlyReg.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING")
        prefix = "STE";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS")
        prefix = "SPA";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_SPORTS")
        prefix = "SPS";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM")
        prefix = "SPJ";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE")
        prefix = "SPFL";
      else if (
        earlyReg.applicantType ===
        "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION"
      )
        prefix = "SPTVE";

      const trackingNumber = `${prefix}-${year}-${String(created.id).padStart(5, "0")}`;

      const finalApp = await ptx.enrollmentApplication.update({
        where: { id: created.id },
        data: { trackingNumber },
        include: {
          learner: true,
          earlyRegistration: true,
          gradeLevel: true,
        },
      });

      // Re-link existing Addresses, Family Members, and Checklist to the new Phase 2 app
      await ptx.applicationAddress.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id },
      });

      await ptx.applicationFamilyMember.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id },
      });

      await ptx.applicationChecklist.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id },
      });

      // Keep the phase 1 record as pre-registered after migration to phase 2.
      await ptx.earlyRegistrationApplication.update({
        where: { id: earlyReg.id },
        data: { status: "PRE_REGISTERED" },
      });

      return finalApp;
    };

    const enrollmentApp = tx
      ? await runMigration(tx)
      : await deps.prisma.$transaction(async (ptx) => runMigration(ptx));

    return enrollmentApp;
  }

  return {
    findApplicantOrThrow,
    findEarlyRegOrThrow,
    assertTransition,
    queueEmail,
    flattenAssessmentData,
    getDetailedApplicationOrThrow,
    toUpperCaseRecursive,
    updateApplicationStatus,
    resolveLinkedEarlyRegistration,
    migrateEarlyRegToEnrollment,
  };
}
