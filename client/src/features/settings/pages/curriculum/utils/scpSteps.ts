import {
  SCP_DEFAULT_PIPELINES,
  getSteSteps,
  type ScpType,
} from "@enrollpro/shared";
import { EXAM_STEP_KINDS } from "../constants";
import type { ScpStepConfig } from "../types";

interface PipelineStep {
  stepOrder: number;
  kind: string;
  label: string;
  description: string | null;
  isRequired: boolean;
}

function mapPipelineStepToEditableStep(step: PipelineStep): ScpStepConfig {
  return {
    stepOrder: step.stepOrder,
    kind: step.kind,
    label: step.label,
    description: step.description,
    isRequired: step.isRequired,
    scheduledDate: null,
    scheduledTime: "08:00 AM",
    venue: null,
    notes: null,
    cutoffScore: null,
  };
}

export function getDefaultProgramSteps(
  scpType: string,
  isTwoPhase: boolean,
): ScpStepConfig[] {
  const isSte = scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
  const pipeline = isSte
    ? getSteSteps(isTwoPhase)
    : SCP_DEFAULT_PIPELINES[scpType as ScpType];

  if (!pipeline) {
    return [];
  }

  return pipeline.map((step) => mapPipelineStepToEditableStep(step));
}

export function getSteProgramSteps(isTwoPhase: boolean): ScpStepConfig[] {
  return getSteSteps(isTwoPhase).map((step) =>
    mapPipelineStepToEditableStep(step),
  );
}

/**
 * Smarter merge for STE specifically to preserve field values when toggling between 1-phase and 2-phase.
 */
export function mergeSteProgramSteps(
  currentSteps: ScpStepConfig[],
  toTwoPhase: boolean,
): ScpStepConfig[] {
  const newDefinitions = getSteSteps(toTwoPhase);

  return newDefinitions.map((newDef) => {
    const freshStep = mapPipelineStepToEditableStep(newDef);

    // Try to find a logical match in current steps to preserve data
    let matchedStep: ScpStepConfig | undefined;

    if (toTwoPhase) {
      // 1 Phase -> 2 Phase
      if (newDef.kind === "PRELIMINARY_EXAMINATION") {
        matchedStep = currentSteps.find(
          (s) => s.kind === "QUALIFYING_EXAMINATION",
        );
      } else if (newDef.kind === "INTERVIEW") {
        matchedStep = currentSteps.find((s) => s.kind === "INTERVIEW");
      }
    } else {
      // 2 Phase -> 1 Phase
      if (newDef.kind === "QUALIFYING_EXAMINATION") {
        matchedStep = currentSteps.find(
          (s) => s.kind === "PRELIMINARY_EXAMINATION",
        );
      } else if (newDef.kind === "INTERVIEW") {
        matchedStep = currentSteps.find((s) => s.kind === "INTERVIEW");
      }
    }

    if (matchedStep) {
      return {
        ...freshStep,
        scheduledDate: matchedStep.scheduledDate,
        scheduledTime: matchedStep.scheduledTime,
        venue: matchedStep.venue,
        notes: matchedStep.notes,
        cutoffScore: matchedStep.cutoffScore,
      };
    }

    return freshStep;
  });
}

export function isExamStepKind(kind: string): boolean {
  return EXAM_STEP_KINDS.includes(kind as (typeof EXAM_STEP_KINDS)[number]);
}
