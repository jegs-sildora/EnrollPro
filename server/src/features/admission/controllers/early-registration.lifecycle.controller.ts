import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createEarlyRegistrationSharedService } from "../services/early-registration-shared.service.js";

export function createEarlyRegistrationLifecycleController(
  deps: AdmissionControllerDeps = createAdmissionControllerDeps(),
) {
  const { prisma, auditLog, getRequiredDocuments } = deps;
  const {
    findApplicantOrThrow,
    assertTransition,
    queueEmail,
    toUpperCaseRecursive,
    updateApplicationStatus,
  } = createEarlyRegistrationSharedService(deps);

  const LRN_REGEX = /^\d{12}$/;
  const FINALIZE_ALLOWED_STATUSES = new Set([
    "PRE_REGISTERED",
    "TEMPORARILY_ENROLLED",
  ]);
  const resolveExpectedSectionProgramType = (applicantType: string): string =>
    applicantType === "REGULAR" ? "REGULAR" : applicantType;

  interface DynamicDocumentRequirementRule {
    docId: string;
    policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
    phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
    notes?: string | null;
  }

  async function resolveDynamicDocumentRequirements(
    schoolYearId: number,
    applicantType: string,
  ): Promise<DynamicDocumentRequirementRule[] | null> {
    if (applicantType === "REGULAR") {
      return null;
    }

    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId,
          scpType: applicantType as any,
        },
      },
      select: { gradeRequirements: true },
    });

    if (!scpConfig?.gradeRequirements) {
      return null;
    }

    const payload = scpConfig.gradeRequirements as {
      documentRequirements?: DynamicDocumentRequirementRule[];
    };

    if (!Array.isArray(payload.documentRequirements)) {
      return null;
    }

    return payload.documentRequirements;
  }

  function isRequirementSatisfied(
    requirementType: string,
    checklist: {
      isPsaBirthCertPresented: boolean;
      isSf9Submitted: boolean;
      isConfirmationSlipReceived: boolean;
      isUndertakingSigned: boolean;
      isGoodMoralPresented: boolean;
      isMedicalEvalSubmitted: boolean;
      isCertOfRecognitionPresented: boolean;
    },
  ): boolean {
    switch (requirementType) {
      case "BEEF":
        return true;
      case "CONFIRMATION_SLIP":
        return checklist.isConfirmationSlipReceived;
      case "PSA_BIRTH_CERTIFICATE":
        return checklist.isPsaBirthCertPresented;
      case "SF9_REPORT_CARD":
      case "ACADEMIC_RECORD":
        return checklist.isSf9Submitted;
      case "AFFIDAVIT_OF_UNDERTAKING":
        return checklist.isUndertakingSigned;
      case "GOOD_MORAL_CERTIFICATE":
        return checklist.isGoodMoralPresented;
      case "MEDICAL_CERTIFICATE":
      case "MEDICAL_EVALUATION":
        return checklist.isMedicalEvalSubmitted;
      case "CERTIFICATE_OF_RECOGNITION":
        return checklist.isCertOfRecognitionPresented;
      default:
        return true;
    }
  }

  async function collectMissingMandatoryRequirements(fullApplicant: {
    schoolYearId: number;
    applicantType: string;
    learnerType: any;
    gradeLevel: { name: string };
    learner: { isLearnerWithDisability: boolean };
    checklist: {
      isPsaBirthCertPresented: boolean;
      isSf9Submitted: boolean;
      isConfirmationSlipReceived: boolean;
      isUndertakingSigned: boolean;
      isGoodMoralPresented: boolean;
      isMedicalEvalSubmitted: boolean;
      isCertOfRecognitionPresented: boolean;
    } | null;
  }): Promise<string[]> {
    if (!fullApplicant.checklist) {
      return ["Requirement checklist not found"];
    }

    const documentRequirements = await resolveDynamicDocumentRequirements(
      fullApplicant.schoolYearId,
      fullApplicant.applicantType,
    );

    const requirements = getRequiredDocuments({
      learnerType: fullApplicant.learnerType,
      gradeLevel: fullApplicant.gradeLevel.name,
      applicantType: fullApplicant.applicantType as any,
      isLwd: fullApplicant.learner.isLearnerWithDisability,
      isPeptAePasser: false,
      documentRequirements,
    });

    const missingMandatory: string[] = [];

    for (const requirement of requirements) {
      if (!requirement.isRequired) {
        continue;
      }

      const isMet = isRequirementSatisfied(
        requirement.type,
        fullApplicant.checklist,
      );

      if (!isMet) {
        missingMandatory.push(requirement.label);
      }
    }

    return missingMandatory;
  }

  async function approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { sectionId } = req.body;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "PRE_REGISTERED",
        `Cannot approve an application with status "${applicant.status}". Only VERIFIED, ELIGIBLE, or PASSED applications can be approved (moved to PRE_REGISTERED).`,
      );

      const result = await prisma.$transaction(async (tx) => {
        const [section] = await tx.$queryRaw<
          {
            id: number;
            maxCapacity: number;
            gradeLevelId: number;
            programType: string;
          }[]
        >`
        SELECT
          id,
          "max_capacity" as "maxCapacity",
          "grade_level_id" as "gradeLevelId",
          "program_type" as "programType"
        FROM "sections"
        WHERE id = ${sectionId}
        FOR UPDATE
      `;

        if (!section) throw new AppError(404, "Section not found");

        if (section.gradeLevelId !== applicant.gradeLevelId) {
          throw new AppError(
            422,
            "Selected section does not belong to the applicant's grade level.",
          );
        }

        const expectedProgramType = resolveExpectedSectionProgramType(
          applicant.applicantType,
        );
        if (section.programType !== expectedProgramType) {
          throw new AppError(
            422,
            `Selected section is tagged for ${section.programType} but applicant requires ${expectedProgramType}.`,
          );
        }

        const enrolledCount = await tx.enrollmentRecord.count({
          where: { sectionId },
        });
        if (enrolledCount >= section.maxCapacity) {
          throw new AppError(422, "This section has reached maximum capacity");
        }

        const enrollment = await tx.enrollmentRecord.create({
          data: {
            enrollmentApplicationId: applicantId,
            sectionId,
            schoolYearId: applicant.schoolYearId,
            enrolledById: req.user!.userId,
          },
        });

        await updateApplicationStatus(applicantId, "PRE_REGISTERED");

        return enrollment;
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_APPROVED",
        description: `Approved application #${applicantId} for ${applicant.learner.firstName} ${applicant.learner.lastName} and pre-registered to section ${sectionId}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? null,
        `Application Approved - ${applicant.trackingNumber}`,
        "APPLICATION_APPROVED",
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async function verify(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      if (appType !== "ENROLLMENT") {
        throw new AppError(
          422,
          "Verification is only available for enrollment applications.",
        );
      }

      if (applicant.status !== "UNDER_REVIEW") {
        throw new AppError(
          422,
          `Cannot verify application with status "${applicant.status}". Only UNDER_REVIEW applications can be verified.`,
        );
      }

      const fullApplicant = await prisma.enrollmentApplication.findUnique({
        where: { id: applicantId },
        include: {
          gradeLevel: true,
          checklist: true,
          learner: true,
        },
      });

      if (!fullApplicant) {
        throw new AppError(404, "Enrollment application not found.");
      }

      const missingMandatory = await collectMissingMandatoryRequirements({
        schoolYearId: fullApplicant.schoolYearId,
        applicantType: fullApplicant.applicantType,
        learnerType: fullApplicant.learnerType,
        gradeLevel: fullApplicant.gradeLevel,
        learner: {
          isLearnerWithDisability:
            fullApplicant.learner.isLearnerWithDisability,
        },
        checklist: fullApplicant.checklist
          ? {
              isPsaBirthCertPresented:
                fullApplicant.checklist.isPsaBirthCertPresented,
              isSf9Submitted: fullApplicant.checklist.isSf9Submitted,
              isConfirmationSlipReceived:
                fullApplicant.checklist.isConfirmationSlipReceived,
              isUndertakingSigned: fullApplicant.checklist.isUndertakingSigned,
              isGoodMoralPresented:
                fullApplicant.checklist.isGoodMoralPresented,
              isMedicalEvalSubmitted:
                fullApplicant.checklist.isMedicalEvalSubmitted,
              isCertOfRecognitionPresented:
                fullApplicant.checklist.isCertOfRecognitionPresented,
            }
          : null,
      });

      if (
        missingMandatory.length === 1 &&
        missingMandatory[0] === "Requirement checklist not found"
      ) {
        throw new AppError(
          422,
          "Requirement checklist not found for this applicant.",
        );
      }

      if (missingMandatory.length > 0) {
        throw Object.assign(
          new AppError(
            422,
            "Cannot mark as verified due to missing mandatory physical documents.",
          ),
          { missingRequirements: missingMandatory },
        );
      }

      assertTransition(
        applicant,
        "VERIFIED",
        `Cannot verify an application with status "${applicant.status}".`,
      );

      const updated = await updateApplicationStatus(applicantId, "VERIFIED");

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_VERIFIED",
        description: `Verified physical documents for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId})`,
        subjectType: "EnrollmentApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // Finalize Enrollment (Phase 2 complete)
  async function enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));

      const { data: applicant } = await findApplicantOrThrow(applicantId);

      // We need extra fields for enroll check
      const fullApplicant = await prisma.enrollmentApplication.findUnique({
        where: { id: applicantId },
        include: {
          gradeLevel: true,
          checklist: true,
          learner: true,
          enrollmentRecord: true,
        },
      });

      if (!fullApplicant)
        throw new AppError(
          422,
          "Official enrollment can only be finalized for enrollment applications.",
        );

      const learnerPendingLrn =
        (
          fullApplicant.learner as {
            isPendingLrnCreation?: boolean;
          }
        ).isPendingLrnCreation === true;

      if (learnerPendingLrn) {
        throw new AppError(
          422,
          "Cannot finalize official enrollment while learner is tagged as pending LRN creation.",
        );
      }

      if (!FINALIZE_ALLOWED_STATUSES.has(fullApplicant.status)) {
        throw new AppError(
          422,
          `Cannot finalize enrollment. Current status: "${fullApplicant.status}". Only PRE_REGISTERED or TEMPORARILY_ENROLLED applications can be enrolled.`,
        );
      }

      if (!fullApplicant.enrollmentRecord) {
        throw new AppError(
          422,
          "Cannot finalize official enrollment without a section assignment.",
        );
      }

      const missingMandatory = await collectMissingMandatoryRequirements({
        schoolYearId: fullApplicant.schoolYearId,
        applicantType: fullApplicant.applicantType,
        learnerType: fullApplicant.learnerType,
        gradeLevel: fullApplicant.gradeLevel,
        learner: {
          isLearnerWithDisability: fullApplicant.learner.isLearnerWithDisability,
        },
        checklist: fullApplicant.checklist
          ? {
              isPsaBirthCertPresented:
                fullApplicant.checklist.isPsaBirthCertPresented,
              isSf9Submitted: fullApplicant.checklist.isSf9Submitted,
              isConfirmationSlipReceived:
                fullApplicant.checklist.isConfirmationSlipReceived,
              isUndertakingSigned: fullApplicant.checklist.isUndertakingSigned,
              isGoodMoralPresented:
                fullApplicant.checklist.isGoodMoralPresented,
              isMedicalEvalSubmitted:
                fullApplicant.checklist.isMedicalEvalSubmitted,
              isCertOfRecognitionPresented:
                fullApplicant.checklist.isCertOfRecognitionPresented,
            }
          : null,
      });

      if (
        missingMandatory.length === 1 &&
        missingMandatory[0] === "Requirement checklist not found"
      ) {
        throw new AppError(
          422,
          "Requirement checklist not found for this applicant.",
        );
      }

      if (missingMandatory.length > 0) {
        throw Object.assign(
          new AppError(
            422,
            "Cannot finalize official enrollment due to missing mandatory documents. Please mark as TEMPORARILY ENROLLED instead.",
          ),
          { missingRequirements: missingMandatory },
        );
      }

      const { generatePortalPin } =
        await import("../../learner/portal-pin.service.js");
      const { raw: rawPin, hash: pinHash } = generatePortalPin();

      const updated = await prisma.$transaction(async (tx) => {
        const enrollment = await tx.enrollmentApplication.update({
          where: { id: applicantId },
          data: {
            status: "ENROLLED",
            isTemporarilyEnrolled: false,
            portalPin: pinHash,
            portalPinChangedAt: new Date(),
            isProfileLocked: true,
            profileLockedAt: new Date(),
            profileLockedById: req.user!.userId,
          },
        });

        await tx.learner.update({
          where: { id: fullApplicant.learnerId },
          data: { isPendingLrnCreation: false },
        });

        return enrollment;
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_ENROLLED",
        description: `Finalized official enrollment for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) - All mandatory docs verified`,
        subjectType: "EnrollmentApplication",
        recordId: applicantId,
        req,
      });

      res.json({ ...updated, rawPortalPin: rawPin });
    } catch (error) {
      next(error);
    }
  }

  // Mark as Temporarily Enrolled (Phase 2 - Missing Docs)
  async function markTemporarilyEnrolled(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "TEMPORARILY_ENROLLED",
        `Cannot mark as temporarily enrolled. Current status: "${applicant.status}".`,
      );

      const checklist =
        appType === "ENROLLMENT"
          ? await prisma.applicationChecklist.findUnique({
              where: { enrollmentId: applicantId },
              select: { isPsaBirthCertPresented: true },
            })
          : await prisma.applicationChecklist.findUnique({
              where: { earlyRegistrationId: applicantId },
              select: { isPsaBirthCertPresented: true },
            });

      if (
        applicant.learner.isPendingLrnCreation &&
        !checklist?.isPsaBirthCertPresented
      ) {
        throw new AppError(
          422,
          "PSA Birth Certificate is required before temporary enrollment for learners without LRN.",
        );
      }

      const updated = await updateApplicationStatus(
        applicantId,
        "TEMPORARILY_ENROLLED",
        {
          isTemporarilyEnrolled: true,
        },
      );

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_TEMPORARILY_ENROLLED",
        description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) as TEMPORARILY ENROLLED (awaiting docs)`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async function assignLrn(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const lrn = String(req.body?.lrn ?? "").trim();
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      if (!LRN_REGEX.test(lrn)) {
        throw new AppError(422, "LRN must be exactly 12 digits.");
      }

      try {
        await prisma.learner.update({
          where: { id: applicant.learnerId },
          data: {
            lrn,
            isPendingLrnCreation: false,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AppError(409, "LRN already exists.");
        }
        throw error;
      }

      await auditLog({
        userId: req.user!.userId,
        actionType: "LEARNER_LRN_ASSIGNED",
        description: `Assigned LRN ${lrn} to learner #${applicant.learnerId} from application #${applicantId}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json({
        message: "LRN assigned successfully.",
        learnerId: applicant.learnerId,
        lrn,
      });
    } catch (error) {
      next(error);
    }
  }

  // â"€â"€ Update Requirement Checklist â"€â"€
  async function updateChecklist(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const data = req.body;

      // Filter allowed fields only to prevent Prisma errors on extra fields
      const allowedFields = [
        "isPsaBirthCertPresented",
        "isOriginalPsaBcCollected",
        "isSf9Submitted",
        "isSf10Requested",
        "isGoodMoralPresented",
        "isMedicalEvalSubmitted",
        "isCertOfRecognitionPresented",
        "isUndertakingSigned",
        "isConfirmationSlipReceived",
      ] as const;

      const filteredData: Partial<
        Record<(typeof allowedFields)[number], boolean>
      > = {};
      for (const key of allowedFields) {
        if (data[key] !== undefined) {
          filteredData[key] = data[key];
        }
      }

      // Determine if it's Early Registration or Enrollment
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);
      const idField =
        appType === "ENROLLMENT" ? "enrollmentId" : "earlyRegistrationId";

      // Get current state for auditing
      const currentChecklist = await prisma.applicationChecklist.findUnique({
        where:
          idField === "enrollmentId"
            ? { enrollmentId: applicantId }
            : { earlyRegistrationId: applicantId },
      });

      const updated = await prisma.applicationChecklist.upsert({
        where:
          idField === "enrollmentId"
            ? { enrollmentId: applicantId }
            : { earlyRegistrationId: applicantId },
        update: { ...filteredData, updatedById: req.user!.userId },
        create: {
          ...filteredData,
          [idField]: applicantId,
          updatedById: req.user!.userId,
        },
      });

      // Record individual audit entries for each changed requirement
      const fieldsToLabel: Partial<
        Record<(typeof allowedFields)[number], string>
      > = {
        isPsaBirthCertPresented: "PSA Birth Certificate",
        isSf9Submitted: "SF9 / Report Card",
        isConfirmationSlipReceived: "Confirmation Slip",
        isSf10Requested: "SF10 (Permanent Record)",
        isGoodMoralPresented: "Good Moral Certificate",
        isMedicalEvalSubmitted: "Medical Evaluation",
        isCertOfRecognitionPresented: "Certificate of Recognition",
        isUndertakingSigned: "Affidavit of Undertaking",
      };

      for (const [key, label] of Object.entries(fieldsToLabel)) {
        const typedKey = key as (typeof allowedFields)[number];
        const newValue = filteredData[typedKey];
        const oldValue = currentChecklist ? currentChecklist[typedKey] : false;

        if (newValue !== undefined && newValue !== oldValue) {
          await auditLog({
            userId: req.user!.userId,
            actionType: newValue ? "DOCUMENT_ADDED" : "DOCUMENT_REMOVED",
            description: `${newValue ? "Added" : "Removed"} requirement: ${label} for applicant #${applicantId}`,
            subjectType:
              appType === "ENROLLMENT"
                ? "EnrollmentApplication"
                : "EarlyRegistrationApplication",
            recordId: applicantId,
            req,
          });
        }
      }

      await auditLog({
        userId: req.user!.userId,
        actionType: "CHECKLIST_UPDATED",
        description: `Updated requirement checklist for applicant #${applicantId}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // â"€â"€ Request Revision â"€â"€
  async function requestRevision(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { message } = toUpperCaseRecursive(req.body) as Record<
        string,
        unknown
      >;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "FOR_REVISION",
        `Cannot request revision for status "${applicant.status}"`,
      );

      const updated = await updateApplicationStatus(
        applicantId,
        "FOR_REVISION",
      );

      await auditLog({
        userId: req.user!.userId,
        actionType: "REVISION_REQUESTED",
        description: `Requested revision for #${applicantId}. Message: ${message || "N/A"}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // â"€â"€ Withdraw Application â"€â"€
  async function withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "WITHDRAWN",
        `Cannot withdraw application with status "${applicant.status}"`,
      );

      const updated = await updateApplicationStatus(applicantId, "WITHDRAWN");

      await auditLog({
        userId: req.user?.userId || null,
        actionType: "APPLICATION_WITHDRAWN",
        description: `Application #${applicantId} withdrawn`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // â"€â"€ Reject â"€â"€
  async function reject(req: Request, res: Response, next: NextFunction) {
    try {
      const rejectionReason = req.body.rejectionReason?.trim();
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "REJECTED",
        `Cannot reject an application with status "${applicant.status}".`,
      );

      // Require reason when rejecting from FAILED/NOT_QUALIFIED state per UX spec
      if (applicant.status === "NOT_QUALIFIED" && !rejectionReason) {
        throw new AppError(
          400,
          "A rejection reason is required when the applicant is not qualified.",
        );
      }

      const updated = await updateApplicationStatus(applicantId, "REJECTED", {
        rejectionReason: rejectionReason || null,
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_REJECTED",
        description: `Rejected application #${applicantId} for ${applicant.learner.firstName} ${applicant.learner.lastName}. Reason: ${rejectionReason || "N/A"}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? null,
        `Application Update - ${applicant.trackingNumber}`,
        "APPLICATION_REJECTED",
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // â"€â"€ Mark as eligible (cleared for assessment or regular approval) â"€â"€
  return {
    approve,
    verify,
    enroll,
    markTemporarilyEnrolled,
    assignLrn,
    updateChecklist,
    requestRevision,
    withdraw,
    reject,
  };
}

const lifecycleController = createEarlyRegistrationLifecycleController();

export const approve = lifecycleController.approve;
export const verify = lifecycleController.verify;
export const enroll = lifecycleController.enroll;
export const markTemporarilyEnrolled =
  lifecycleController.markTemporarilyEnrolled;
export const assignLrn = lifecycleController.assignLrn;
export const updateChecklist = lifecycleController.updateChecklist;
export const requestRevision = lifecycleController.requestRevision;
export const withdraw = lifecycleController.withdraw;
export const reject = lifecycleController.reject;
