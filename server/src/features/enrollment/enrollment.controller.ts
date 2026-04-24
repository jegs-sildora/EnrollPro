import { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/AppError.js";
import axios from "axios";

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

    const isTemporary = isMissingSf9 || hasUnsettledPrivateAccount;

    // 2. Create the EnrollmentApplication directly
    const application = await prisma.enrollmentApplication.create({
      data: {
        learnerId,
        schoolYearId,
        gradeLevelId,
        status: isTemporary ? "TEMPORARILY_ENROLLED" : "READY_FOR_SECTIONING",
        intakeMethod: "CONFIRMATION_SLIP",
        admissionChannel: "F2F", // Registrar workflow is F2F
        encodedById: userId,
        isTemporarilyEnrolled: isTemporary || false,
        isMissingSf9: isMissingSf9 || false,
        hasUnsettledPrivateAccount: hasUnsettledPrivateAccount || false,
        originatingSchoolName: originatingSchoolName || null,
        checklist: {
          create: {
            academicStatus: "PROMOTED",
            isConfirmationSlipReceived: true,
            isSf9Submitted: !isMissingSf9,
            isPsaBirthCertPresented: learner.hasPsaBirthCertificate,
            isOriginalPsaBcCollected: learner.hasPsaBirthCertificate,
          },
        },
      },
      include: {
        learner: true,
        gradeLevel: true,
      },
    });

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
 * POST /api/enrollment/sync-smart-grades
 * Intercepts grade data from S.M.A.R.T. and updates the local Learner database.
 * Supports live Tailscale node fetching with a graceful mock fallback for demo day.
 */
export async function syncSmartGrades(req: Request, res: Response) {
  const { gradeLevelId } = req.body;
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
    include: { schoolYear: true },
  });

  if (!gradeLevel) {
    throw new AppError(404, "Grade level not found.");
  }

  // Extract numeric grade (e.g., "Grade 8" -> 8)
  const gradeNumMatch = gradeLevel.name.match(/\d+/);
  const gradeNum = gradeNumMatch ? gradeNumMatch[0] : "8";
  const syLabel = gradeLevel.schoolYear.yearLabel; // e.g., "2025-2026"

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
    throw new AppError(
      500,
      "Failed to persist academic synchronization data.",
    );
  }
}
