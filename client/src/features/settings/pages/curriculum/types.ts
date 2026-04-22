export type ScpGradeRuleType =
  | "GENERAL_AVERAGE_MIN"
  | "SUBJECT_AVERAGE_MIN"
  | "SUBJECT_MINIMUMS";

export interface ScpSubjectThreshold {
  subject: string;
  min: number;
}

export interface ScpGradeRequirementRule {
  ruleType: ScpGradeRuleType;
  minAverage?: number | null;
  subjects?: string[];
  subjectThresholds?: ScpSubjectThreshold[];
}

export interface ScpStepConfig {
  id?: number;
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
}

export interface ScpConfig {
  id?: number;
  scpType: string;
  isOffered: boolean;
  isTwoPhase: boolean;
  maxSlots: number | null;
  cutoffScore: number | null;
  notes?: string | null;
  gradeRequirements?: ScpGradeRequirementRule[] | null;
  rankingFormula?: unknown;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  steps: ScpStepConfig[];
}
