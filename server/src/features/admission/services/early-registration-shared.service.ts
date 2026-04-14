import { AppError } from "../../../lib/AppError.js";
import type { Applicant, ApplicationStatus } from "../../../generated/prisma";
import type { AdmissionControllerDeps } from "./admission-controller.deps.js";

export const VALID_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "ASSESSMENT_SCHEDULED", "REJECTED", "WITHDRAWN"],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "PRE_REGISTERED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PRE_REGISTERED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "NOT_QUALIFIED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "PRE_REGISTERED",
    "INTERVIEW_SCHEDULED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: ["PRE_REGISTERED", "WITHDRAWN"],
  PRE_REGISTERED: ["ENROLLED", "TEMPORARILY_ENROLLED", "WITHDRAWN"],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  ENROLLED: ["WITHDRAWN"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

export function createEarlyRegistrationSharedService(
  deps: AdmissionControllerDeps,
) {
  async function findApplicantOrThrow(id: number): Promise<Applicant> {
    const applicant = await deps.prisma.applicant.findUnique({ where: { id } });
    if (!applicant) throw new AppError(404, "Applicant not found");
    return applicant;
  }

  function assertTransition(
    applicant: Applicant,
    to: ApplicationStatus,
    contextMessage?: string,
  ): void {
    if (!(VALID_TRANSITIONS[applicant.status]?.includes(to) ?? false)) {
      throw new AppError(
        422,
        contextMessage ??
          `Cannot transition from "${applicant.status}" to "${to}".`,
      );
    }
  }

  async function queueEmail(
    applicantId: number,
    recipient: string | null,
    subject: string,
    trigger: Parameters<
      typeof deps.prisma.emailLog.create
    >[0]["data"]["trigger"],
  ): Promise<void> {
    if (!recipient) return;
    try {
      await deps.prisma.emailLog.create({
        data: { recipient, subject, trigger, status: "PENDING", applicantId },
      });
    } catch {
      // Non-critical: don't fail request on email queue errors
    }
  }

  async function flattenAssessmentData(application: Record<string, any>) {
    const assessments = (application.assessments ?? []) as Array<{
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
      const match =
        assessments.find((a) => a.stepOrder === step.stepOrder) ??
        assessments.find((a) => a.type === step.kind);

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

    return {
      ...application,
      isScpApplication: application.applicantType !== "REGULAR",
      scpType: scpDetail?.scpType ?? null,
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

  return {
    findApplicantOrThrow,
    assertTransition,
    queueEmail,
    flattenAssessmentData,
    toUpperCaseRecursive,
  };
}
