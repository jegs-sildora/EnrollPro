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
