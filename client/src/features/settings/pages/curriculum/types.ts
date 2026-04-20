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
  gradeRequirements?: unknown;
  rankingFormula?: unknown;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  steps: ScpStepConfig[];
}
