export interface Application {
  id: number;
  lrn: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  assessmentType: string | null;
  examDate: string | null;
  examVenue: string | null;
  examScore: number | null;
  examResult: string | null;
  examNotes: string | null;
  assessments: EarlyRegistrationAssessment[];
  createdAt: string;
}

export interface EarlyRegistrationAssessment {
  id: number;
  type: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  score: number | null;
  result: string | null;
  notes: string | null;
  conductedAt: string | null;
  createdAt: string;
}

export interface EarlyRegistrationApiRow extends Application {
  learner?: {
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    extensionName?: string | null;
    lrn?: string | null;
  } | null;
}

export interface PipelineBatchViewProps {
  applicantType: string;
  cutoffScore?: number | null;
  hasAssessment?: boolean;
}

export type ChecklistFieldKey =
  | "isPsaBirthCertPresented"
  | "isOriginalPsaBcCollected"
  | "isSf9Submitted"
  | "isSf10Requested"
  | "isGoodMoralPresented"
  | "isMedicalEvalSubmitted"
  | "isCertOfRecognitionPresented"
  | "isUndertakingSigned"
  | "isConfirmationSlipReceived";

export type AcademicStatusValue = "PROMOTED" | "RETAINED";

export interface VerifyGridColumn {
  key: ChecklistFieldKey;
  label: string;
  isMandatory: boolean;
}

export interface VerifyGridApplicant {
  id: number;
  name: string;
  trackingNumber: string;
  status: string;
  lrn: string;
  sex: string;
  isPendingLrnCreation: boolean;
  academicStatus: AcademicStatusValue;
  checklist: Record<ChecklistFieldKey, boolean>;
  requiredChecklistKeys: ChecklistFieldKey[];
}

export interface RegularSectionOption {
  id: number;
  name: string;
  gradeLevelId: number;
  gradeLevelName: string;
  programType: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
}

export interface RankingFormulaComponent {
  key: string;
  label: string;
  weight: number;
}

export interface ScoreRowState {
  componentScores: Record<string, string>;
  absentNoShow: boolean;
  remarks: string;
}

export interface FinalizeInterviewRowState {
  interviewScore: string;
  decision: "PASS" | "REJECT";
  rejectOutcome: "SUBMITTED" | "REJECTED";
  remarks: string;
}

export interface ScheduleFormState {
  scheduledDate: string;
  scheduledTime: string;
  venue: string;
  notes: string;
}

export interface ScpProgramStepTemplate {
  stepOrder: number;
  kind: string;
  label: string;
  isRequired: boolean;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  notes: string | null;
  cutoffScore: number | null;
}

export interface ScheduleFormRenderOptions {
  stepTemplate?: ScpProgramStepTemplate | null;
  selectedCount?: number;
}

export const DEFAULT_FINALIZE_INTERVIEW_ROW: FinalizeInterviewRowState = {
  interviewScore: "",
  decision: "PASS",
  rejectOutcome: "SUBMITTED",
  remarks: "",
};
