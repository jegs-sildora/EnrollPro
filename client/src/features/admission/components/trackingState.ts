import {
  APPLICATION_STATUS_TO_TRACKING_STATUS,
  type TrackingCurrentStep,
  type TrackingProgramType,
  type TrackingStatus,
} from "@enrollpro/shared";

const NORMALIZED_STATUSES = new Set<TrackingStatus>([
  "IN_REVIEW",
  "QUALIFIED_FOR_ENROLLMENT",
  "ENROLLED",
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
  const normalized = String(applicantType ?? "REGULAR").toUpperCase();
  return normalized === "REGULAR" || normalized === "LATE_ENROLLEE"
    ? "REGULAR"
    : "SCP";
}

export function normalizeTrackingStatus(
  status?: string | null,
): TrackingStatus {
  const normalized = String(status ?? "IN_REVIEW")
    .trim()
    .toUpperCase();

  if (NORMALIZED_STATUSES.has(normalized as TrackingStatus)) {
    return normalized as TrackingStatus;
  }

  return RAW_TO_TRACKING_STATUS[normalized] ?? "IN_REVIEW";
}

export function resolveCurrentStep(
  status: TrackingStatus,
  _programType?: TrackingProgramType,
): TrackingCurrentStep {
  switch (status) {
    case "IN_REVIEW":
    case "REJECTED":
      return "REGISTRAR_REVIEW";
    case "QUALIFIED_FOR_ENROLLMENT":
      return "ENROLLMENT_QUALIFICATION";
    case "ENROLLED":
    case "WITHDRAWN":
    case "TRANSFERRED":
    case "DROPPED":
      return "ENROLLED";
    default:
      return "REGISTRAR_REVIEW";
  }
}
