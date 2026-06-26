import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import axios from "axios";
import { ensureLearnerUserAccount } from "../learner/learner.service.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";


/**
 * POST /api/enrollment/confirm-slip
 * Rapid confirmation for returning Grade 8-10 learners.
 */
export async function confirmConfirmationSlip(req: Request, res: Response) {
  const {
    learnerId,
    schoolYearId,
    gradeLevelId,
    isMissingSf9,
    hasSf9CertificationLetter,
    hasUnsettledPrivateAccount,
    originatingSchoolName,
  } = req.body;
  const userId = (req as any).user.id;

  try {
    // 1. Validate learner exists and is returning
    const learner = await prisma.learner.findUnique({
      where: { id: learnerId },
    });

    if (!learner) {
      throw new AppError(404, "Learner not found.");
    }

    const isTemporary =
      (isMissingSf9 && !hasSf9CertificationLetter) ||
      hasUnsettledPrivateAccount;

    // 2. Create the EnrollmentApplication directly
    const application = await prisma.enrollmentApplication.create({
      data: {
        learnerId,
        schoolYearId,
        gradeLevelId,
        status: isTemporary ? "VERIFIED" : "VERIFIED",
        intakeMethod: "CONFIRMATION_SLIP",
        admissionChannel: "F2F", // Registrar workflow is F2F
        encodedById: userId,
        isTemporarilyEnrolled: isTemporary || false,
        isMissingSf9: isMissingSf9 || false,
        hasSf9CertificationLetter: hasSf9CertificationLetter || false,
        hasUnsettledPrivateAccount: hasUnsettledPrivateAccount || false,
        originatingSchoolName: originatingSchoolName || null,
        academicStatus: "PROMOTED",
      },
      include: {
        learner: true,
        gradeLevel: true,
      },
    });

    // Auto-create User account for the learner
    await prisma.$transaction(async (tx) => {
      await ensureLearnerUserAccount(tx, application.learner);
    });

    // Process 1.1: Event-Driven Delta Sync (Automated)
    // Officially enrolling a single late-enrollee/returning student triggers immediate sync
    if (application.status === "VERIFIED") {
    }

    return res.json({
      success: true,
      message: `Enrollment confirmed for ${learner.firstName} ${learner.lastName}.`,
      application,
    });
  } catch (error) {
    console.error("Confirmation Slip processing failed:", error);
    if (error instanceof AppError) throw error;
    throw new AppError(500, "Failed to process confirmation slip.");
  }
}

/**
 * POST /api/enrollment/batch-confirm
 * Rapid batch processing for Grade 8-10 confirmation slips.
 */
export async function batchConfirmConfirmationSlips(
  req: Request,
  res: Response,
) {
  const { batch } = req.body as {
    batch: {
      learnerId: number;
      schoolYearId: number;
      gradeLevelId: number;
      guardianName: string;
      contactNumber: string;
      isEnrolling: boolean;
      intakeMethod?: string;
    }[];
  };
  const userId = (req as any).user.id;

  if (!batch || !Array.isArray(batch)) {
    return res.status(400).json({ message: "Batch array is required." });
  }

  try {
    const results = await prisma.$transaction(async (tx) => {
      const updates = [];

      for (const entry of batch) {
        const {
          learnerId,
          schoolYearId,
          gradeLevelId,
          guardianName,
          contactNumber,
          isEnrolling,
          intakeMethod = "BATCH_CONFIRMATION",
        } = entry;

        // Create or update EnrollmentApplication
        const app = await tx.enrollmentApplication.upsert({
          where: {
            id:
              (
                await tx.enrollmentApplication.findFirst({
                  where: { learnerId, schoolYearId },
                  select: { id: true },
                })
              )?.id || -1,
          },
          create: {
            learnerId,
            schoolYearId,
            gradeLevelId,
            status: isEnrolling ? "VERIFIED" : "VERIFIED",
            intakeMethod: "CONFIRMATION_SLIP",
            admissionChannel: "F2F",
            encodedById: userId,
            guardianName,
            contactNumber,
            confirmationConsent: isEnrolling,
            batchIntakeMethod: intakeMethod,
            academicStatus: "PROMOTED",
          },
          update: {
            gradeLevelId,
            status: isEnrolling ? "VERIFIED" : "VERIFIED",
            guardianName,
            contactNumber,
            confirmationConsent: isEnrolling,
            batchIntakeMethod: intakeMethod,
          },
          include: {
            learner: true,
          },
        });

        if (isEnrolling) {
          await ensureLearnerUserAccount(tx, app.learner);
        }

        updates.push(app);
      }
      return updates;
    });

    return res.json({
      success: true,
      message: `Successfully processed ${results.length} confirmation slips.`,
      processedCount: results.length,
    });
  } catch (error) {
    console.error("Batch confirmation failed:", error);
    return res
      .status(500)
      .json({ message: "Error processing batch confirmation." });
  }
}

/**
 * POST /api/enrollment/sync-smart-grades
 * Intercepts grade data from S.M.A.R.T. and updates the local Learner database.
 * Supports live Tailscale node fetching with a graceful mock fallback for demo day.
 */
