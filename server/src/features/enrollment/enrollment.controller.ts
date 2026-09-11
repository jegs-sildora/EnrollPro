import type { NextFunction, Request, Response } from "express";
import type { DirectEncodeWalkInPayload } from "@enrollpro/shared";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { broadcastEnrollmentInvalidation } from "../../lib/realtime-events.js";
import { isStaffIntakeAllowed } from "../settings/enrollment-gate.service.js";
import type { ApplicantType } from "../../generated/prisma/index.js";
import { resolveActiveSchoolYearState } from "../school-year/services/active-school-year.service.js";
import {
  fetchAtlasSubjectCatalog,
  getPreviousJhsGradeNumber,
  type AtlasSubjectCatalogItem,
} from "../integration/atlas-subject-catalog.service.js";

interface StaffIntakeContext {
  schoolYearId: number;
  systemPhase: string;
}

const walkInProgramTypes = new Set<ApplicantType>([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
]);

interface ResolvedWalkInSubjectCatalog {
  incomingGradeLevel: number;
  subjectGradeLevel: number;
  subjectGradeLevelId: number;
  subjects: AtlasSubjectCatalogItem[];
}

async function assertStaffIntakeAllowed(): Promise<StaffIntakeContext> {
  const activeResolution = await resolveActiveSchoolYearState();
  if (activeResolution.state !== "VALID") {
    throw new AppError(
      409,
      activeResolution.state === "INVALID"
        ? activeResolution.message
        : "Initialize the active school year before processing learner intake.",
    );
  }

  const setting = await prisma.schoolSetting.findUnique({
    where: { id: activeResolution.active.settingId },
    select: { systemPhase: true },
  });
  if (!isStaffIntakeAllowed(setting?.systemPhase)) {
    throw new AppError(
      403,
      "Learner intake is locked during EOSY Closing. Complete enrollment changes before starting year-end processing.",
    );
  }

  return {
    schoolYearId: activeResolution.active.schoolYearId,
    systemPhase: setting!.systemPhase,
  };
}

function parseWalkInProgramType(value: unknown): ApplicantType {
  if (typeof value !== "string" || !walkInProgramTypes.has(value as ApplicantType)) {
    throw new AppError(400, "A supported curriculum type is required.");
  }
  return value as ApplicantType;
}

async function resolveWalkInSubjectCatalog(
  gradeLevelId: number,
  programType: ApplicantType,
): Promise<ResolvedWalkInSubjectCatalog> {
  const incomingGradeLevel = await prisma.gradeLevel.findUnique({
    where: { id: gradeLevelId },
    select: { displayOrder: true },
  });

  if (
    !incomingGradeLevel ||
    incomingGradeLevel.displayOrder < 7 ||
    incomingGradeLevel.displayOrder > 10
  ) {
    throw new AppError(400, "Select a valid Grade 7 to Grade 10 level.");
  }

  const subjectGradeNumber = getPreviousJhsGradeNumber(
    incomingGradeLevel.displayOrder,
  );

  const subjectGradeLevels = await prisma.gradeLevel.findMany({
    where: { displayOrder: subjectGradeNumber },
    select: { id: true, displayOrder: true },
    take: 2,
  });
  if (subjectGradeLevels.length !== 1) {
    throw new AppError(
      409,
      `Grade ${subjectGradeNumber} must resolve to exactly one EnrollPro grade-level record.`,
    );
  }
  const subjectGradeLevel = subjectGradeLevels[0]!;

  const schoolId = process.env.ATLAS_SCHOOL_ID?.trim() || "1";
  const subjects = await fetchAtlasSubjectCatalog({
    schoolId,
    gradeLevel: subjectGradeLevel.displayOrder,
    programType,
  });

  return {
    incomingGradeLevel: incomingGradeLevel.displayOrder,
    subjectGradeLevel: subjectGradeLevel.displayOrder,
    subjectGradeLevelId: subjectGradeLevel.id,
    subjects,
  };
}

