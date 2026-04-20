import { Button } from "@/shared/ui/button";
import { useAuthStore } from "@/store/auth.slice";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";
import { ASSESSMENT_KIND_LABELS } from "@enrollpro/shared";
import type { AssessmentKind } from "@enrollpro/shared";

interface Props {
  applicant: ApplicantDetail;
  onApprove: () => void;
  onReject: () => void;
  onScheduleExam: () => void;
  onRecordResult: () => void;
  onPass: () => void;
  onFail: () => void;
  onOfferRegular: () => void;
  onTemporarilyEnroll: () => void;
  onAssignLrn?: () => void | Promise<void>;
  onEnroll?: () => void | Promise<void>;
  onScheduleInterview?: () => void;
  /** New: schedule a specific pipeline step */
  onScheduleStep?: (step: AssessmentStep) => void;
  /** New: record result for a specific pipeline step */
  onRecordStepResult?: (step: AssessmentStep) => void;
  onMarkVerified?: () => void | Promise<void>;
  onSetProfileLock?: (lock: boolean) => void | Promise<void>;
  isMandatoryDocumentsMet?: boolean;
}

function getNextPendingStep(
  steps: AssessmentStep[],
): AssessmentStep | undefined {
  return steps.find((s) => {
    if (s.status !== "PENDING") return false;
    // Gate: all previous required steps must be PASSED
    const previousRequired = steps.filter(
      (prev) => prev.stepOrder < s.stepOrder && prev.isRequired,
    );
    return previousRequired.every((prev) => prev.result === "PASSED");
  });
}

function getStepLabel(step: AssessmentStep): string {
  return (
    step.label ||
    ASSESSMENT_KIND_LABELS[step.kind as AssessmentKind] ||
    step.kind
  );
}

function getAssessmentDecisionAction(
  steps: AssessmentStep[],
): "PASS" | "FAIL" | null {
  const requiredExamSteps = steps.filter(
    (step) => step.isRequired && step.kind !== "INTERVIEW",
  );

  if (requiredExamSteps.length === 0) return null;

  const hasFailedRequiredStep = requiredExamSteps.some(
    (step) => step.result === "FAILED",
  );
  if (hasFailedRequiredStep) return "FAIL";

  const allRequiredCompleted = requiredExamSteps.every(
    (step) => step.status === "COMPLETED",
  );
  if (!allRequiredCompleted) return null;

  const allRequiredPassed = requiredExamSteps.every(
    (step) => step.result === "PASSED",
  );

  return allRequiredPassed ? "PASS" : null;
}

