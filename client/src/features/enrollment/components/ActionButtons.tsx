import { Button } from "@/shared/ui/button";
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
  onMarkInterviewPassed?: () => void | Promise<void>;
  /** New: schedule a specific pipeline step */
  onScheduleStep?: (step: AssessmentStep) => void;
  /** New: record result for a specific pipeline step */
  onRecordStepResult?: (step: AssessmentStep) => void;
  interviewPassChecked?: boolean;
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
  interviewPassChecked,
  isMandatoryDocumentsMet = false,
  ...handlers
}: Props) {
  const { status, applicantType } = applicant;
  const isPendingLrnCreation = applicant.isPendingLrnCreation === true;
  const isRegular = applicantType === "REGULAR";
  const isSCP = !isRegular;

  const steps = applicant.assessmentSteps || [];
  const hasSteps = steps.length > 0;
  const nextPending = hasSteps ? getNextPendingStep(steps) : undefined;
  const assessmentDecisionAction = isSCP
    ? getAssessmentDecisionAction(steps)
    : null;

  return (
    <div className="flex flex-col gap-2 p-4 border-t bg-background mt-auto">
      {/* Existing action for regular applicants */}
      {isRegular &&
        ["SUBMITTED", "UNDER_REVIEW", "ELIGIBLE"].includes(status) && (
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
        status === "ELIGIBLE" ||
        status === "PRE_REGISTERED") && (
        <Button
          variant="secondary"
          className="w-full border-blue-300 text-blue-800 bg-blue-50 hover:bg-blue-100 font-bold"
          onClick={handlers.onTemporarilyEnroll}>
          Mark as Temporarily Enrolled
        </Button>
      )}

      {/* SCP: Verify & Schedule first step (pipeline-aware) */}
      {isSCP && ["SUBMITTED", "UNDER_REVIEW", "ELIGIBLE"].includes(status) && (
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
      {isSCP &&
        status === "ASSESSMENT_SCHEDULED" &&
        !assessmentDecisionAction && (
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
        (status === "ASSESSMENT_SCHEDULED" || status === "ASSESSMENT_TAKEN") &&
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

      {isSCP && status === "INTERVIEW_SCHEDULED" && (
        <>
          {interviewPassChecked && handlers.onMarkInterviewPassed ? (
            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
              onClick={handlers.onMarkInterviewPassed}>
              Ready for Enrollment
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground font-bold"
              onClick={handlers.onReject}>
              Reject Application
            </Button>
          )}
        </>
      )}

      {(status === "PRE_REGISTERED" || status === "TEMPORARILY_ENROLLED") &&
        handlers.onEnroll && (
          <>
            {isPendingLrnCreation && handlers.onAssignLrn && (
              <Button
                variant="outline"
                className="w-full border-amber-500 text-amber-700 hover:bg-amber-50 font-bold"
                onClick={handlers.onAssignLrn}>
                Assign LRN
              </Button>
            )}
          <Button
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
            onClick={handlers.onEnroll}
            disabled={isPendingLrnCreation}
            title={
              isPendingLrnCreation
                ? "Assign an LRN first before finalizing enrollment."
                : undefined
            }>
            {isPendingLrnCreation
              ? "Assign LRN Before Final Enrollment"
              : "Finalize Enrollment"}
          </Button>
          </>
        )}

      {isSCP && status === "NOT_QUALIFIED" && (
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

      {(status === "ENROLLED" ||
        status === "REJECTED" ||
        status === "WITHDRAWN") && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No further actions available for this application.
        </p>
      )}
    </div>
  );
}
