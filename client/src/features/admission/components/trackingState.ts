import {
  APPLICATION_STATUS_TO_TRACKING_STATUS,
  type TrackingCurrentStep,
  type TrackingProgramType,
  type TrackingStatus,
} from "@enrollpro/shared";

const NORMALIZED_STATUSES = new Set<TrackingStatus>([
  "SUBMITTED",
  "IN_REVIEW",
  "ASSESSMENT_IN_PROGRESS",
  "QUALIFIED_FOR_ENROLLMENT",
  "ENROLLED",
  "NOT_QUALIFIED",
  "REJECTED",
  "WITHDRAWN",
  "TRANSFERRED",
  "DROPPED",
]);

const RAW_TO_TRACKING_STATUS =
  APPLICATION_STATUS_TO_TRACKING_STATUS as Record<string, TrackingStatus>;

export function deriveProgramTypeFromApplicantType(
  applicantType?: string | null,
): TrackingProgramType {
  return applicantType && applicantType !== "REGULAR" ? "SCP" : "REGULAR";
}

export function normalizeTrackingStatus(
  status?: string | null,
): TrackingStatus {
  const normalized = String(status ?? "SUBMITTED")
    .trim()
    .toUpperCase();

  if (NORMALIZED_STATUSES.has(normalized as TrackingStatus)) {
    return normalized as TrackingStatus;
  }

  return RAW_TO_TRACKING_STATUS[normalized] ?? "SUBMITTED";
}

export function resolveCurrentStep(
  status: TrackingStatus,
  programType: TrackingProgramType,
): TrackingCurrentStep {
  switch (status) {
    case "SUBMITTED":
      return "APPLICATION_SUBMITTED";
    case "IN_REVIEW":
      return "REGISTRAR_REVIEW";
    case "ASSESSMENT_IN_PROGRESS":
      return programType === "SCP" ? "ASSESSMENT_PHASE" : "REGISTRAR_REVIEW";
    case "QUALIFIED_FOR_ENROLLMENT":
      return "ENROLLMENT_QUALIFICATION";
    case "ENROLLED":
    case "TRANSFERRED":
    case "DROPPED":
      return "ENROLLED";
    case "NOT_QUALIFIED":
      return programType === "SCP"
        ? "ASSESSMENT_PHASE"
        : "ENROLLMENT_QUALIFICATION";
    case "REJECTED":
    case "WITHDRAWN":
      return "REGISTRAR_REVIEW";
    default:
      return "APPLICATION_SUBMITTED";
  }
}
