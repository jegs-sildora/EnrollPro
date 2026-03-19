import { Button } from "@/components/ui/button";
import type { ApplicantDetail } from "@/hooks/useApplicationDetail";

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
}

export function ActionButtons({ applicant, ...handlers }: Props) {
  const { status, applicantType } = applicant;
  const isRegular = applicantType === "REGULAR";
  const isSCP = !isRegular;

  return (
    <div className='flex flex-col gap-2 p-4 border-t bg-background mt-auto'>
      {/* Existing action for regular applicants */}
      {isRegular &&
        ["SUBMITTED", "UNDER_REVIEW", "ELIGIBLE"].includes(status) && (
          <>
            <Button
              className='w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90'
              onClick={handlers.onApprove}>
              Approve &amp; Assign Section
            </Button>
            <Button
              variant='outline'
              className='w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
              onClick={handlers.onReject}>
              Reject Application
            </Button>
          </>
        )}

      {/* Temporary Enrollment - Phase 2 (Missing Docs) */}
      {(status === "UNDER_REVIEW" || status === "PRE_REGISTERED") && (
        <Button
          variant='secondary'
          className='w-full border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
          onClick={handlers.onTemporarilyEnroll}>
          Mark as Temporarily Enrolled
        </Button>
      )}

      {isSCP && ["SUBMITTED", "UNDER_REVIEW", "ELIGIBLE"].includes(status) && (
        <>
          <Button
            className='w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90'
            onClick={handlers.onScheduleExam}>
            Verify &amp; Schedule Exam
          </Button>
          <Button
            variant='outline'
            className='w-full border-primary text-primary border-2'
            onClick={handlers.onReject}>
            Reject Application
          </Button>
        </>
      )}

      {isSCP && status === "ASSESSMENT_SCHEDULED" && (
        <Button
          className='w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90'
          onClick={handlers.onRecordResult}>
          Record Assessment Result
        </Button>
      )}

      {isSCP && status === "ASSESSMENT_TAKEN" && (
        <>
          <Button
            className='w-full bg-green-600 text-white hover:bg-green-700'
            onClick={handlers.onPass}>
            Mark as Passed
          </Button>
          <Button
            variant='outline'
            className='w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
            onClick={handlers.onFail}>
            Mark as Failed
          </Button>
        </>
      )}

      {isSCP && status === "PASSED" && (
        <Button
          className='w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90'
          onClick={handlers.onApprove}>
          Assign Section
        </Button>
      )}

      {isSCP && status === "NOT_QUALIFIED" && (
        <>
          <Button
            className='w-full bg-[hsl(var(--primary))] text-primary-foreground hover:opacity-90'
            onClick={handlers.onOfferRegular}>
            Offer Regular Section
          </Button>
          <Button
            variant='outline'
            className='w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
            onClick={handlers.onReject}>
            Reject
          </Button>
        </>
      )}

      {(status === "PRE_REGISTERED" ||
        status === "ENROLLED" ||
        status === "REJECTED") && (
        <p className='text-sm text-muted-foreground text-center py-2'>
          No further actions available for this application.
        </p>
      )}
    </div>
  );
}