export function ActionButtons({
  applicant,
  isMandatoryDocumentsMet = false,
  ...handlers
}: Props) {
  const { status, applicantType } = applicant;
  const userRole = useAuthStore((state) => state.user?.role);
  const isPendingLrnCreation = applicant.isPendingLrnCreation === true;
  const isProfileLocked = applicant.isProfileLocked === true;
  const isRegular = applicantType === "REGULAR";
  const isSCP = !isRegular;
  const isEnrollmentVerificationMode = Boolean(handlers.onMarkVerified);
  const canToggleProfileLock =
    (status === "OFFICIALLY_ENROLLED" || status === "ENROLLED") &&
    userRole === "SYSTEM_ADMIN" &&
    Boolean(handlers.onSetProfileLock);

  const steps = applicant.assessmentSteps || [];
  const hasSteps = steps.length > 0;
  const nextPending = hasSteps ? getNextPendingStep(steps) : undefined;
  const assessmentDecisionAction = isSCP
    ? getAssessmentDecisionAction(steps)
    : null;

  if (isEnrollmentVerificationMode) {
    const canMarkAsVerified = [
      "EARLY_REG_SUBMITTED",
      "PENDING_VERIFICATION",
      "SUBMITTED",
      "UNDER_REVIEW",
      "READY_FOR_ENROLLMENT",
    ].includes(status);

    return (
      <div className="flex flex-col gap-2 p-4 border-t bg-background mt-auto">
        {canMarkAsVerified ? (
          <>
            <Button
              className="w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90 font-bold"
              onClick={handlers.onMarkVerified}
              disabled={!isMandatoryDocumentsMet}>
              Mark as Verified
            </Button>
            {!isMandatoryDocumentsMet && (
              <p className="text-xs text-center text-amber-700 font-bold">
                Complete all mandatory physical document checks before marking
                as verified.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No verification action available for this application status.
          </p>
        )}

        {canToggleProfileLock && (
          <>
            <Button
              variant={isProfileLocked ? "outline" : "destructive"}
              className={`w-full font-bold ${
                isProfileLocked
                  ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  : ""
              }`}
              onClick={() => handlers.onSetProfileLock?.(!isProfileLocked)}>
              {isProfileLocked
                ? "Unlock Profile (Admin Override)"
                : "Lock Profile (Admin Override)"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Profile is currently {isProfileLocked ? "LOCKED" : "UNLOCKED"}.
            </p>
          </>
        )}

        {(((status === "OFFICIALLY_ENROLLED" || status === "ENROLLED") &&
          !canToggleProfileLock) ||
          status === "REJECTED" ||
          status === "WITHDRAWN") && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No further actions available for this application.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 border-t bg-background mt-auto">
      {/* Existing action for regular applicants */}
      {isRegular &&
        [
          "EARLY_REG_SUBMITTED",
          "PENDING_VERIFICATION",
          "SUBMITTED",
          "UNDER_REVIEW",
          "ELIGIBLE",
        ].includes(status) && (
          <>
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handlers.onApprove}
              disabled={!isMandatoryDocumentsMet}>
              Approve &amp; Pre-register
            </Button>
            <Button
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold"
              onClick={handlers.onReject}>
              Reject Application
            </Button>
          </>
        )}

      {/* Temporary Enrollment - Per DepEd Order No. 3, s. 2018 */}
      {(status === "UNDER_REVIEW" ||
        status === "PENDING_VERIFICATION" ||
        status === "READY_FOR_SECTIONING" ||
        status === "ELIGIBLE" ||
        status === "READY_FOR_ENROLLMENT") && (
        <Button
          variant="secondary"
          className="w-full border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100 font-bold"
          onClick={handlers.onTemporarilyEnroll}>
          Mark as Temporarily Enrolled
        </Button>
      )}

      {/* SCP: Verify & Schedule first step (pipeline-aware) */}
      {isSCP &&
        [
          "EARLY_REG_SUBMITTED",
          "PENDING_VERIFICATION",
          "SUBMITTED",
          "UNDER_REVIEW",
          "ELIGIBLE",
        ].includes(status) && (
          <>
            {hasSteps && nextPending && handlers.onScheduleStep ? (
              <Button
                className="w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90 font-bold"
                onClick={() => handlers.onScheduleStep!(nextPending)}
                disabled={!isMandatoryDocumentsMet}>
                Verify &amp; Schedule: {getStepLabel(nextPending)}
              </Button>
            ) : (
              <Button
                className="w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90 font-bold"
                onClick={handlers.onScheduleExam}
                disabled={!isMandatoryDocumentsMet}>
                Verify &amp; Schedule Exam
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold"
              onClick={handlers.onReject}>
              Reject Application
            </Button>
          </>
        )}

      {/* SCP: Assessment Scheduled — schedule next step */}
      {isSCP && status === "EXAM_SCHEDULED" && !assessmentDecisionAction && (
        <>
          {/* If there are more pending steps, allow scheduling the next one */}
          {hasSteps && nextPending && handlers.onScheduleStep && (
            <Button
              variant="outline"
              className="w-full bg-primary text-primary-foreground font-bold"
              onClick={() => handlers.onScheduleStep!(nextPending)}
              disabled={!isMandatoryDocumentsMet}>
              Schedule Next: {getStepLabel(nextPending)}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold"
            onClick={handlers.onReject}>
            Reject Application
          </Button>
        </>
      )}

      {isSCP &&
        (status === "EXAM_SCHEDULED" || status === "ASSESSMENT_TAKEN") &&
        assessmentDecisionAction && (
          <Button
            className={`w-full font-bold ${
              assessmentDecisionAction === "PASS"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }`}
            onClick={
              assessmentDecisionAction === "PASS"
                ? handlers.onPass
                : handlers.onFail
            }>
            {assessmentDecisionAction === "PASS"
              ? "Mark as Passed"
              : "Mark as Failed"}
          </Button>
        )}

      {isSCP && status === "PASSED" && (
        <>
          {handlers.onScheduleInterview && (
            <Button
              className="w-full bg-amber-600 text-white hover:bg-amber-700 font-bold"
              onClick={handlers.onScheduleInterview}>
              Schedule Interview
            </Button>
          )}
        </>
      )}

      {(status === "PASSED" || status === "UNDER_REVIEW") &&
        isPendingLrnCreation &&
        handlers.onAssignLrn && (
          <Button
            variant="outline"
            className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 font-bold"
            onClick={handlers.onAssignLrn}>
            Assign LRN
          </Button>
        )}

      {isSCP && status === "FAILED_ASSESSMENT" && (
        <>
          <Button
            className="w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90 font-bold"
            onClick={handlers.onOfferRegular}>
            Offer Regular Section
          </Button>
          <Button
            variant="outline"
            className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold"
            onClick={handlers.onReject}>
            Reject
          </Button>
        </>
      )}

      {canToggleProfileLock && (
        <>
          <Button
            variant={isProfileLocked ? "outline" : "destructive"}
            className={`w-full font-bold ${
              isProfileLocked
                ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                : ""
            }`}
            onClick={() => handlers.onSetProfileLock?.(!isProfileLocked)}>
            {isProfileLocked
              ? "Unlock Profile (Admin Override)"
              : "Lock Profile (Admin Override)"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Profile is currently {isProfileLocked ? "LOCKED" : "UNLOCKED"}.
          </p>
        </>
      )}

      {(((status === "OFFICIALLY_ENROLLED" || status === "ENROLLED") &&
        !canToggleProfileLock) ||
        status === "REJECTED" ||
        status === "WITHDRAWN") && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No further actions available for this application.
        </p>
      )}
    </div>
  );
}
