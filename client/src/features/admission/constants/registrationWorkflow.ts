export const ACTIVE_REGISTRATION_EXCLUDED_STATUSES = ["ENROLLED"] as const;

export const REGISTRATION_STAGE_QUICK_FILTERS = [
  { value: "ALL", label: "All Active" },
  { value: "WITHOUT_LRN", label: "Applicants Without LRN" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "VERIFIED", label: "Verified" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "ASSESSMENT_SCHEDULED", label: "Exam Scheduled" },
  { value: "ASSESSMENT_TAKEN", label: "Assessment Completed" },
  { value: "PASSED", label: "Passed" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "PRE_REGISTERED", label: "Ready for Enrollment" },
  { value: "TEMPORARILY_ENROLLED", label: "Temporarily Enrolled" },
  { value: "ENROLLED", label: "Enrolled" },
] as const;

export const REGISTRATION_VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "FOR_REVISION",
    "ELIGIBLE",
    "ASSESSMENT_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["ASSESSMENT_SCHEDULED", "PASSED", "WITHDRAWN"],
  ASSESSMENT_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  EXAM_SCHEDULED: [
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "NOT_QUALIFIED",
    "ASSESSMENT_TAKEN",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "PRE_REGISTERED",
    "INTERVIEW_SCHEDULED",
    "ASSESSMENT_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "PASSED",
    "PRE_REGISTERED",
    "NOT_QUALIFIED",
    "WITHDRAWN",
  ],
  PRE_REGISTERED: ["ENROLLED", "TEMPORARILY_ENROLLED", "WITHDRAWN"],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  ENROLLED: ["WITHDRAWN"],
  NOT_QUALIFIED: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

export const REGISTRATION_BATCH_TARGET_OPTIONS = [
  { value: "VERIFIED", label: "Verified" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ELIGIBLE", label: "Eligible" },
  { value: "ASSESSMENT_SCHEDULED", label: "Exam Scheduled" },
  { value: "ASSESSMENT_TAKEN", label: "Assessment Completed" },
  { value: "PASSED", label: "Passed" },
  { value: "INTERVIEW_SCHEDULED", label: "Interview Scheduled" },
  { value: "PRE_REGISTERED", label: "Ready for Enrollment" },
  { value: "NOT_QUALIFIED", label: "Not Qualified" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
] as const;

export const REGISTRATION_RECOMMENDED_TARGET_BY_STATUS: Record<string, string> =
  {
    SUBMITTED: "VERIFIED",
    VERIFIED: "UNDER_REVIEW",
    UNDER_REVIEW: "ELIGIBLE",
    ELIGIBLE: "ASSESSMENT_SCHEDULED",
    ASSESSMENT_SCHEDULED: "ASSESSMENT_TAKEN",
    ASSESSMENT_TAKEN: "PASSED",
    PASSED: "INTERVIEW_SCHEDULED",
    INTERVIEW_SCHEDULED: "PRE_REGISTERED",
  };

export type RegistrationBatchActionId =
  | "VERIFY_DOCUMENTS"
  | "SCHEDULE_EXAM"
  | "RECORD_ASSESSMENT"
  | "SCHEDULE_INTERVIEW"
  | "FINALIZE_PHASE_ONE";

export interface RegistrationBatchActionConfig {
  id: RegistrationBatchActionId;
  triggerStatus: string;
  targetStatus: string;
  buttonLabel: string;
  modalTitle: string;
  modalDescription: string;
  submitLabel: string;
}

export const REGISTRATION_BATCH_ACTIONS_BY_STATUS: Record<
  string,
  RegistrationBatchActionConfig
> = {
  SUBMITTED: {
    id: "VERIFY_DOCUMENTS",
    triggerStatus: "SUBMITTED",
    targetStatus: "VERIFIED",
    buttonLabel: "Batch Verify Documents",
    modalTitle: "Batch Documentary Checklist",
    modalDescription:
      "Review selected applicants and verify documentary requirements in one run.",
    submitLabel: "Verify Applicants",
  },
  VERIFIED: {
    id: "SCHEDULE_EXAM",
    triggerStatus: "VERIFIED",
    targetStatus: "ASSESSMENT_SCHEDULED",
    buttonLabel: "Batch Verify & Schedule Exam",
    modalTitle: "Batch Exam Scheduling",
    modalDescription:
      "Apply one exam schedule setup to all selected eligible applicants.",
    submitLabel: "Schedule Exam & Queue Emails",
  },
  ELIGIBLE: {
    id: "SCHEDULE_EXAM",
    triggerStatus: "ELIGIBLE",
    targetStatus: "ASSESSMENT_SCHEDULED",
    buttonLabel: "Batch Verify & Schedule Exam",
    modalTitle: "Batch Exam Scheduling",
    modalDescription:
      "Apply one exam schedule setup to all selected eligible applicants.",
    submitLabel: "Schedule Exam & Queue Emails",
  },
  ASSESSMENT_SCHEDULED: {
    id: "RECORD_ASSESSMENT",
    triggerStatus: "ASSESSMENT_SCHEDULED",
    targetStatus: "PASSED",
    buttonLabel: "Batch Record Assessment Scores",
    modalTitle: "Batch Assessment Data Entry",
    modalDescription:
      "Record assessment outcomes in an encoded batch flow for selected applicants.",
    submitLabel: "Save Scores",
  },
  ASSESSMENT_TAKEN: {
    id: "RECORD_ASSESSMENT",
    triggerStatus: "ASSESSMENT_TAKEN",
    targetStatus: "PASSED",
    buttonLabel: "Batch Record Assessment Scores",
    modalTitle: "Batch Assessment Data Entry",
    modalDescription:
      "Record assessment outcomes in an encoded batch flow for selected applicants.",
    submitLabel: "Save Scores",
  },
  PASSED: {
    id: "SCHEDULE_INTERVIEW",
    triggerStatus: "PASSED",
    targetStatus: "INTERVIEW_SCHEDULED",
    buttonLabel: "Batch Schedule Interview",
    modalTitle: "Batch Interview Scheduling",
    modalDescription:
      "Apply one interview schedule setup to all selected passed applicants.",
    submitLabel: "Schedule Interviews",
  },
  INTERVIEW_SCHEDULED: {
    id: "FINALIZE_PHASE_ONE",
    triggerStatus: "INTERVIEW_SCHEDULED",
    targetStatus: "PRE_REGISTERED",
    buttonLabel: "Batch Faculty Interview Result",
    modalTitle: "Batch Interview Finalization",
    modalDescription:
      "Finalize post-interview outcomes for selected applicants.",
    submitLabel: "Finalize Phase 1 Results",
  },
};

export function getRegistrationBatchActionByStatus(status: string) {
  const normalizedStatus =
    status === "EXAM_SCHEDULED" ? "ASSESSMENT_SCHEDULED" : status;
  return REGISTRATION_BATCH_ACTIONS_BY_STATUS[normalizedStatus] ?? null;
}
