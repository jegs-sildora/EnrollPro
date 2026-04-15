import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
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
  } = createEarlyRegistrationSharedService(deps);
  async function approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { sectionId } = req.body;
      const applicantId = parseInt(String(req.params.id));
      const applicant = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "PRE_REGISTERED",
        `Cannot approve an application with status "${applicant.status}". Only UNDER_REVIEW, ELIGIBLE, or PASSED applications can be approved (moved to PRE_REGISTERED).`,
      );

      const result = await prisma.$transaction(async (tx) => {
        const [section] = await tx.$queryRaw<
          { id: number; maxCapacity: number }[]
        >`
        SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE
      `;

        if (!section) throw new AppError(404, "Section not found");

        const enrolledCount = await tx.enrollment.count({
          where: { sectionId },
        });
        if (enrolledCount >= section.maxCapacity) {
          throw new AppError(422, "This section has reached maximum capacity");
        }

        const enrollment = await tx.enrollment.create({
          data: {
            applicantId,
            sectionId,
            schoolYearId: applicant.schoolYearId,
            enrolledById: req.user!.userId,
          },
        });

        await tx.applicant.update({
          where: { id: applicantId },
          data: { status: "PRE_REGISTERED" },
        });

        return enrollment;
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_APPROVED",
        description: `Approved application #${applicantId} for ${applicant.firstName} ${applicant.lastName} and pre-registered to section ${sectionId}`,
        subjectType: "Applicant",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.emailAddress,
        `Application Approved - ${applicant.trackingNumber}`,
        "APPLICATION_APPROVED",
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Finalize Enrollment (Phase 2 complete)
  async function enroll(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));

      const applicant = await prisma.applicant.findUnique({
        where: { id: applicantId },
        include: {
          gradeLevel: true,
          checklist: true,
        },
      });
      if (!applicant) throw new AppError(404, "Applicant not found");

      assertTransition(
        applicant,
        "ENROLLED",
        `Cannot finalize enrollment. Current status: "${applicant.status}". Only PRE_REGISTERED or TEMPORARILY_ENROLLED applications can be enrolled.`,
      );

      let dynamicDocumentRequirements: Array<{
        docId: string;
        policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
        phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
        notes?: string | null;
      }> | null = null;

      if (applicant.applicantType !== "REGULAR") {
        const scpConfig = await prisma.scpProgramConfig.findUnique({
          where: {
            uq_scp_program_configs_type: {
              schoolYearId: applicant.schoolYearId,
              scpType: applicant.applicantType,
            },
          },
          select: { documentRequirements: true },
        });

        if (Array.isArray(scpConfig?.documentRequirements)) {
          dynamicDocumentRequirements =
            scpConfig.documentRequirements as Array<{
              docId: string;
              policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
              phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
              notes?: string | null;
            }>;
        }
      }

      // Validate mandatory requirements for official enrollment
      const requirements = getRequiredDocuments({
        learnerType: applicant.learnerType,
        gradeLevel: applicant.gradeLevel.name,
        applicantType: applicant.applicantType,
        isLwd: applicant.isLearnerWithDisability,
        isPeptAePasser: false, // Default
        documentRequirements: dynamicDocumentRequirements,
      });

      const checklist = applicant.checklist;
      if (!checklist) {
        throw new AppError(
          422,
          "Requirement checklist not found for this applicant.",
        );
      }

      const missingMandatory: string[] = [];

      requirements.forEach((req) => {
        if (req.isRequired) {
          let isMet = false;
          switch (req.type) {
            case "BEEF":
              // BEEF is the form itself, we assume it's met if they applied
              isMet = true;
              break;
            case "CONFIRMATION_SLIP":
              isMet = checklist.isConfirmationSlipReceived;
              break;
            case "PSA_BIRTH_CERTIFICATE":
              // Official enrollment REQUIRES PSA BC (presented now or already on file).
              // Secondary proof only allows TEMPORARY enrollment.
              isMet = checklist.isPsaBirthCertPresented;
              break;
            case "SF9_REPORT_CARD":
            case "ACADEMIC_RECORD":
              isMet = checklist.isSf9Submitted;
              break;
            case "PEPT_AE_CERTIFICATE":
              // PEPT/A&E requirement is met if it was ever marked as presented
              // (Note: column isPeptAeSubmitted was dropped in favor of simplified checklist)
              isMet = false; // We don't have a direct field for this anymore in the simplified checklist
              break;
            // PWD_ID and MEDICAL_EVALUATION are marked as isRequired: false in our service for now
          }

          if (!isMet) {
            missingMandatory.push(req.label);
          }
        }
      });

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

      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: {
          status: "ENROLLED",
          isTemporarilyEnrolled: false,
          portalPin: pinHash,
          portalPinChangedAt: new Date(),
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_ENROLLED",
        description: `Finalized official enrollment for ${applicant.firstName} ${applicant.lastName} (#${applicantId}) - All mandatory docs verified`,
        subjectType: "Applicant",
        recordId: applicantId,
        req,
      });

      res.json({ ...updated, rawPortalPin: rawPin });
    } catch (error) {
      next(error);
    }
  }

  // ── Mark as Temporarily Enrolled (Phase 2 - Missing Docs) ──
  async function markTemporarilyEnrolled(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const applicant = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "TEMPORARILY_ENROLLED",
        `Cannot mark as temporarily enrolled. Current status: "${applicant.status}".`,
      );

      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: {
          status: "TEMPORARILY_ENROLLED",
          isTemporarilyEnrolled: true,
        },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_TEMPORARILY_ENROLLED",
        description: `Marked ${applicant.firstName} ${applicant.lastName} (#${applicantId}) as TEMPORARILY ENROLLED (awaiting docs)`,
        subjectType: "Applicant",
        recordId: applicantId,
        req,
      });

      res.json(updated);
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

      // Get current state for auditing
      const currentChecklist = await prisma.applicantChecklist.findUnique({
        where: { applicantId },
      });

      const updated = await prisma.applicantChecklist.upsert({
        where: { applicantId },
        update: { ...filteredData, updatedById: req.user!.userId },
        create: { ...filteredData, applicantId, updatedById: req.user!.userId },
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
            subjectType: "Applicant",
            recordId: applicantId,
            req,
          });
        }
      }

      await auditLog({
        userId: req.user!.userId,
        actionType: "CHECKLIST_UPDATED",
        description: `Updated requirement checklist for applicant #${applicantId}`,
        subjectType: "Applicant",
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
      const applicant = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "FOR_REVISION",
        `Cannot request revision for status "${applicant.status}"`,
      );

      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: { status: "FOR_REVISION" },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "REVISION_REQUESTED",
        description: `Requested revision for #${applicantId}. Message: ${message || "N/A"}`,
        subjectType: "Applicant",
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
      const applicant = await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "WITHDRAWN",
        `Cannot withdraw application with status "${applicant.status}"`,
      );

      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: { status: "WITHDRAWN" },
      });

      await auditLog({
        userId: req.user?.userId || null,
        actionType: "APPLICATION_WITHDRAWN",
        description: `Application #${applicantId} withdrawn`,
        subjectType: "Applicant",
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
      const applicant = await findApplicantOrThrow(applicantId);

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

      const updated = await prisma.applicant.update({
        where: { id: applicantId },
        data: { status: "REJECTED", rejectionReason: rejectionReason || null },
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_REJECTED",
        description: `Rejected application #${applicantId} for ${applicant.firstName} ${applicant.lastName}. Reason: ${rejectionReason || "N/A"}`,
        subjectType: "Applicant",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.emailAddress,
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
    enroll,
    markTemporarilyEnrolled,
    updateChecklist,
    requestRevision,
    withdraw,
    reject,
  };
}

const lifecycleController = createEarlyRegistrationLifecycleController();

export const approve = lifecycleController.approve;
export const enroll = lifecycleController.enroll;
export const markTemporarilyEnrolled =
  lifecycleController.markTemporarilyEnrolled;
export const updateChecklist = lifecycleController.updateChecklist;
export const requestRevision = lifecycleController.requestRevision;
export const withdraw = lifecycleController.withdraw;
export const reject = lifecycleController.reject;
