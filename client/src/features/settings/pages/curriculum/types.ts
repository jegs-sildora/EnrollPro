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

export type ScpDocumentPolicy = "REQUIRED" | "OPTIONAL" | "HIDDEN";
export type ScpDocumentPhase = "EARLY_REGISTRATION" | "ENROLLMENT";

export interface ScpDocumentRequirementDraft {
  docId: string;
  policy: ScpDocumentPolicy;
  phase: ScpDocumentPhase | null;
  notes: string | null;
}

export interface ScpConfig {
  id?: number;
  scpType: string;
  isOffered: boolean;
  isTwoPhase: boolean;
  cutoffScore: number | null;
  notes?: string | null;
  gradeRequirements?: unknown;
  documentRequirements: ScpDocumentRequirementDraft[];
  rankingFormula?: unknown;
  artFields: string[];
  languages: string[];
  sportsList: string[];
  steps: ScpStepConfig[];
}
