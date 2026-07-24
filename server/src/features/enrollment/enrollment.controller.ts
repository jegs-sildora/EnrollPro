import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { broadcastEnrollmentInvalidation } from "../../lib/realtime-events.js";
import { isStaffIntakeAllowed } from "../settings/enrollment-gate.service.js";
import type { ApplicantType } from "../../generated/prisma/index.js";

async function assertStaffIntakeAllowed(): Promise<void> {
  const setting = await prisma.schoolSetting.findFirst({
    select: { systemPhase: true },
  });
  if (!isStaffIntakeAllowed(setting?.systemPhase)) {
    throw new AppError(
      403,
      "Learner intake is locked during EOSY Closing. Complete enrollment changes before starting year-end processing.",
    );
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
    description: `Intake finalized for application ${applicationId} — status set to READY_FOR_SECTIONING`,
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
        in: ["PENDING_VERIFICATION", "READY_FOR_SECTIONING", "FOR_REVISION"],
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
          previousGenAve: true,
          birthdate: true,
        },
      },
      gradeLevel: { select: { name: true } },
      previousSchool: true,
      familyMembers: true,
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


export async function directEncodeWalkIn(req: Request, res: Response) {
  try {
    await assertStaffIntakeAllowed();
    const payload = req.body;
    const {
      lrn, firstName, lastName, middleName, birthdate, sex,
      gradeLevelId, assignedProgram,
      previousSchoolName, previousGenAve,
      guardianName, guardianContact,
      hasSf9, hasPsa
    } = payload;

    if (!gradeLevelId || !firstName || !lastName || !birthdate || !sex) {
      return res.status(400).json({ message: "Missing required basic fields." });
    }

    const schoolYearId = req.schoolYearId || (await prisma.schoolSetting.findFirst({ select: { activeSchoolYearId: true } }))?.activeSchoolYearId;
    if (!schoolYearId) {
      return res.status(400).json({ message: "Active school year not found." });
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
          }
        });
      }

      // Fetch school setting to check system phase
      const setting = await tx.schoolSetting.findFirst({ select: { systemPhase: true } });

      // 2. Create Application
      const isTemporarilyEnrolled = !(hasSf9 && hasPsa);

      const application = await tx.enrollmentApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId,
          gradeLevelId,
          applicantType: "REGULAR",
          assignedProgram: assignedProgram || null,
          isLateEnrollee: setting?.systemPhase === "CLASSES_ONGOING",
          admissionChannel: "F2F",
          trackingNumber: null, // intentionally null for direct encode
          isTemporarilyEnrolled,
          encodedById: req.user!.userId,
          status: "READY_FOR_SECTIONING",
          // create previous school if provided
          previousSchool: previousSchoolName ? {
            create: {
              schoolName: previousSchoolName,
              generalAverage: previousGenAve ? parseFloat(previousGenAve) : null,
            }
          } : undefined,
          // create family member
          familyMembers: {
            create: {
              relationship: "GUARDIAN",
              firstName: guardianName,
              lastName: "", // Assuming single field from frontend form for simplicity
              contactNumber: guardianContact,
            }
          }
        }
      });

      return application;
    });

    broadcastEnrollmentInvalidation(result.schoolYearId, [result.learnerId]);

    return res.status(201).json({ message: "Walk-in application directly encoded", application: result });
  } catch (error) {
    console.error("Error in directEncodeWalkIn:", error);
    return res.status(500).json({ message: "Failed to process walk-in encoding", error: error instanceof Error ? error.message : "Unknown error" });
  }
}
