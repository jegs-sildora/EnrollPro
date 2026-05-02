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

const generateId = () => Math.random().toString(36).substring(2, 9);

const STE_DEFAULT_RUBRIC = [
  {
    id: generateId(),
    name: "Image Interpretation (40 pts)",
    criteria: [
      { id: generateId(), name: "Understanding of the Image", description: "Demonstrate a clear understanding of the image's content and context.", maxPts: 10 },
      { id: generateId(), name: "Analysis of Key Elements", description: "Identifies and explains key elements such as color, composition, shapes, and symbols.", maxPts: 15 },
      { id: generateId(), name: "Interpretation of Meaning", description: "Provides a thoughtful interpretation of the image's message or theme.", maxPts: 15 },
    ]
  },
  {
    id: generateId(),
    name: "Use of Evidence (10 pts)",
    criteria: [
      { id: generateId(), name: "Supports Analysis", description: "Supports analysis with specific details or visual evidence from the image.", maxPts: 10 },
    ]
  },
  {
    id: generateId(),
    name: "Insight (35 pts)",
    criteria: [
      { id: generateId(), name: "Critical Thinking", description: "Show depth of thought, offering original or nuanced perspectives on the image.", maxPts: 15 },
      { id: generateId(), name: "Connection to Relevant Concepts", description: "Links the image to broader ideas, historical context, or concepts studied in class.", maxPts: 10 },
      { id: generateId(), name: "Organization & Structure", description: "Clear and logical flow of ideas in the analysis, well-organized response.", maxPts: 10 },
    ]
  },
  {
    id: generateId(),
    name: "Other (15 pts)",
    criteria: [
      { id: generateId(), name: "Creativity & Originality", description: "Demonstrate originality in interpretation or creative insights about the image.", maxPts: 10 },
      { id: generateId(), name: "Clarity of Expression", description: "Clear, concise, and well-articulated writing, free of errors.", maxPts: 5 },
    ]
  }
];

function mapPipelineStepToEditableStep(step: PipelineStep, isSte: boolean): ScpStepConfig {
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
    rubric: isSte && step.kind === "INTERVIEW" ? STE_DEFAULT_RUBRIC : null,
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

  return pipeline.map((step) => mapPipelineStepToEditableStep(step, isSte));
}

export function getSteProgramSteps(isTwoPhase: boolean): ScpStepConfig[] {
  return getSteSteps(isTwoPhase).map((step) =>
    mapPipelineStepToEditableStep(step, true),
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
    const freshStep = mapPipelineStepToEditableStep(newDef, true);

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
        rubric: matchedStep.rubric,
      };
    }

    return freshStep;
  });
}

export function isExamStepKind(kind: string): boolean {
  return EXAM_STEP_KINDS.includes(kind as (typeof EXAM_STEP_KINDS)[number]);
}
