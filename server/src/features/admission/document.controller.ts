import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import fs from "fs";
import path from "path";
import { createEarlyRegistrationSharedService } from "./services/early-registration-shared.service.js";
import { createAdmissionControllerDeps } from "./services/admission-controller.deps.js";

const { findApplicantOrThrow } = createEarlyRegistrationSharedService(
  createAdmissionControllerDeps(),
);

export async function upload(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const { documentType } = req.body;

    if (!Number.isInteger(applicantId) || applicantId <= 0) {
      return res.status(400).json({ message: "Invalid applicant id" });
    }

    if (!documentType) {
      return res.status(400).json({ message: "documentType is required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { data: applicant, type: appType } =
      await findApplicantOrThrow(applicantId);
    const subjectType =
      appType === "ENROLLMENT"
        ? "EnrollmentApplication"
        : "EarlyRegistrationApplication";

    if (!applicant) {
      // Remove the uploaded file if applicant not found
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn(
          "[DocumentUpload] Failed to remove orphaned file:",
          unlinkError,
        );
      }
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Detect if it's Early Registration or Enrollment
    const enrollmentId = appType === "ENROLLMENT" ? applicantId : null;
    const earlyRegistrationId =
      appType === "ENROLLMENT" ? applicant.earlyRegistrationId : applicantId;

    // Automatically update checklist
    const checklistMapping: Record<string, string> = {
      PSA_BIRTH_CERTIFICATE: "isPsaBirthCertPresented",
      SECONDARY_BIRTH_PROOF: "isPsaBirthCertPresented",
      SF9_REPORT_CARD: "isSf9Submitted",
      SF10_PERMANENT_RECORD: "isSf10Requested",
      GOOD_MORAL_CERTIFICATE: "isGoodMoralPresented",
      MEDICAL_CERTIFICATE: "isMedicalEvalSubmitted",
      MEDICAL_EVALUATION: "isMedicalEvalSubmitted",
      CERTIFICATE_OF_RECOGNITION: "isCertOfRecognitionPresented",
      UNDERTAKING: "isUndertakingSigned",
      AFFIDAVIT_OF_UNDERTAKING: "isUndertakingSigned",
      CONFIRMATION_SLIP: "isConfirmationSlipReceived",
    };

    const checklistField = checklistMapping[documentType];
    if (!checklistField) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      return res
        .status(400)
        .json({ message: "Invalid document type for checklist" });
    }

    await prisma.$transaction(async (tx) => {
      // Find if a checklist exists for either ID
      const existingChecklist = await tx.applicationChecklist.findFirst({
        where: {
          OR: [
            ...(enrollmentId ? [{ enrollmentId }] : []),
            ...(earlyRegistrationId ? [{ earlyRegistrationId }] : []),
          ],
        },
      });

      if (existingChecklist) {
        await tx.applicationChecklist.update({
          where: { id: existingChecklist.id },
          data: {
            [checklistField]: true,
            updatedById: req.user!.userId,
            // Ensure both IDs are linked if available
            ...(enrollmentId && !existingChecklist.enrollmentId
              ? { enrollmentId }
              : {}),
            ...(earlyRegistrationId && !existingChecklist.earlyRegistrationId
              ? { earlyRegistrationId }
              : {}),
          },
        });
      } else {
        await tx.applicationChecklist.create({
          data: {
            enrollmentId,
            earlyRegistrationId,
            [checklistField]: true,
            updatedById: req.user!.userId,
          },
        });
      }
    });

    // Delete the file immediately as it's not needed in storage
    try {
      fs.unlinkSync(req.file.path);
    } catch (unlinkError) {
      console.warn(
        "[DocumentUpload] Failed to delete file after processing:",
        unlinkError,
      );
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Marked ${documentType} as presented for ${applicant!.learner.firstName} ${applicant!.learner.lastName} (#${applicantId})`,
      subjectType,
      recordId: applicantId,
      req,
    });

    res.status(200).json({ message: "Checklist updated successfully" });
  } catch (error: any) {
    console.error("[DocumentUpload]", error);
    res.status(500).json({ message: error.message });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const applicantId = parseInt(String(req.params.id));
    const { documentType } = req.body;

    if (!Number.isInteger(applicantId) || applicantId <= 0) {
      return res.status(400).json({ message: "Invalid applicant id" });
    }

    if (!documentType) {
      return res.status(400).json({ message: "documentType is required" });
    }

    const { data: applicant, type: appType } =
      await findApplicantOrThrow(applicantId);

    const subjectType =
      appType === "ENROLLMENT"
        ? "EnrollmentApplication"
        : "EarlyRegistrationApplication";

    const checklistMapping: Record<string, string> = {
      PSA_BIRTH_CERTIFICATE: "isPsaBirthCertPresented",
      SECONDARY_BIRTH_PROOF: "isPsaBirthCertPresented",
      SF9_REPORT_CARD: "isSf9Submitted",
      SF10_PERMANENT_RECORD: "isSf10Requested",
      GOOD_MORAL_CERTIFICATE: "isGoodMoralPresented",
      MEDICAL_CERTIFICATE: "isMedicalEvalSubmitted",
      MEDICAL_EVALUATION: "isMedicalEvalSubmitted",
      CERTIFICATE_OF_RECOGNITION: "isCertOfRecognitionPresented",
      UNDERTAKING: "isUndertakingSigned",
      AFFIDAVIT_OF_UNDERTAKING: "isUndertakingSigned",
      CONFIRMATION_SLIP: "isConfirmationSlipReceived",
    };

    const checklistField = checklistMapping[documentType];
    if (checklistField) {
      await prisma.applicationChecklist.updateMany({
        where: {
          OR: [
            { enrollmentId: applicantId },
            { earlyRegistrationId: applicantId },
            ...(appType === "ENROLLMENT" && applicant.earlyRegistrationId
              ? [{ earlyRegistrationId: applicant.earlyRegistrationId }]
              : []),
          ],
        },
        data: { [checklistField]: false, updatedById: req.user!.userId },
      });
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_REMOVED",
      description: `Unmarked ${documentType} for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId})`,
      subjectType,
      recordId: applicantId!,
      req,
    });

    res.json({ message: "Checklist updated successfully" });
  } catch (error: any) {
    console.error("[DocumentDelete]", error);
    res.status(500).json({ message: error.message });
  }
}
