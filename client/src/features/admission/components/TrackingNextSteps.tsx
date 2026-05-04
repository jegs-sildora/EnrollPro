import { cn } from "@/shared/lib/utils";
import { CheckCircle2, CircleAlert, CircleDashed, Clock3 } from "lucide-react";
import {
  deriveProgramTypeFromApplicantType,
  normalizeTrackingStatus,
  resolveCurrentStep,
} from "./trackingState";
import type {
  ApplicationTrackResponse,
  TrackingAssessmentData as SharedTrackingAssessmentData,
  TrackingCurrentStep,
  TrackingProgramType,
  TrackingStatus,
} from "@enrollpro/shared";

export type { TrackingCurrentStep, TrackingProgramType, TrackingStatus };

export type TrackingAssessmentData = SharedTrackingAssessmentData;

export type TrackingAssessmentStep =
  NonNullable<TrackingAssessmentData>["steps"][number];

type TrackingNextStepsPayload = Pick<
  ApplicationTrackResponse,
  "applicantType" | "programType" | "status" | "currentStep" | "assessmentData"
>;

interface TrackingNextStepsProps extends Omit<
  Partial<TrackingNextStepsPayload>,
  "status" | "currentStep"
> {
  status?: TrackingNextStepsPayload["status"] | string | null;
  currentStep?: TrackingNextStepsPayload["currentStep"] | string | null;
  className?: string;
}

const STEP_METADATA: Record<
  TrackingCurrentStep,
  { title: string; description: Record<TrackingProgramType, string> }
> = {
  APPLICATION_SUBMITTED: {
    title: "Application Submitted",
    description: {
      REGULAR:
        "Your form has been received. Keep your tracking number for all follow-ups.",
      SCP: "Your form has been received. Keep your tracking number for all follow-ups.",
    },
  },
  REGISTRAR_REVIEW: {
    title: "Registrar Review",
    description: {
      REGULAR:
        "The registrar validates your records and confirms requirements before enrollment qualification.",
      SCP: "The registrar validates your records before scheduling program assessments.",
    },
  },
  ASSESSMENT_PHASE: {
    title: "Assessment Phase",
    description: {
      REGULAR: "Assessment is not required for regular enrollment.",
      SCP: "Your required SCP assessment steps are being scheduled and processed.",
    },
  },
  ENROLLMENT_QUALIFICATION: {
    title: "Enrollment Qualification",
    description: {
      REGULAR:
        "Your application is qualified. Prepare to complete registrar enrollment requirements.",
      SCP: "Your application is qualified. Complete the remaining registrar enrollment requirements.",
    },
  },
  ENROLLED: {
    title: "Officially Enrolled",
    description: {
      REGULAR: "Enrollment is complete. Welcome to your enrolled school year.",
      SCP: "Enrollment is complete. Welcome to your enrolled school year.",
    },
  },
};

const STEP_ORDER: Record<TrackingProgramType, TrackingCurrentStep[]> = {
  REGULAR: [
    "APPLICATION_SUBMITTED",
    "REGISTRAR_REVIEW",
    "ENROLLMENT_QUALIFICATION",
    "ENROLLED",
  ],
  SCP: [
    "APPLICATION_SUBMITTED",
    "REGISTRAR_REVIEW",
    "ASSESSMENT_PHASE",
    "ENROLLMENT_QUALIFICATION",
    "ENROLLED",
  ],
};

const CURRENT_STEP_VALUES = new Set<TrackingCurrentStep>([
  "APPLICATION_SUBMITTED",
  "REGISTRAR_REVIEW",
  "ASSESSMENT_PHASE",
  "ENROLLMENT_QUALIFICATION",
  "ENROLLED",
]);

function normalizeCurrentStep(
  currentStep?: string | null,
): TrackingCurrentStep | undefined {
  const normalized = String(currentStep ?? "")
    .trim()
    .toUpperCase();
  if (CURRENT_STEP_VALUES.has(normalized as TrackingCurrentStep)) {
    return normalized as TrackingCurrentStep;
  }
  return undefined;
}

