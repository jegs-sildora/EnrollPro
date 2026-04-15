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
    scheduledTime: null,
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

export function isExamStepKind(kind: string): boolean {
  return EXAM_STEP_KINDS.includes(kind as (typeof EXAM_STEP_KINDS)[number]);
}
