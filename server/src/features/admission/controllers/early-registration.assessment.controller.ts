import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../../lib/AppError.js";
import type { AdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createAdmissionControllerDeps } from "../services/admission-controller.deps.js";
import { createEarlyRegistrationSharedService } from "../services/early-registration-shared.service.js";

export function createEarlyRegistrationAssessmentController(
  deps: AdmissionControllerDeps = createAdmissionControllerDeps(),
) {
  const { prisma, auditLog, normalizeDateToUtcNoon } = deps;
  const {
    findApplicantOrThrow,
    assertTransition,
    queueEmail,
    updateApplicationStatus,
  } = createEarlyRegistrationSharedService(deps);
  async function markEligible(req: Request, res: Response, next: NextFunction) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "ELIGIBLE",
        `Cannot mark as eligible. Current status: "${applicant.status}".`,
      );

      const updated = await updateApplicationStatus(applicantId, "ELIGIBLE");

      await auditLog({
        userId: req.user!.userId,
        actionType: "APPLICATION_ELIGIBLE",
        description: `Marked ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) as ELIGIBLE - docs verified`,
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

  // — Schedule assessment step (pipeline-aware SCP flow) —
  async function scheduleAssessmentStep(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { stepOrder, kind, scheduledDate, scheduledTime, venue, notes } =
        req.body;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      const targetStatus =
        kind === "INTERVIEW" ? "INTERVIEW_SCHEDULED" : "EXAM_SCHEDULED";

      assertTransition(
        applicant,
        targetStatus,
        `Cannot schedule assessment for application with status "${applicant.status}".`,
      );

      // Fetch pipeline step config for defaults
      const scpConfig = await prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: applicant.schoolYearId,
            scpType: applicant.applicantType as any,
          },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });

      const stepConfig = scpConfig?.steps.find(
        (s) => s.stepOrder === stepOrder,
      );

      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);

      if (!earlyRegId) {
        throw new AppError(
          400,
          "No early registration linked to this application.",
        );
      }

      const existingAssessments = scpConfig
        ? await prisma.earlyRegistrationAssessment.findMany({
            where: { applicationId: earlyRegId },
          })
        : [];

      const requiredNonInterviewSteps = (scpConfig?.steps ?? []).filter(
        (step) => step.isRequired && step.kind !== "INTERVIEW",
      );

      const hasFailedRequiredStep = requiredNonInterviewSteps.some((step) =>
        existingAssessments.some(
          (assessment) =>
            assessment.type === step.kind && assessment.result === "FAILED",
        ),
      );

      if (hasFailedRequiredStep) {
        throw new AppError(
          422,
          "Cannot schedule additional assessments or interviews after a failed cut-off result. Mark the learner as FAILED.",
        );
      }

      // Prerequisite gating: all previous required steps must have result = 'PASSED'
      if (scpConfig && stepOrder > 1) {
        const previousRequiredSteps = scpConfig.steps.filter(
          (s) => s.stepOrder < stepOrder && s.isRequired,
        );
        if (previousRequiredSteps.length > 0) {
          const unmet = previousRequiredSteps.filter(
            (prev) =>
              !existingAssessments.some(
                (a) => a.type === prev.kind && a.result === "PASSED",
              ),
          );
          if (unmet.length > 0) {
            const labels = unmet.map((s) => s.label).join(", ");
            throw new AppError(
              400,
              `Cannot schedule step ${stepOrder}: prerequisite step(s) not passed — ${labels}.`,
            );
          }
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.earlyRegistrationAssessment.create({
          data: {
            applicationId: earlyRegId,
            type: kind as any,
            scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
            scheduledTime: scheduledTime || stepConfig?.scheduledTime || null,
            venue: venue || stepConfig?.venue || null,
            notes: notes || stepConfig?.notes || null,
          },
        });

        return updateApplicationStatus(applicantId, targetStatus);
      });

      const stepLabel = stepConfig?.label || kind;
      await auditLog({
        userId: req.user!.userId,
        actionType:
          kind === "INTERVIEW"
            ? "INTERVIEW_SCHEDULED"
            : "ASSESSMENT_STEP_SCHEDULED",
        description: `Scheduled ${stepLabel} (step ${stepOrder}) for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) on ${scheduledDate}${venue || stepConfig?.venue ? ` at ${venue || stepConfig?.venue}` : ""}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? applicant.email ?? null,
        `Assessment Scheduled - ${applicant.trackingNumber}`,
        "EXAM_SCHEDULED",
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // Keep legacy alias for backward compat
  const scheduleExam = scheduleAssessmentStep;

  // — Record assessment step result (pipeline-aware) —
  async function recordStepResult(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { stepOrder, kind, score, result, notes } = req.body;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "ASSESSMENT_TAKEN",
        `Cannot record result for application with status "${applicant.status}".`,
      );

      // Find the assessment record for this step
      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);
      if (!earlyRegId) {
        throw new AppError(
          400,
          "No early registration linked to this application.",
        );
      }

      const assessment = await prisma.earlyRegistrationAssessment.findFirst({
        where: { applicationId: earlyRegId, type: kind as any },
        orderBy: { createdAt: "desc" },
      });

      if (!assessment) {
        throw new AppError(
          404,
          `No scheduled assessment found for step ${stepOrder} (${kind}). Schedule the step first.`,
        );
      }

      // Load pipeline config to determine if all required steps are done
      const scpConfig = await prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: applicant.schoolYearId,
            scpType: applicant.applicantType as any,
          },
        },
        include: {
          steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
        },
      });

      const updated = await prisma.$transaction(async (tx) => {
        // Auto-determine result from step-level cutoff score if configured
        const stepConfig = scpConfig?.steps.find(
          (s) => s.stepOrder === stepOrder,
        );
        let finalResult = result ?? null;
        if (stepConfig?.cutoffScore != null && score != null) {
          finalResult = score >= stepConfig.cutoffScore ? "PASSED" : "FAILED";
        }

        // Update the specific assessment record
        await tx.earlyRegistrationAssessment.update({
          where: { id: assessment.id },
          data: {
            score: score ?? null,
            result: finalResult,
            notes: notes ?? null,
            conductedAt: new Date(),
          },
        });

        // Check if all required pipeline steps have results
        const allAssessments = await tx.earlyRegistrationAssessment.findMany({
          where: { applicationId: earlyRegId },
        });

        const requiredSteps = scpConfig?.steps ?? [];
        const requiredNonInterview = requiredSteps.filter(
          (step) => step.kind !== "INTERVIEW",
        );
        const hasFailedRequired = requiredNonInterview.some((step) =>
          allAssessments.some(
            (a) => a.type === step.kind && a.result === "FAILED",
          ),
        );
        const allRequiredDone = requiredNonInterview.every((step) =>
          allAssessments.some(
            (a) =>
              a.type === step.kind &&
              (a.conductedAt != null || a.result != null || a.score != null),
          ),
        );

        // Decision gate: once any required step fails cutoff or all required steps are done,
        // move to ASSESSMENT_TAKEN and wait for explicit registrar decision.
        const newStatus =
          hasFailedRequired || allRequiredDone
            ? "ASSESSMENT_TAKEN"
            : "EXAM_SCHEDULED";

        return updateApplicationStatus(applicantId, newStatus);
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "STEP_RESULT_RECORDED",
        description: `Recorded result for step ${stepOrder} (${kind}) for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}): ${result || "N/A"} (Score: ${score ?? "N/A"})`,
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

  // Legacy alias
  const recordResult = recordStepResult;

  // — Schedule interview (legacy alias — redirects to scheduleAssessmentStep) —
  async function scheduleInterview(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { interviewDate, interviewTime, interviewVenue, interviewNotes } =
        req.body;
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "INTERVIEW_SCHEDULED",
        `Cannot schedule interview for application with status "${applicant.status}".`,
      );

      // Find the interview step in the pipeline
      const scpConfig = await prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: applicant.schoolYearId,
            scpType: applicant.applicantType as any,
          },
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });

      const interviewStep = scpConfig?.steps.find(
        (s) => s.kind === "INTERVIEW",
      );
      const stepOrder = interviewStep?.stepOrder ?? 99;

      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);

      if (!earlyRegId) {
        throw new AppError(
          400,
          "No early registration linked to this application.",
        );
      }

      const requiredNonInterviewSteps = (scpConfig?.steps ?? []).filter(
        (step) => step.isRequired && step.kind !== "INTERVIEW",
      );
      if (requiredNonInterviewSteps.length > 0) {
        const existingAssessments =
          await prisma.earlyRegistrationAssessment.findMany({
            where: { applicationId: earlyRegId },
          });
        const hasFailedRequiredStep = requiredNonInterviewSteps.some((step) =>
          existingAssessments.some(
            (assessment) =>
              assessment.type === step.kind && assessment.result === "FAILED",
          ),
        );

        if (hasFailedRequiredStep) {
          throw new AppError(
            422,
            "Cannot schedule interview after a failed cut-off result. Mark the learner as FAILED.",
          );
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.earlyRegistrationAssessment.create({
          data: {
            applicationId: earlyRegId,
            type: "INTERVIEW",
            scheduledDate: normalizeDateToUtcNoon(new Date(interviewDate)),
            scheduledTime: interviewTime || null,
            venue: interviewVenue || null,
            notes: interviewNotes || null,
          },
        });

        return updateApplicationStatus(applicantId, "INTERVIEW_SCHEDULED");
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "INTERVIEW_SCHEDULED",
        description: `Scheduled interview (step ${stepOrder}) for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}) on ${interviewDate}`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? applicant.email ?? null,
        `Interview Scheduled - ${applicant.trackingNumber}`,
        "EXAM_SCHEDULED",
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }

  // — Record interview result (legacy alias — redirects to recordStepResult) —
  async function recordInterviewResult(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { interviewScore, interviewResult, interviewNotes } = req.body;
      const applicantId = parseInt(String(req.params.id));

      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      assertTransition(
        applicant,
        "ASSESSMENT_TAKEN",
        `Cannot record interview result for application with status "${applicant.status}".`,
      );

      // Find the interview assessment
      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);
      if (!earlyRegId) {
        throw new AppError(
          400,
          "No early registration linked to this application.",
        );
      }

      const interviewAssessment =
        await prisma.earlyRegistrationAssessment.findFirst({
          where: { applicationId: earlyRegId, type: "INTERVIEW" },
          orderBy: { createdAt: "desc" },
        });

      if (!interviewAssessment) {
        throw new AppError(
          422,
          "No pending interview assessment found. Schedule an interview first.",
        );
      }

      // Load pipeline config for all-steps-done check
      const scpConfig = await prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: applicant.schoolYearId,
            scpType: applicant.applicantType as any,
          },
        },
        include: {
          steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
        },
      });

      const updated = await prisma.$transaction(async (tx) => {
        await tx.earlyRegistrationAssessment.update({
          where: { id: interviewAssessment.id },
          data: {
            score: interviewScore ?? null,
            result: interviewResult ?? null,
            notes: interviewNotes ?? null,
            conductedAt: new Date(),
          },
        });

        // Check if all required steps are done
        const allAssessments = await tx.earlyRegistrationAssessment.findMany({
          where: { applicationId: earlyRegId },
        });

        const requiredSteps = scpConfig?.steps ?? [];
        const allRequiredDone = requiredSteps.every((step) =>
          allAssessments.some(
            (a) =>
              a.type === step.kind &&
              (a.conductedAt != null || a.result != null || a.score != null),
          ),
        );

        const newStatus = allRequiredDone
          ? "ASSESSMENT_TAKEN"
          : "EXAM_SCHEDULED";

        return updateApplicationStatus(applicantId, newStatus);
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "INTERVIEW_RESULT_RECORDED",
        description: `Recorded interview result for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}): ${interviewResult || "N/A"}`,
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

  // ── Mark as passed (Clearing for section assignment) ──

  // -- Mark interview as passed -> PRE_REGISTERED (phase 1) / READY_FOR_SECTIONING (phase 2) --
  async function markInterviewPassed(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const applicantId = parseInt(String(req.params.id));
      const { data: applicant, type: appType } =
        await findApplicantOrThrow(applicantId);

      const targetStatus =
        appType === "ENROLLMENT" ? "READY_FOR_SECTIONING" : "PRE_REGISTERED";

      assertTransition(
        applicant,
        targetStatus,
        `Cannot mark interview as passed. Current status: "${applicant.status}". Only INTERVIEW_SCHEDULED applications can proceed.`,
      );

      // Find the interview assessment record
      const earlyRegId =
        applicant.earlyRegistrationId ||
        (appType === "EARLY_REGISTRATION" ? applicant.id : null);
      const interviewAssessment = earlyRegId
        ? await prisma.earlyRegistrationAssessment.findFirst({
            where: { applicationId: earlyRegId, type: "INTERVIEW" },
            orderBy: { createdAt: "desc" },
          })
        : null;

      const updated = await prisma.$transaction(async (tx) => {
        if (interviewAssessment) {
          await tx.earlyRegistrationAssessment.update({
            where: { id: interviewAssessment.id },
            data: {
              result: "PASSED",
              conductedAt: new Date(),
            },
          });
        }

        return updateApplicationStatus(applicantId, targetStatus);
      });

      await auditLog({
        userId: req.user!.userId,
        actionType: "INTERVIEW_PASSED",
        description: `Interview passed for ${applicant.learner.firstName} ${applicant.learner.lastName} (#${applicantId}). Status moved to ${targetStatus}.`,
        subjectType:
          appType === "ENROLLMENT"
            ? "EnrollmentApplication"
            : "EarlyRegistrationApplication",
        recordId: applicantId,
        req,
      });

      await queueEmail(
        applicantId,
        applicant.earlyRegistration?.email ?? applicant.email ?? null,
        `Interview Passed - ${applicant.trackingNumber}`,
        "APPLICATION_APPROVED",
      );

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
  return {
    markEligible,
    scheduleAssessmentStep,
    scheduleExam,
    recordStepResult,
    recordResult,
    scheduleInterview,
    recordInterviewResult,
    markInterviewPassed,
  };
}

const assessmentController = createEarlyRegistrationAssessmentController();

export const markEligible = assessmentController.markEligible;
export const scheduleAssessmentStep =
  assessmentController.scheduleAssessmentStep;
export const scheduleExam = assessmentController.scheduleExam;
export const recordStepResult = assessmentController.recordStepResult;
export const recordResult = assessmentController.recordResult;
export const scheduleInterview = assessmentController.scheduleInterview;
export const recordInterviewResult = assessmentController.recordInterviewResult;
export const markInterviewPassed = assessmentController.markInterviewPassed;
