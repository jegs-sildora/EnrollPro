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
    migrateEarlyRegToEnrollment,
  } = createEarlyRegistrationSharedService(deps);

  const LRN_REGEX = /^\d{12}$/;
  const FINALIZE_ALLOWED_STATUSES = new Set([
    "READY_FOR_SECTIONING",
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

  function assertReadingProfileCompleted(
    applicant: { readingProfileLevel?: string | null },
    contextMessage: string,
  ): void {
    if (!applicant.readingProfileLevel) {
      throw new AppError(422, contextMessage);
    }
  }

  async function approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { sectionId } = req.body;
      const { id } = req.params;
      let applicantId = parseInt(String(id));
      let { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      // ── Auto-Migration: Phase 1 -> Phase 2 ──
      if (appType === "EARLY_REGISTRATION") {
        const migratedApp = await deps.prisma.$transaction(async (tx) => {
          return await migrateEarlyRegToEnrollment(
            applicantId,
            req.user!.userId,
            tx,
          );
        });

        applicantId = migratedApp.id;
        applicant = migratedApp;
        appType = "ENROLLMENT";
      }

      const isAlreadySectioningReady =
        applicant.status === "READY_FOR_SECTIONING";

      if (!isAlreadySectioningReady) {
        assertTransition(
          applicant,
          "READY_FOR_SECTIONING",
          `Cannot approve an application with status "${applicant.status}". Only verification-complete applications can move to READY_FOR_SECTIONING.`,
        );
      }

      assertReadingProfileCompleted(
        applicant,
        "Reading Profile is required before section assignment. Encode a reading profile first.",
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

        const enrollment = await tx.enrollmentRecord.upsert({
          where: { enrollmentApplicationId: applicantId },
          update: {
            sectionId,
            schoolYearId: applicant.schoolYearId,
            enrolledById: req.user!.userId,
          },
          create: {
            enrollmentApplicationId: applicantId,
            sectionId,
            schoolYearId: applicant.schoolYearId,
            enrolledById: req.user!.userId,
          },
        });

        if (!isAlreadySectioningReady) {
          await updateApplicationStatus(applicantId, "READY_FOR_SECTIONING");
        }

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
      const { id } = req.params;
      let applicantId = parseInt(String(id));
      let { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      // ── Auto-Migration: Phase 1 -> Phase 2 ──
      // If we are verifying an early registration record, we must first promote it to enrollment.
      if (appType === "EARLY_REGISTRATION") {
        const migratedApp = await deps.prisma.$transaction(async (tx) => {
          const newApp = await migrateEarlyRegToEnrollment(
            applicantId,
            req.user!.userId,
            tx,
          );

          // We also need to carry over any "UNDER_REVIEW" intent if applicable,
          // though usually migration happens exactly at verification time.
          return newApp;
        });

        applicantId = migratedApp.id;
        applicant = migratedApp;
        appType = "ENROLLMENT";
      }

      const verificationEligibleStatuses = new Set([
        "EARLY_REG_SUBMITTED",
        "PRE_REGISTERED",
        "PENDING_VERIFICATION",
        "READY_FOR_SECTIONING",
        "SUBMITTED",
        "UNDER_REVIEW",
        "READY_FOR_ENROLLMENT",
      ]);

      if (!verificationEligibleStatuses.has(applicant.status)) {
        throw new AppError(
          422,
          `Cannot verify application with status "${applicant.status}". Only pending verification records can be verified.`,
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

      if (fullApplicant.checklist?.academicStatus === "RETAINED") {
        throw new AppError(
          422,
          "Retained learners cannot proceed to verification. Route this applicant to advising/rejection.",
        );
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

      const updated = await updateApplicationStatus(
        applicantId,
        "READY_FOR_SECTIONING",
      );

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

  async function updateReadingProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { readingProfileLevel, readingProfileNotes } = req.body as {
        readingProfileLevel: string;
        readingProfileNotes?: string | null;
      };

      let applicantId = parseInt(String(req.params.id));
      let { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      if (appType === "EARLY_REGISTRATION") {
        const migratedApp = await deps.prisma.$transaction(async (tx) => {
          return await migrateEarlyRegToEnrollment(
            applicantId,
            req.user!.userId,
            tx,
          );
        });

        applicantId = migratedApp.id;
        applicant = migratedApp;
        appType = "ENROLLMENT";
      }

      if (appType !== "ENROLLMENT") {
        throw new AppError(
          422,
          "Reading Profile can only be encoded on enrollment applications.",
        );
      }

      if (applicant.status === "REJECTED" || applicant.status === "WITHDRAWN") {
        throw new AppError(
          422,
          `Cannot encode Reading Profile while application is "${applicant.status}".`,
        );
      }

      const normalizedNotes =
        typeof readingProfileNotes === "string"
          ? readingProfileNotes.trim() || null
          : null;

      const updated = await prisma.enrollmentApplication.update({
        where: { id: applicantId },
        data: {
          readingProfileLevel: readingProfileLevel as any,
          readingProfileNotes: normalizedNotes,
          readingProfileAssessedAt: new Date(),
          readingProfileAssessedById: req.user!.userId,
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "READING_PROFILE_UPDATED",
        description: `Updated Reading Profile (${readingProfileLevel}) for application #${applicantId}`,
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

      if (fullApplicant.checklist?.academicStatus === "RETAINED") {
        throw new AppError(
          422,
          "Retained learners cannot proceed to enrollment finalization. Route this applicant to advising/rejection.",
        );
      }

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
          `Cannot finalize enrollment. Current status: "${fullApplicant.status}". Only READY_FOR_SECTIONING or TEMPORARILY_ENROLLED applications can be enrolled.`,
        );
      }

      assertReadingProfileCompleted(
        fullApplicant,
        "Reading Profile is required before finalizing enrollment. Encode a reading profile first.",
      );

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
            status: "OFFICIALLY_ENROLLED",
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
      console.error("[DEBUG_ERROR] controller method error:", error);
      next(error);
    }
  }

  async function unenroll(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const reason = String(req.body.reason ?? "").trim();
      const note =
        typeof req.body.note === "string" ? req.body.note.trim() : undefined;

      const { data: applicant } = await findApplicantOrThrow(applicantId);

      if (
        applicant.status !== "OFFICIALLY_ENROLLED" &&
        applicant.status !== "ENROLLED"
      ) {
        throw new AppError(
          422,
          "Only enrolled applications can be unenrolled.",
        );
      }

      const updated = await deps.prisma.$transaction(async (tx: any) => {
        // 1. Delete EnrollmentRecord (frees up capacity)
        await tx.enrollmentRecord.deleteMany({
          where: { enrollmentApplicationId: applicantId },
        });

        // 2. Revert status to sectioning-ready queue
        return await tx.enrollmentApplication.update({
          where: { id: applicantId },
          data: {
            status: "READY_FOR_SECTIONING",
            isProfileLocked: false,
            profileLockedAt: null,
            profileLockedById: null,
          },
          include: { learner: true },
        });
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_UNENROLLED",
        description: `Unenrolled learner ${updated.learner.firstName} ${updated.learner.lastName} (#${applicantId}). Reason: ${reason}.${note ? ` Note: ${note}` : ""}`,
        subjectType: "EnrollmentApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      console.error("[DEBUG_ERROR] controller method error:", error);
      next(error);
    }
  }

  async function specialEnrollment(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = req.body;
      const {
        lrn,
        firstName,
        lastName,
        learnerType,
        applicantType = "REGULAR",
        gradeLevelId,
      } = data;

      // 1. Create or Find Learner
      let learner = await prisma.learner.findFirst({
        where: lrn
          ? { lrn }
          : { firstName, lastName, birthdate: new Date(data.birthdate) },
      });

      if (!learner) {
        learner = await prisma.learner.create({
          data: {
            lrn,
            firstName,
            lastName,
            middleName: data.middleName,
            extensionName: data.extensionName,
            birthdate: new Date(data.birthdate),
            sex: data.sex,
            isPendingLrnCreation: !lrn,
          },
        });
      }

      // 2. Get active school year
      const settings = await prisma.schoolSetting.findFirst({
        select: { activeSchoolYearId: true },
      });
      if (!settings?.activeSchoolYearId) {
        throw new AppError(422, "No active school year found.");
      }

      const existingEnrollment = await prisma.enrollmentApplication.findFirst({
        where: {
          learnerId: learner.id,
          schoolYearId: settings.activeSchoolYearId,
          status: { notIn: ["REJECTED", "WITHDRAWN"] },
        },
        select: {
          id: true,
          status: true,
          trackingNumber: true,
        },
      });

      if (existingEnrollment) {
        throw new AppError(
          409,
          `An active enrollment already exists for this learner (Tracking: ${existingEnrollment.trackingNumber ?? `#${existingEnrollment.id}`}, Status: ${existingEnrollment.status}).`,
        );
      }

      // 3. Create Enrollment Application
      const application = await prisma.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: settings.activeSchoolYearId,
          gradeLevelId: parseInt(String(gradeLevelId)),
          applicantType: applicantType as any,
          learnerType: learnerType as any,
          status: "READY_FOR_SECTIONING",
          admissionChannel: "F2F",
          encodedById: req.user!.userId,
          isPrivacyConsentGiven: true,
        },
        include: { learner: true },
      });

      // 4. Create Tracking Number
      const year = new Date().getFullYear();
      const trackingNumber = `F2F-ENR-${year}-${String(application.id).padStart(5, "0")}`;

      const updated = await prisma.enrollmentApplication.update({
        where: { id: application.id },
        data: { trackingNumber },
        include: { learner: true, gradeLevel: true },
      });

      // 5. Create initial checklist
      await prisma.applicationChecklist.create({
        data: {
          enrollmentId: updated.id,
          academicStatus: data.academicStatus || "PROMOTED",
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_SUBMITTED",
        description: `Walk-in special enrollment created and auto-verified for ${updated.learner.firstName} ${updated.learner.lastName} (#${updated.id})`,
        subjectType: "EnrollmentApplication",
        recordId: updated.id,
        req,
      });

      res.status(201).json(updated);
    } catch (error) {
      console.error("[DEBUG_ERROR] specialEnrollment error:", error);
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
      const { id } = req.params;
      let applicantId = parseInt(String(id));
      let { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      // ── Auto-Migration: Phase 1 -> Phase 2 ──
      if (appType === "EARLY_REGISTRATION") {
        const migratedApp = await deps.prisma.$transaction(async (tx) => {
          return await migrateEarlyRegToEnrollment(
            applicantId,
            req.user!.userId,
            tx,
          );
        });

        applicantId = migratedApp.id;
        applicant = migratedApp;
        appType = "ENROLLMENT";
      }

      assertTransition(
        applicant,
        "TEMPORARILY_ENROLLED",
        `Cannot mark as temporarily enrolled. Current status: "${applicant.status}".`,
      );

      const checklist = await prisma.applicationChecklist.findUnique({
        where: { enrollmentId: applicantId },
        select: {
          isPsaBirthCertPresented: true,
          academicStatus: true,
        },
      });

      if (checklist?.academicStatus === "RETAINED") {
        throw new AppError(
          422,
          "Retained learners cannot proceed to temporary enrollment.",
        );
      }

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
        "academicStatus",
      ] as const;

      const filteredData: Partial<
        Record<
          Exclude<(typeof allowedFields)[number], "academicStatus">,
          boolean
        > & {
          academicStatus: "PROMOTED" | "RETAINED";
        }
      > = {};
      for (const key of allowedFields) {
        if (data[key] !== undefined) {
          if (key === "academicStatus") {
            const normalizedAcademicStatus = String(data[key])
              .trim()
              .toUpperCase();
            if (
              normalizedAcademicStatus !== "PROMOTED" &&
              normalizedAcademicStatus !== "RETAINED"
            ) {
              throw new AppError(
                422,
                "academicStatus must be PROMOTED or RETAINED.",
              );
            }
            filteredData.academicStatus = normalizedAcademicStatus as
              | "PROMOTED"
              | "RETAINED";
            continue;
          }

          filteredData[key] = Boolean(data[key]);
        }
      }

      // Determine if it's Early Registration or Enrollment
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      if (
        appType === "ENROLLMENT" &&
        filteredData.academicStatus === "RETAINED" &&
        (applicant.status === "OFFICIALLY_ENROLLED" ||
          applicant.status === "ENROLLED") &&
        applicant.status !== "WITHDRAWN"
      ) {
        throw new AppError(
          422,
          `Cannot mark applicant as RETAINED while status is "${applicant.status}".`,
        );
      }

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

      if (
        appType === "ENROLLMENT" &&
        filteredData.academicStatus === "RETAINED" &&
        applicant.status !== "REJECTED"
      ) {
        await updateApplicationStatus(applicantId, "REJECTED", {
          rejectionReason:
            "ACADEMIC STATUS: RETAINED - route to advising and regular planning.",
        });

        await auditLog({
          userId: req.user!.userId,
          actionType: "APPLICATION_REJECTED",
          description: `Auto-rejected enrollment application #${applicantId} after checklist academicStatus was set to RETAINED.`,
          subjectType: "EnrollmentApplication",
          recordId: applicantId,
          req,
        });
      }

      // Record individual audit entries for each changed requirement
      const fieldsToLabel: Partial<
        Record<
          Exclude<(typeof allowedFields)[number], "academicStatus">,
          string
        >
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

      if (
        filteredData.academicStatus !== undefined &&
        filteredData.academicStatus !== currentChecklist?.academicStatus
      ) {
        await auditLog({
          userId: req.user!.userId,
          actionType: "CHECKLIST_UPDATED",
          description: `Set academic status to ${filteredData.academicStatus} for applicant #${applicantId}`,
          subjectType:
            appType === "ENROLLMENT"
              ? "EnrollmentApplication"
              : "EarlyRegistrationApplication",
          recordId: applicantId,
          req,
        });
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

      // Require reason when rejecting from FAILED/FAILED_ASSESSMENT state per UX spec
      if (applicant.status === "FAILED_ASSESSMENT" && !rejectionReason) {
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

  async function markEligible(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const result = await updateApplicationStatus(applicantId, "ELIGIBLE");

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_MARKED_ELIGIBLE",
        description: `Marked application #${applicantId} as eligible for program assessment`,
        subjectType: "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async function offerRegular(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant } = await findApplicantOrThrow(applicantId);

      // Downgrade to REGULAR
      const updated = await deps.prisma.earlyRegistrationApplication.update({
        where: { id: applicantId },
        data: {
          applicantType: "REGULAR",
          status: "EARLY_REG_SUBMITTED",
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_TYPE_CHANGED",
        description: `Changed application type to REGULAR for #${applicantId}`,
        subjectType: "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  async function batchAssignSection(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { applicationIds, sectionId } = req.body;
      const targetSectionId = parseInt(String(sectionId));

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        throw new AppError(400, "At least one application ID is required.");
      }

      if (!targetSectionId) {
        throw new AppError(400, "Section ID is required.");
      }

      const results = await prisma.$transaction(async (tx) => {
        // 1. Lock and check section
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
          WHERE id = ${targetSectionId} 
          FOR UPDATE
        `;

        if (!section) throw new AppError(404, "Section not found");

        const enrolledCount = await tx.enrollmentRecord.count({
          where: { sectionId: targetSectionId },
        });

        if (enrolledCount + applicationIds.length > section.maxCapacity) {
          throw new AppError(
            422,
            `Section capacity exceeded. Only ${section.maxCapacity - enrolledCount} seats remaining.`,
          );
        }

        const batchResults = [];
        const { generatePortalPin } =
          await import("../../learner/portal-pin.service.js");

        for (const id of applicationIds) {
          const applicantId = parseInt(String(id));
          const applicant = await tx.enrollmentApplication.findUnique({
            where: { id: applicantId },
            include: { learner: true },
          });

          if (!applicant) continue;

          // Simple validation: applicant must be sectioning-ready.
          if (
            applicant.status !== "READY_FOR_SECTIONING" &&
            applicant.status !== "VERIFIED"
          ) {
            continue;
          }

          assertReadingProfileCompleted(
            applicant,
            `Reading Profile is required before section assignment (application #${applicantId}).`,
          );

          // Check Grade Level
          if (section.gradeLevelId !== applicant.gradeLevelId) continue;

          // Create Enrollment Record
          await tx.enrollmentRecord.create({
            data: {
              enrollmentApplicationId: applicantId,
              sectionId: targetSectionId,
              schoolYearId: applicant.schoolYearId,
              enrolledById: req.user!.userId,
            },
          });

          // Enroll
          const { hash: pinHash } = generatePortalPin();

          await tx.enrollmentApplication.update({
            where: { id: applicantId },
            data: {
              status: "OFFICIALLY_ENROLLED",
              portalPin: pinHash,
              portalPinChangedAt: new Date(),
              isProfileLocked: true,
              profileLockedAt: new Date(),
              profileLockedById: req.user!.userId,
            },
          });

          await tx.learner.update({
            where: { id: applicant.learnerId },
            data: { isPendingLrnCreation: false },
          });

          batchResults.push(applicantId);
        }

        return batchResults;
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "BATCH_SECTION_ASSIGNMENT",
        description: `Batch assigned and enrolled ${results.length} students to section #${targetSectionId}`,
        subjectType: "Section",
        recordId: targetSectionId,
        req,
      });

      res.json({
        success: true,
        count: results.length,
        applicationIds: results,
      });
    } catch (error) {
      next(error);
    }
  }

  return {
    approve,
    verify,
    updateReadingProfile,
    enroll,
    markTemporarilyEnrolled,
    assignLrn,
    updateChecklist,
    requestRevision,
    withdraw,
    reject,
    unenroll,
    specialEnrollment,
    batchAssignSection,
  };
}

const lifecycleController = createEarlyRegistrationLifecycleController();

export const approve = lifecycleController.approve;
export const verify = lifecycleController.verify;
export const updateReadingProfile = lifecycleController.updateReadingProfile;
export const enroll = lifecycleController.enroll;
export const unenroll = lifecycleController.unenroll;
export const specialEnrollment = lifecycleController.specialEnrollment;
export const batchAssignSection = lifecycleController.batchAssignSection;
export const markTemporarilyEnrolled =
  lifecycleController.markTemporarilyEnrolled;
export const assignLrn = lifecycleController.assignLrn;
export const updateChecklist = lifecycleController.updateChecklist;
export const requestRevision = lifecycleController.requestRevision;
export const withdraw = lifecycleController.withdraw;
export const reject = lifecycleController.reject;