function resolveCurrentStepFromRawStatus(
  rawStatus: string,
  programType: TrackingProgramType,
): TrackingCurrentStep | undefined {
  const normalizedRaw = rawStatus.trim().toUpperCase();

  switch (normalizedRaw) {
    case "SUBMITTED":
    case "SUBMITTED_BEERF":
    case "SUBMITTED_BEEF":
      return "APPLICATION_SUBMITTED";
    case "IN_REVIEW":
    case "UNDER_REVIEW":
    case "FOR_REVISION":
      return "REGISTRAR_REVIEW";
    case "VERIFIED":
    case "ELIGIBLE":
      return programType === "SCP"
        ? "ASSESSMENT_PHASE"
        : "ENROLLMENT_QUALIFICATION";
    case "ASSESSMENT_IN_PROGRESS":
    case "EXAM_SCHEDULED":
    case "ASSESSMENT_TAKEN":
    case "INTERVIEW_SCHEDULED":
    case "FAILED_ASSESSMENT":
      return "ASSESSMENT_PHASE";
    case "QUALIFIED_FOR_ENROLLMENT":
    case "PASSED":
    case "READY_FOR_ENROLLMENT":
    case "TEMPORARILY_ENROLLED":
      return "ENROLLMENT_QUALIFICATION";
    case "ENROLLED":
      return "ENROLLED";
    case "NOT_QUALIFIED":
      return programType === "SCP"
        ? "ASSESSMENT_PHASE"
        : "ENROLLMENT_QUALIFICATION";
    case "REJECTED":
    case "WITHDRAWN":
      return "REGISTRAR_REVIEW";
    default:
      return undefined;
  }
}

function getTerminalStatusNotice(
  status: TrackingStatus,
  programType: TrackingProgramType,
): { tone: string; message: string } | null {
  switch (status) {
    case "NOT_QUALIFIED":
      return {
        tone: "border-amber-200 bg-amber-50 text-amber-900",
        message:
          programType === "SCP"
            ? "Current result: Not qualified for the selected SCP track. Coordinate with the registrar for alternative placement options."
            : "Current result: Not qualified for enrollment under the present evaluation.",
      };
    case "REJECTED":
      return {
        tone: "border-red-200 bg-red-50 text-red-900",
        message:
          "Current result: The application has been rejected. Please contact the registrar for clarification.",
      };
    case "WITHDRAWN":
      return {
        tone: "border-zinc-200 bg-zinc-50 text-zinc-700",
        message: "Current result: The application has been withdrawn.",
      };
    default:
      return null;
  }
}

type RenderStep = {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
};

function computeSteps(
  currentStep: TrackingCurrentStep,
  programType: TrackingProgramType,
  status: TrackingStatus,
  assessmentData?: TrackingAssessmentData,
): RenderStep[] {
  const steps: RenderStep[] = [];
  const orderedBaseSteps = STEP_ORDER[programType];
  const currentIndex = orderedBaseSteps.indexOf(currentStep);

  // 1. Pre-assessment steps
  const preAssessmentSteps: TrackingCurrentStep[] = [
    "APPLICATION_SUBMITTED",
    "REGISTRAR_REVIEW",
  ];

  for (const stepKey of preAssessmentSteps) {
    const stepIdx = orderedBaseSteps.indexOf(stepKey);
    const metadata = STEP_METADATA[stepKey];
    const isCompleted =
      stepIdx < currentIndex ||
      (status === "ENROLLED" && stepKey === "ENROLLED");
    const isActive = stepIdx === currentIndex && status !== "ENROLLED";

    steps.push({
      id: stepKey,
      title: metadata.title,
      description: metadata.description[programType],
      isCompleted,
      isActive,
    });
  }

  // 2. Assessment steps (SCP only)
  if (programType === "SCP") {
    if (assessmentData && assessmentData.steps.length > 0) {
      let foundActive = false;
      const isPastAssessment =
        currentStep === "ENROLLMENT_QUALIFICATION" || currentStep === "ENROLLED";
      const isBeforeAssessment = currentIndex < orderedBaseSteps.indexOf("ASSESSMENT_PHASE");

      for (const s of assessmentData.steps) {
        const isStepCompleted = isPastAssessment || (s.result !== null && s.result !== undefined);
        let isStepActive = false;

        if (currentStep === "ASSESSMENT_PHASE" && !isPastAssessment && !isBeforeAssessment && !foundActive && !isStepCompleted) {
          isStepActive = true;
          foundActive = true;
        }

        let desc = s.scheduledDate
          ? `Scheduled: ${s.scheduledDate}${s.scheduledTime ? ` at ${s.scheduledTime}` : ""}${s.venue ? ` (${s.venue})` : ""}`
          : "Scheduling in progress...";

        if (s.result) {
          desc = `Result: ${s.result}${s.score !== null ? ` (Score: ${s.score})` : ""}`;
        }

        steps.push({
          id: `ASSESSMENT_${s.stepOrder}`,
          title: s.label,
          description: desc,
          isCompleted: isStepCompleted,
          isActive: isStepActive,
        });
      }
    } else {
      // Fallback if no steps are configured yet
      const stepIdx = orderedBaseSteps.indexOf("ASSESSMENT_PHASE");
      const metadata = STEP_METADATA["ASSESSMENT_PHASE"];
      const isCompleted = stepIdx < currentIndex;
      const isActive = stepIdx === currentIndex && status !== "ENROLLED";

      steps.push({
        id: "ASSESSMENT_PHASE",
        title: metadata.title,
        description: metadata.description["SCP"],
        isCompleted,
        isActive,
      });
    }
  }

  // 3. Post-assessment steps
  const postAssessmentSteps: TrackingCurrentStep[] = [
    "ENROLLMENT_QUALIFICATION",
    "ENROLLED",
  ];

  for (const stepKey of postAssessmentSteps) {
    const stepIdx = orderedBaseSteps.indexOf(stepKey);
    const metadata = STEP_METADATA[stepKey];
    const isCompleted =
      stepIdx < currentIndex ||
      (status === "ENROLLED" && stepKey === "ENROLLED");
    const isActive = stepIdx === currentIndex && status !== "ENROLLED";

    steps.push({
      id: stepKey,
      title: metadata.title,
      description: metadata.description[programType],
      isCompleted,
      isActive,
    });
  }

  return steps;
}