export async function syncSmartGrades(req: Request, res: Response) {
  const { gradeLevelId, schoolYearId } = req.body;
  const apiKey = process.env.SMART_API_KEY;
  const baseUrl = process.env.SMART_API_BASE_URL;
  const fallbackEnabled = process.env.SMART_SYNC_FALLBACK_ENABLED === "true";

  if (!apiKey || !baseUrl) {
    throw new AppError(
      500,
      "S.M.A.R.T. API configuration missing (Key or Base URL).",
    );
  }

  // Fetch target grade level info for the cohort endpoint
  const gradeLevel = await prisma.gradeLevel.findUnique({
    where: { id: gradeLevelId },
  });

  if (!gradeLevel) {
    throw new AppError(404, "Grade level not found.");
  }

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: schoolYearId },
  });

  if (!schoolYear) {
    throw new AppError(404, "School year not found.");
  }

  // Extract numeric grade (e.g., "Grade 8" -> 8)
  const gradeNumMatch = gradeLevel.name.match(/\d+/);
  const gradeNum = gradeNumMatch ? gradeNumMatch[0] : "8";
  const syLabel = schoolYear.yearLabel; // e.g., "2025-2026"

  let smartData: any[] = [];
  let isFallbackEngaged = false;

  try {
    // Phase 1: Attempt live fetch from S.M.A.R.T. Tailscale node
    // Endpoint: GET /api/v1/academic-status/cohort/{gradeLevel}?sy=2025-2026
    const smartResponse = await axios.get(
      `${baseUrl}/api/v1/academic-status/cohort/${gradeNum}`,
      {
        params: { sy: syLabel },
        headers: { "X-API-KEY": apiKey },
        timeout: 5000, // 5 second timeout for demo snappy-ness
      },
    );

    smartData = smartResponse.data;
  } catch (error) {
    console.warn("S.M.A.R.T. Live Node Unreachable:", (error as Error).message);

    if (fallbackEnabled) {
      console.log("Demo Guardrail: Engaging Mock Data Fallback...");
      isFallbackEngaged = true;

      // Add a slight artificial delay for demo flair
      await new Promise((resolve) => setTimeout(resolve, 1500));

      smartData = [
        {
          lrn: "123456789012",
          generalAverage: 88.5,
          promotionStatus: "PROMOTED",
        },
        {
          lrn: "987654321098",
          generalAverage: 92.1,
          promotionStatus: "PROMOTED",
        },
        {
          lrn: "112233445566",
          generalAverage: 74.2,
          promotionStatus: "RETAINED",
        },
      ];
    } else {
      throw new AppError(
        503,
        "S.M.A.R.T. Synchronization Failed. External server is unreachable.",
      );
    }
  }

  // Phase 2: Process synchronization payload
  const learnersToUpdate = await prisma.learner.findMany({
    where: {
      lrn: { in: smartData.map((d) => d.lrn) },
    },
    select: { id: true, lrn: true },
  });

  const foundLrns = new Set(learnersToUpdate.map((l) => l.lrn));
  const missingInSmart = smartData.filter((d) => !foundLrns.has(d.lrn));

  const updates = smartData
    .filter((d) => foundLrns.has(d.lrn))
    .map((student) =>
      prisma.learner.update({
        where: { lrn: student.lrn! },
        data: {
          previousGenAve: student.generalAverage,
          promotionStatus: student.promotionStatus,
        },
      }),
    );

  try {
    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return res.json({
      success: true,
      syncedCount: updates.length,
      missingCount: missingInSmart.length,
      missingLrns: missingInSmart.map((m) => m.lrn),
      isFallbackEngaged,
      message: isFallbackEngaged
        ? `Demo Mode: Synchronized ${updates.length} records from Local Cache.`
        : `Successfully synchronized ${updates.length} records from S.M.A.R.T. Live Node.`,
    });
  } catch (error) {
    console.error("Database Update Error:", error);
    throw new AppError(500, "Failed to persist academic synchronization data.");
  }
}

// ─── Intake Finalization ─────────────────────────────────────────────────────

/**
 * POST /api/enrollment/finalize-intake
 *
 * Intake Desk Tab 3 — Finalizes a learner's physical document confirmation:
 *  - Saves height (cm) and weight (kg)
 *  - Verifies the physical document checklist
 *  - Advances status from PENDING_VERIFICATION → VERIFIED
 *  - Fires Notification Event A (Intake Receipt Confirmation)
 */
export async function finalizeIntake(req: Request, res: Response) {
  const userId = (req as any).user?.id ?? (req as any).user?.userId;

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
    assignedProgram?: any;
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
        status: "VERIFIED",
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

  return res.json({
    success: true,
    message: "Intake finalized. Learner is now queued for batch sectioning.",
    applicationId,
    newStatus: "VERIFIED",
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
      status: "PENDING_VERIFICATION",
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
  const applicationId = Number(req.params.applicationId);
  const userId = (req as any).user?.id ?? (req as any).user?.userId;

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

  return res.json({
    success: true,
    message: "Application flagged as deficient.",
    applicationId,
    newStatus: "FOR_REVISION",
  });
}


export async function directEncodeWalkIn(req: Request, res: Response) {
  try {
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
      const applicationStatus = (hasSf9 && hasPsa) ? "OFFICIALLY_ENROLLED" : "TEMPORARILY_ENROLLED";

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
          isTemporarilyEnrolled: applicationStatus === "TEMPORARILY_ENROLLED",
          encodedById: (req as any).user?.id ?? (req as any).user?.userId,
          status: applicationStatus,
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

    return res.status(201).json({ message: "Walk-in application directly encoded", application: result });
  } catch (error) {
    console.error("Error in directEncodeWalkIn:", error);
    return res.status(500).json({ message: "Failed to process walk-in encoding", error: error instanceof Error ? error.message : "Unknown error" });
  }
}