export async function getWalkInAtlasSubjects(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await assertStaffIntakeAllowed();
    const gradeLevelId = Number(req.query.gradeLevelId);
    if (!Number.isInteger(gradeLevelId) || gradeLevelId <= 0) {
      throw new AppError(400, "A valid gradeLevelId is required.");
    }

    const programType = parseWalkInProgramType(req.query.programType);
    const catalog = await resolveWalkInSubjectCatalog(
      gradeLevelId,
      programType,
    );

    res.json({
      data: catalog.subjects,
      meta: {
        source: "ATLAS",
        gradeLevelId,
        incomingGradeLevel: catalog.incomingGradeLevel,
        subjectGradeLevelId: catalog.subjectGradeLevelId,
        subjectGradeLevel: catalog.subjectGradeLevel,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    next(error);
  }
}


// ─── Intake Finalization ─────────────────────────────────────────────────────

/**
 * POST /api/enrollment/finalize-intake
 *
 * Intake Desk Tab 3 — Finalizes a learner's physical document confirmation:
 *  - Saves height (cm) and weight (kg)
 *  - Verifies the physical document checklist
 *  - Advances status from PENDING_VERIFICATION to READY_FOR_SECTIONING
 *  - Fires Notification Event A (Intake Receipt Confirmation)
 */
export async function finalizeIntake(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;

  const {
    applicationId,
    heightCm,
    weightKg,
    checklistVerified,
    isMissingSf9,
    isMissingPsa,
    assignedProgram,
  }: {
    applicationId: number;
    heightCm?: number;
    weightKg?: number;
    checklistVerified: boolean;
    isMissingSf9?: boolean;
    isMissingPsa?: boolean;
    assignedProgram?: ApplicantType;
  } = req.body;

  if (!applicationId) {
    throw new AppError(400, "applicationId is required.");
  }

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    include: {
      learner: { select: { firstName: true, lastName: true, lrn: true } },
      schoolYear: { select: { yearLabel: true } },
      gradeLevel: { select: { name: true } },
      familyMembers: {
        select: {
          relationship: true,
          firstName: true,
          lastName: true,
          contactNumber: true,
          email: true,
        },
      },
    },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  if (application.status !== "PENDING_VERIFICATION") {
    throw new AppError(
      409,
      `Application is in status '${application.status}'. ` +
        `Only PENDING_VERIFICATION applications can be finalized at intake.`,
    );
  }

  const setting = await prisma.schoolSetting.findFirst({ select: { systemPhase: true } });

  // Wrap in transaction: save BMI + update status
  await prisma.$transaction(async (tx) => {
    await tx.enrollmentApplication.update({
      where: { id: applicationId },
      data: {
        status: "READY_FOR_SECTIONING",
        intakeHeightCm: heightCm ?? undefined,
        intakeWeightKg: weightKg ?? undefined,
        confirmationConsent: checklistVerified,
        isMissingSf9: isMissingSf9 ?? false,
        isTemporarilyEnrolled: !checklistVerified,
        assignedProgram: assignedProgram ?? undefined,
        isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
      },
    });

    if (isMissingPsa) {
       await tx.learner.update({
          where: { id: application.learnerId },
          data: { hasPsaBirthCertificate: false }
       });
    } else if (checklistVerified || isMissingPsa === false) {
       await tx.learner.update({
          where: { id: application.learnerId },
          data: { hasPsaBirthCertificate: true }
       });
    }
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "INTAKE_FINALIZED",
    description: `Intake finalized for ${application.learner.firstName} ${application.learner.lastName} — queued for batch sectioning`,
    subjectType: "EnrollmentApplication",
    recordId: applicationId,
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  return res.json({
    success: true,
    message: "Intake finalized. Learner is now queued for batch sectioning.",
    applicationId,
    newStatus: "READY_FOR_SECTIONING",
  });
}

/**
 * GET /api/enrollment/pending-verifications
 * Fetches all applications with PENDING_VERIFICATION status for the active school year.
 */
export async function getPendingVerifications(req: Request, res: Response) {
  const schoolYearId = req.query.schoolYearId
    ? Number(req.query.schoolYearId)
    : req.schoolYearId;

  if (!schoolYearId) {
    return res.status(400).json({ message: "Active school year not found." });
  }

  const applications = await prisma.enrollmentApplication.findMany({
    where: {
      schoolYearId,
      status: {
        in: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING", "FOR_REVISION", "WITHDRAWN"],
      },
      learnerType: {
        in: ["NEW_ENROLLEE", "TRANSFEREE", "RETURNING"],
      },
    },
    include: {
      learner: {
        select: {
          firstName: true,
          lastName: true,
          middleName: true,
          lrn: true,
          sex: true,
          studentPhoto: true,
          previousGenAve: true,
          birthdate: true,
          hasPsaBirthCertificate: true,
        },
      },
      gradeLevel: { select: { name: true } },
      previousSchool: true,
      familyMembers: true,
      backSubjects: {
        select: { subjectCode: true, subjectName: true },
        orderBy: { subjectName: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json(applications);
}

/**
 * PATCH /api/enrollment/:applicationId/flag-deficient
 * Flags an application as deficient (missing requirements), setting status to FOR_REVISION.
 */
export async function flagDeficient(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const applicationId = Number(req.params.applicationId);
  const userId = req.user!.userId;

  if (!applicationId || isNaN(applicationId)) {
    throw new AppError(400, "Valid applicationId is required.");
  }

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: {
      status: "FOR_REVISION",
      rejectionReason: "Deficient requirements based on DO 017",
    },
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "APPLICATION_FLAGGED_DEFICIENT",
    description: `Application ${applicationId} flagged as deficient (DO 017)`,
    subjectType: "EnrollmentApplication",
    recordId: applicationId,
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  return res.json({
    success: true,
    message: "Application flagged as deficient.",
    applicationId,
    newStatus: "FOR_REVISION",
  });
}

/**
 * PATCH /api/enrollment/:applicationId/cancel
 *
 * Cancels a walk-in application from the FOR REVIEW queue.
 * Requires a cancellation reason.
 */
export async function cancelApplication(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;
  const { applicationId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new AppError(400, "Cancellation reason is required.");
  }

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: Number(applicationId) },
    include: { learner: true },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  if (application.status !== "PENDING_VERIFICATION") {
    throw new AppError(
      409,
      `Application is in status '${application.status}'. Only PENDING_VERIFICATION applications can be cancelled.`,
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: Number(applicationId) },
    data: { status: "WITHDRAWN" },
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "WALK_IN_APPLICATION_CANCELLED",
    description: `Cancelled application for ${application.learner.lastName}, ${application.learner.firstName}. Reason: ${reason}`,
    subjectType: "EnrollmentApplication",
    recordId: Number(applicationId),
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  res.json({ success: true, application: updated });
}

/**
 * PATCH /api/enrollment/:applicationId/restore
 *
 * Restores a cancelled/withdrawn application back to the FOR REVIEW queue.
 */
export async function restoreApplication(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;
  const { applicationId } = req.params;

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: Number(applicationId) },
    include: { learner: true },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  if (application.status !== "WITHDRAWN") {
    throw new AppError(
      409,
      `Application is in status '${application.status}'. Only WITHDRAWN applications can be restored.`,
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: Number(applicationId) },
    data: { status: "PENDING_VERIFICATION" },
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "WALK_IN_APPLICATION_RESTORED",
    description: `Restored application for ${application.learner.lastName}, ${application.learner.firstName}.`,
    subjectType: "EnrollmentApplication",
    recordId: Number(applicationId),
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  res.json({ success: true, application: updated });
}

/**
 * DELETE /api/enrollment/:applicationId
 *
 * Permanently deletes an enrollment application from the database.
 */
export async function deleteApplication(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;
  const { applicationId } = req.params;

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: Number(applicationId) },
    include: { learner: true },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  const learnerAppCount = await prisma.enrollmentApplication.count({
    where: { learnerId: application.learnerId },
  });

  await prisma.enrollmentApplication.delete({
    where: { id: Number(applicationId) },
  });

  if (learnerAppCount === 1) {
    try {
      await prisma.learner.delete({
        where: { id: application.learnerId },
      });
    } catch (err) {
      // Ignore if learner has other foreign key dependencies (e.g. past enrollment records)
    }
  }

  await auditLog({
    userId: userId ?? null,
    actionType: "ENROLLMENT_APPLICATION_DELETED",
    description: `Permanently deleted application for ${application.learner.lastName}, ${application.learner.firstName}.`,
    subjectType: "EnrollmentApplication",
    recordId: Number(applicationId),
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  res.json({ success: true, deleted: true });
}

/**
 * PATCH /api/enrollment/:applicationId/revert
 *
 * Reverts an officially enrolled application back to the FOR REVIEW queue.
 * Requires a reversal reason.
 */
export async function revertApplication(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;
  const { applicationId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw new AppError(400, "Reversal reason is required.");
  }

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: Number(applicationId) },
    include: { learner: true },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  if (application.status !== "READY_FOR_SECTIONING") {
    throw new AppError(
      409,
      `Application is in status '${application.status}'. Only ENROLLED (READY_FOR_SECTIONING) applications can be reverted.`,
    );
  }

  const updated = await prisma.enrollmentApplication.update({
    where: { id: Number(applicationId) },
    data: { status: "PENDING_VERIFICATION" },
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "ENROLLMENT_REVERTED_TO_REVIEW",
    description: `Enrollment Reverted to Review for ${application.learner.lastName}, ${application.learner.firstName}. Reason: ${reason}`,
    subjectType: "EnrollmentApplication",
    recordId: Number(applicationId),
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  res.json({ success: true, application: updated });
}

export async function directEncodeWalkIn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const intakeContext = await assertStaffIntakeAllowed();
    const payload = req.body as DirectEncodeWalkInPayload;
    const {
      learnerType,
      lrn, firstName, lastName, middleName, birthdate, sex,
      gradeLevelId, assignedProgram,
      previousSchoolName, previousGenAve, originatingSchoolId, transferCertificateNo,
      guardianFirstName, guardianMiddleName, guardianLastName, guardianRelationship, guardianContact,
      hasSf9, hasPsa, sf9EligibilityStatus, conditionalSubjectCodes,
      motherTongue, currentAddress,
    } = payload;

    const schoolYearId = intakeContext.schoolYearId;
    const applicantType = parseWalkInProgramType(assignedProgram);
    let backSubjectSelection: {
      gradeLevelId: number;
      subjects: AtlasSubjectCatalogItem[];
    } | null = null;

    if (learnerType === "TRANSFEREE" && sf9EligibilityStatus === "CONDITIONALLY_PROMOTED") {
      const catalog = await resolveWalkInSubjectCatalog(
        gradeLevelId,
        applicantType,
      );
      const catalogByCode = new Map(
        catalog.subjects.map((subject) => [subject.code, subject]),
      );
      const selectedSubjects = conditionalSubjectCodes.map((code) => {
        const subject = catalogByCode.get(code);
        if (!subject) {
          throw new AppError(
            422,
            `Back subject '${code}' is not available in the current ATLAS catalog for the selected grade level and curriculum.`,
          );
        }
        return subject;
      });
      backSubjectSelection = {
        gradeLevelId: catalog.subjectGradeLevelId,
        subjects: selectedSubjects,
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert Learner
      let learner;
      if (lrn) {
        learner = await tx.learner.findUnique({ where: { lrn } });
      }

      if (learner) {
        learner = await tx.learner.update({
          where: { id: learner.id },
          data: {
            firstName,
            lastName,
            middleName: middleName || null,
            birthdate: new Date(birthdate),
            sex: sex,
            motherTongue: motherTongue,
            hasPsaBirthCertificate: hasPsa,
          }
        });
      } else {
        learner = await tx.learner.create({
          data: {
            lrn: lrn || null,
            firstName,
            lastName,
            middleName: middleName || null,
            birthdate: new Date(birthdate),
            sex: sex,
            isIpCommunity: false,
            isLearnerWithDisability: false,
            is4PsBeneficiary: false,
            hasPwdId: false,
            motherTongue: motherTongue,
            hasPsaBirthCertificate: hasPsa,
          }
        });
      }

      // 2. Create Application
      const isTemporarilyEnrolled = !(hasSf9 && hasPsa);

      const application = await tx.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId,
          gradeLevelId,
          applicantType,
          learnerType,
          assignedProgram: assignedProgram || null,
          isLateEnrollee: intakeContext.systemPhase === "CLASSES_ONGOING",
          admissionChannel: "F2F",
          trackingNumber: null, // intentionally null for direct encode
          isTemporarilyEnrolled,
          isMissingSf9: !hasSf9,
          encodedById: req.user!.userId,
          status: "READY_FOR_SECTIONING",
          academicStatus: sf9EligibilityStatus,
          isRemedialRequired: backSubjectSelection !== null,
          guardianFirstName,
          guardianMiddleName,
          guardianLastName,
          // create previous school if provided
          previousSchool: previousSchoolName ? {
            create: {
              schoolName: previousSchoolName,
              schoolId: originatingSchoolId || null,
              generalAverage: previousGenAve ?? null,
              transferCertificateNo: transferCertificateNo || null,
            }
          } : undefined,
          // create family member
          familyMembers: {
            create: {
              relationship: guardianRelationship || "GUARDIAN",
              firstName: guardianFirstName,
              middleName: guardianMiddleName,
              lastName: guardianLastName,
              contactNumber: guardianContact,
            }
          },
          backSubjects: backSubjectSelection ? {
            create: backSubjectSelection.subjects.map((subject) => ({
              gradeLevelId: backSubjectSelection.gradeLevelId,
              subjectCode: subject.code,
              subjectName: subject.name,
            })),
          } : undefined,
          addresses: currentAddress ? {
            create: {
              addressType: "CURRENT",
              houseNoStreet: currentAddress.houseNoStreet || null,
              sitio: currentAddress.sitio || null,
              barangay: currentAddress.barangay,
              cityMunicipality: currentAddress.cityMunicipality,
              province: currentAddress.province,
            }
          } : undefined,
        }
      });

      return application;
    });

    broadcastEnrollmentInvalidation(result.schoolYearId, [result.learnerId]);

    res.status(201).json({ message: "Walk-in application directly encoded", application: result });
  } catch (error: unknown) {
    next(error);
  }
}
/**
 * PATCH /api/enrollment/:applicationId/complete-requirements
 *
 * Updates the document checklist for a temporarily enrolled (deficient) learner.
 * When all documents are now verified, clears the isTemporarilyEnrolled flag.
 */
export async function completeRequirements(req: Request, res: Response) {
  await assertStaffIntakeAllowed();
  const userId = req.user!.userId;
  const applicationId = Number(req.params.applicationId);

  if (!applicationId || isNaN(applicationId)) {
    throw new AppError(400, "Valid applicationId is required.");
  }

  const {
    sf9Verified,
    psaVerified,
  }: { sf9Verified: boolean; psaVerified: boolean } = req.body;

  const application = await prisma.enrollmentApplication.findUnique({
    where: { id: applicationId },
    include: {
      learner: { select: { id: true, firstName: true, lastName: true } },
      schoolYear: { select: { id: true } },
    },
  });

  if (!application) {
    throw new AppError(404, "Enrollment application not found.");
  }

  if (
    application.status !== "READY_FOR_SECTIONING" &&
    application.status !== "OFFICIALLY_ENROLLED"
  ) {
    throw new AppError(
      409,
      `Application status '${application.status}' does not support document updates via this endpoint.`,
    );
  }

  const allDocsVerified = sf9Verified && psaVerified;

  await prisma.$transaction(async (tx) => {
    await tx.enrollmentApplication.update({
      where: { id: applicationId },
      data: {
        isMissingSf9: !sf9Verified,
        isTemporarilyEnrolled: !allDocsVerified,
        confirmationConsent: allDocsVerified,
      },
    });

    await tx.learner.update({
      where: { id: application.learnerId },
      data: { hasPsaBirthCertificate: psaVerified },
    });
  });

  await auditLog({
    userId: userId ?? null,
    actionType: "REQUIREMENTS_UPDATED",
    description: `Document checklist updated for ${application.learner.firstName} ${application.learner.lastName} — SF9: ${sf9Verified}, PSA: ${psaVerified}`,
    subjectType: "EnrollmentApplication",
    recordId: applicationId,
    req,
  });

  broadcastEnrollmentInvalidation(application.schoolYearId, [application.learnerId]);

  return res.json({
    success: true,
    message: allDocsVerified
      ? "All requirements completed. Learner is no longer temporarily enrolled."
      : "Document checklist updated.",
    applicationId,
    isTemporarilyEnrolled: !allDocsVerified,
  });
}