export default function TrackingNextSteps({
  applicantType,
  programType,
  status,
  currentStep,
  assessmentData,
  className,
}: TrackingNextStepsProps) {
  const resolvedProgramType =
    programType ?? deriveProgramTypeFromApplicantType(applicantType);
  const normalizedStatusInput = String(status ?? "")
    .trim()
    .toUpperCase();
  const resolvedStatus = normalizeTrackingStatus(status);
  const derivedStepFromRawStatus = resolveCurrentStepFromRawStatus(
    normalizedStatusInput,
    resolvedProgramType,
  );
  const resolvedCurrentStep =
    derivedStepFromRawStatus ??
    normalizeCurrentStep(currentStep) ??
    resolveCurrentStep(resolvedStatus, resolvedProgramType);

  const terminalNotice = getTerminalStatusNotice(
    resolvedStatus,
    resolvedProgramType,
  );

  const computedSteps = computeSteps(
    resolvedCurrentStep,
    resolvedProgramType,
    resolvedStatus,
    assessmentData,
  );

  return (
    <div className={cn("space-y-4", className)}>
      {terminalNotice && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm font-semibold",
            terminalNotice.tone,
          )}>
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{terminalNotice.message}</p>
          </div>
        </div>
      )}

      <ol className="space-y-4">
        {computedSteps.map((step, index) => {
          return (
            <li key={step.id} className="relative pl-11">
              {index < computedSteps.length - 1 && (
                <span
                  className={cn(
                    "absolute left-[15px] top-7 h-full border-l-2",
                    step.isCompleted ? "border-emerald-400" : "border-muted/80",
                  )}
                />
              )}

              <span
                className={cn(
                  "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border-2",
                  step.isCompleted &&
                    "border-emerald-500 bg-emerald-50 text-emerald-700",
                  step.isActive && "border-blue-500 bg-blue-50 text-blue-700",
                  !step.isCompleted &&
                    !step.isActive &&
                    "border-muted bg-background text-muted-foreground",
                )}>
                {step.isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : step.isActive ? (
                  <Clock3 className="h-4 w-4" />
                ) : (
                  <CircleDashed className="h-4 w-4" />
                )}
              </span>

              <div className="space-y-1 pb-2">
                <p
                  className={cn(
                    "text-sm font-black uppercase tracking-wide",
                    step.isCompleted && "text-emerald-700",
                    step.isActive && "text-blue-700",
                    !step.isCompleted && !step.isActive && "text-muted-foreground",
                  )}>
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
