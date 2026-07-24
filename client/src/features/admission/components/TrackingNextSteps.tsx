import { cn } from "@/shared/lib/utils";

import { CheckCircle2, CircleAlert, CircleDashed, Clock3 } from "lucide-react";
import {
  deriveProgramTypeFromApplicantType,
  normalizeTrackingStatus,
  resolveCurrentStep,
} from "./trackingState";
import type {
  ApplicationTrackResponse,
  TrackingCurrentStep,
  TrackingProgramType,
  TrackingStatus,
} from "@enrollpro/shared";

export type { TrackingCurrentStep, TrackingProgramType, TrackingStatus };

type TrackingNextStepsPayload = Pick<
  ApplicationTrackResponse,
  "applicantType" | "programType" | "status" | "currentStep"
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
  { title: string; description: string }
> = {
  REGISTRAR_REVIEW: {
    title: "Registrar Review",
    description:
      "The Registrar's Office is checking the learner record and submitted school requirements.",
  },
  ENROLLMENT_QUALIFICATION: {
    title: "Ready for Class Sectioning",
    description:
      "The learner is enrolled and waiting for assignment to a class section.",
  },
  ENROLLED: {
    title: "Officially Enrolled",
    description:
      "The learner has an official class section for the active school year.",
  },
};

const STEP_ORDER: TrackingCurrentStep[] = [
  "REGISTRAR_REVIEW",
  "ENROLLMENT_QUALIFICATION",
  "ENROLLED",
];

const CURRENT_STEP_VALUES = new Set<TrackingCurrentStep>([
  "REGISTRAR_REVIEW",
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
): TrackingCurrentStep | undefined {
  const normalizedRaw = rawStatus.trim().toUpperCase();

  switch (normalizedRaw) {
    case "PENDING_VERIFICATION":
    case "FOR_REVISION":
      return "REGISTRAR_REVIEW";
    case "READY_FOR_SECTIONING":
    case "PENDING_CONFIRMATION":
    case "REMEDIAL_RESOLVED":
      return "ENROLLMENT_QUALIFICATION";
    case "OFFICIALLY_ENROLLED":
    case "DROPPED":
    case "TRANSFERRING_OUT":
    case "TRANSFERRED_OUT":
      return "ENROLLED";
    case "REJECTED":
    case "WITHDRAWN":
      return "REGISTRAR_REVIEW";
    default:
      return undefined;
  }
}

function getTerminalStatusNotice(
  status: TrackingStatus,
): { tone: string; message: string } | null {
  switch (status) {
    case "REJECTED":
      return {
        tone: "border-red-200 bg-red-50 text-red-900",
        message:
          "Current result: The application has been rejected. Please contact the registrar for clarification.",
      };
    case "WITHDRAWN":
      return {
        tone: "border-slate-200 bg-slate-50 text-slate-900",
        message:
          "This enrollment application was withdrawn. Contact the Registrar's Office if the learner needs to apply again.",
      };
    case "TRANSFERRED":
      return {
        tone: "border-slate-200 bg-slate-50 text-slate-900",
        message:
          "The learner has transferred to another school and is no longer in the active class list.",
      };
    case "DROPPED":
      return {
        tone: "border-slate-200 bg-slate-50 text-slate-900",
        message:
          "The learner is recorded as dropped from the active school-year class list.",
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
  status: TrackingStatus,
): RenderStep[] {
  const steps: RenderStep[] = [];

  const currentIndex = STEP_ORDER.indexOf(currentStep);

  for (const stepKey of STEP_ORDER) {
    const stepIdx = STEP_ORDER.indexOf(stepKey);
    const metadata = STEP_METADATA[stepKey];
    const isCompleted =
      stepIdx < currentIndex ||
      (status === "ENROLLED" && stepKey === "ENROLLED");
    const isActive = stepIdx === currentIndex && status !== "ENROLLED";

    const title = metadata.title;
    const description = metadata.description;

    steps.push({
      id: stepKey,
      title,
      description,
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
  );
  const resolvedCurrentStep =
    derivedStepFromRawStatus ??
    normalizeCurrentStep(currentStep) ??
    resolveCurrentStep(resolvedStatus, resolvedProgramType);

  const terminalNotice = getTerminalStatusNotice(resolvedStatus);

  const computedSteps = computeSteps(
    resolvedCurrentStep,
    resolvedStatus,
  );

  return (
    <div className={cn("space-y-4", className)}>
      {terminalNotice && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-base leading-tight font-extrabold",
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
            <li
              key={step.id}
              className="relative pl-11">
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
                  "border-muted bg-background text-foreground",
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
                    "text-base leading-tight font-extrabold uppercase ",
                    step.isCompleted && "text-emerald-700",
                    step.isActive && "text-blue-700",
                    !step.isCompleted && !step.isActive && "text-foreground",
                  )}>
                  {step.title}
                </p>
                <p className="text-base leading-tight text-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
