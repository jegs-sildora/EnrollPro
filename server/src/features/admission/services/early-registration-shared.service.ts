import { AppError } from "../../../lib/AppError.js";
import type {
  EnrollmentApplication,
  EarlyRegistrationApplication,
  ApplicationStatus,
} from "../../../generated/prisma/index.js";
import type { AdmissionControllerDeps } from "./admission-controller.deps.js";

export const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "READY_FOR_ENROLLMENT",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "VERIFIED",
    "FOR_REVISION",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["EXAM_SCHEDULED", "READY_FOR_ENROLLMENT", "WITHDRAWN"],
  EXAM_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "SUBMITTED",
    "FAILED_ASSESSMENT",
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "READY_FOR_ENROLLMENT",
    "INTERVIEW_SCHEDULED",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: ["READY_FOR_ENROLLMENT", "SUBMITTED", "WITHDRAWN"],
  READY_FOR_ENROLLMENT: [
    "ENROLLED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  FAILED_ASSESSMENT: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

export function createEarlyRegistrationSharedService(
  deps: AdmissionControllerDeps,
) {
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

    // 2. Perform Migration Transaction
    const enrollmentApp = await (tx ? Promise.resolve(tx) : deps.prisma.$transaction(async (ptx) => {
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
          status: "SUBMITTED",
          admissionChannel: "F2F", // Registrar-initiated migration
          encodedById: userId,
          studentPhoto: earlyReg.studentPhoto,
          isPrivacyConsentGiven: earlyReg.isPrivacyConsentGiven,
          guardianRelationship: earlyReg.guardianRelationship,
          hasNoMother: earlyReg.hasNoMother,
          hasNoFather: earlyReg.hasNoFather,
        }
      });

      // Generate Phase 2 Tracking Number
      let prefix = "ENR";
      if (earlyReg.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") prefix = "STE";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS") prefix = "SPA";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_SPORTS") prefix = "SPS";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM") prefix = "SPJ";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE") prefix = "SPFL";
      else if (earlyReg.applicantType === "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION") prefix = "SPTVE";

      const trackingNumber = `${prefix}-${year}-${String(created.id).padStart(5, "0")}`;
      
      const finalApp = await ptx.enrollmentApplication.update({
        where: { id: created.id },
        data: { trackingNumber }
      });

      // Re-link existing Addresses, Family Members, and Checklist to the new Phase 2 app
      await ptx.applicationAddress.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id }
      });

      await ptx.applicationFamilyMember.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id }
      });

      await ptx.applicationChecklist.updateMany({
        where: { earlyRegistrationId: earlyReg.id },
        data: { enrollmentId: finalApp.id }
      });

      // Mark original Phase 1 record as "Enrolled" (Migrated)
      await ptx.earlyRegistrationApplication.update({
        where: { id: earlyReg.id },
        data: { status: "ENROLLED" }
      });

      return finalApp;
    }));

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
    migrateEarlyRegToEnrollment,
  };
}
