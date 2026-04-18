import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router";
import { ArrowRight, ExternalLink, User } from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
import type { AssessmentStep } from "@/features/enrollment/hooks/useApplicationDetail";
import { StatusBadge } from "./StatusBadge";
import { ActionButtons } from "./ActionButtons";
import { SCPAssessmentBlock } from "./SCPAssessmentBlock";
import { StatusTimeline } from "./StatusTimeline";
import {
  PersonalInfo,
  AddressInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "./BeefSections";
import { RequirementChecklist } from "./RequirementChecklist";
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { SheetTitle, SheetDescription } from "@/shared/ui/sheet";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { ImageEnlarger } from "@/shared/components/ImageEnlarger";
import { formatScpType, isMandatoryDocumentsMet } from "@/shared/lib/utils";

interface Props {
  id: number;
  endpointBase?: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onScheduleExam: () => void;
  onRecordResult: () => void;
  onPass: () => void;
  onFail: () => void;
  onOfferRegular: () => void;
  onTemporarilyEnroll: () => void;
  onAssignLrn?: () => Promise<void> | void;
  onEnroll?: () => Promise<void> | void;
  onScheduleInterview?: () => void;
  onScheduleStep?: (step: AssessmentStep) => void;
  onRecordStepResult?: (step: AssessmentStep) => void;
  onSetProfileLock?: (lock: boolean) => Promise<void> | void;
  onMarkVerified?: () => Promise<void> | void;
  onSaveStepResult?: (
    stepOrder: number,
    kind: string,
    score: number,
    cutoffScore: number | null,
  ) => Promise<void>;
  onMarkInterviewPassed?: () => Promise<void>;
  showActions?: boolean;
  showRawJson?: boolean;
  pipelineProcessHref?: string;
}

export function ApplicationDetailPanel({
  id,
  endpointBase = "/applications",
  onClose,
  onApprove,
  onReject,
  onScheduleExam,
  onRecordResult,
  onPass,
  onFail,
  onOfferRegular,
  onTemporarilyEnroll,
  onAssignLrn,
  onEnroll,
  onScheduleInterview,
  onScheduleStep,
  onRecordStepResult,
  onSetProfileLock,
  onMarkVerified,
  onSaveStepResult,
  onMarkInterviewPassed,
  showActions = true,
  showRawJson = false,
  pipelineProcessHref,
}: Props) {
  const {
    data: applicant,
    loading,
    error,
    refetch,
  } = useApplicationDetail(id, false, endpointBase);

  // Rule A & B: Delayed loading
  const showSkeleton = useDelayedLoading(loading);

  const [photoError, setPhotoError] = useState(false);
  const [isPhotoEnlarged, setIsPhotoEnlarged] = useState(false);
  const [interviewPassChecked, setInterviewPassChecked] = useState(false);

  useEffect(() => {
    setInterviewPassChecked(false);
  }, [id]);

  const runAndClose = async (
    action?: () => Promise<void> | void,
  ): Promise<void> => {
    onClose();
    await action?.();
  };

  const runWithArgAndClose = async <T,>(
    action: ((value: T) => Promise<void> | void) | undefined,
    value: T,
  ): Promise<void> => {
    onClose();
    await action?.(value);
  };

  const getImageUrl = (photo: string | null) => {
    if (!photo) return null;
    if (photo.startsWith("data:")) return photo;
    // Assuming /uploads/filename.ext - need to prefix with backend origin
    const baseUrl = (import.meta.env.VITE_API_URL || "/api").replace(
      /\/api$/,
      "",
    );
    return `${baseUrl}${photo}`;
  };

  const persistedMandatoryMet = applicant
    ? isMandatoryDocumentsMet(applicant.learnerType, applicant.checklist)
    : false;

  const [mandatoryMet, setMandatoryMet] = useState(false);

  useEffect(() => {
    setMandatoryMet(persistedMandatoryMet);
  }, [persistedMandatoryMet]);

  if (showSkeleton) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <div>
            <SheetTitle className="text-base sm:text-lg font-bold tracking-tight uppercase">
              <Skeleton className="h-6 w-40" />
            </SheetTitle>
            <SheetDescription
              asChild
              className="text-[11px] sm:text-xs text-muted-foreground mt-1">
              <div>
                <Skeleton className="h-3 w-24" />
              </div>
            </SheetDescription>
          </div>
        </div>
        <div className="flex-1 p-3 sm:p-6 space-y-4 overflow-y-auto">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-[200px] w-full mt-8" />
          <Skeleton className="h-[100px] w-full mt-4" />
        </div>
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <SheetTitle className="text-base sm:text-lg font-bold tracking-tight uppercase">
            Error
          </SheetTitle>
          <SheetDescription className="hidden">
            Failed to load application
          </SheetDescription>
        </div>
        <div className="h-full flex flex-col p-4 sm:p-6 items-center justify-center text-center">
          <p className="text-destructive mb-4">
            {error || "Application not found"}
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0 bg-primary font-black">
        <div>
          <SheetTitle className="text-base sm:text-lg text-primary-foreground font-black tracking-tight uppercase">
            Application Detail
          </SheetTitle>
          <SheetDescription className="text-[11px] sm:text-xs text-primary-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>#{applicant.trackingNumber}</span>
            <span className="hidden sm:inline">|</span>
            <span>
              {applicant.admissionChannel === "F2F Applicant"
                ? "F2F Applicant"
                : "Online Applicant"}
            </span>
            <span className="hidden sm:inline">|</span>
            <span>
              {applicant.createdAt
                ? format(new Date(applicant.createdAt), "MMMM d, yyyy")
                : "N/A"}
            </span>
          </SheetDescription>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 font-bold">
        {/* Summary Block */}
        <div className="bg-[hsl(var(--muted))] p-3 sm:p-4 rounded-md border">
          <div className="flex flex-col items-center mb-6 pt-2">
            <div
              className={`w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-primary border-dashed shadow-md overflow-hidden bg-background flex items-center justify-center mb-4 ${applicant.studentPhoto && !photoError ? "cursor-zoom-in hover:border-solid transition-all" : ""}`}
              onClick={() =>
                applicant.studentPhoto &&
                !photoError &&
                setIsPhotoEnlarged(true)
              }>
              {applicant.studentPhoto && !photoError ? (
                <img
                  src={getImageUrl(applicant.studentPhoto) || ""}
                  alt="Student"
                  className="w-full h-full object-cover"
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
                  <User className="w-10 h-10 mb-1 opacity-20" />
                  <span className="text-[0.5rem] font-black uppercase tracking-tighter opacity-40">
                    {photoError ? "No Photo" : ""}
                  </span>
                </div>
              )}
            </div>
            <div className="text-center">
              <h3 className="font-black text-lg sm:text-xl uppercase tracking-tight break-words">
                {applicant.lastName}, {applicant.firstName}{" "}
                {applicant.middleName}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-1 font-black">
                <StatusBadge status={applicant.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-0 border-t pt-4">
            <div>
              <p className="text-[10px] sm:text-[0.625rem] uppercase tracking-widest">
                Grade Level (Applicant Type)
              </p>
              <p className="text-xs sm:text-sm">
                {applicant.gradeLevel.name} <br />(
                {formatScpType(applicant.applicantType)})
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] sm:text-[0.625rem] uppercase tracking-widest">
                Learner Reference Number
              </p>
              <p className="text-xs sm:text-sm ">{applicant.lrn || "N/A"}</p>
              {applicant.isPendingLrnCreation && (
                <p className="text-[10px] sm:text-xs font-bold text-amber-700">
                  Pending LRN Creation
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SCP Assessment Block (Only if not regular) */}
        <SCPAssessmentBlock
          applicant={applicant}
          onSaveStepResult={
            showActions && onSaveStepResult
              ? async (stepOrder, kind, score, cutoffScore) => {
                  await onSaveStepResult(stepOrder, kind, score, cutoffScore);
                  refetch();
                }
              : undefined
          }
          onSubmitInterviewResult={
            showActions && onMarkInterviewPassed
              ? async (passed) => {
                  if (passed) {
                    await runAndClose(onMarkInterviewPassed);
                  } else {
                    await runAndClose(onFail);
                  }
                  setInterviewPassChecked(false);
                }
              : undefined
          }
          interviewPassChecked={interviewPassChecked}
          onInterviewPassChange={setInterviewPassChecked}
        />

        {/* Documentary Checklist */}
        <RequirementChecklist
          applicantId={applicant.id}
          learnerType={applicant.learnerType}
          checklist={applicant.checklist}
          endpointBase={endpointBase}
          onRefresh={refetch}
          onMandatoryStatusChange={setMandatoryMet}
          readOnly={!showActions}
        />

        {/* Collapsible BEEF Sections */}
        <div className="space-y-2">
          <PersonalInfo applicant={applicant} />
          <AddressInfo applicant={applicant} />
          <GuardianContact applicant={applicant} />
          <PreviousSchool applicant={applicant} />
          <Classifications applicant={applicant} />
        </div>

        {/* Timeline */}
        <StatusTimeline applicant={applicant} />

        {showRawJson && (
          <div className="rounded-md border bg-muted/20">
            <details className="group">
              <summary className="cursor-pointer list-none p-3 text-xs sm:text-sm font-bold uppercase tracking-wide">
                <span className="group-open:hidden">
                  Show Raw Application JSON
                </span>
                <span className="hidden group-open:inline">
                  Hide Raw Application JSON
                </span>
              </summary>
              <pre className="max-h-56 overflow-auto border-t bg-background p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all">
                {JSON.stringify(applicant, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {pipelineProcessHref && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] sm:text-xs uppercase tracking-wider text-muted-foreground">
              Processing Needed?
            </p>
            <Link
              to={pipelineProcessHref}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
              onClick={onClose}>
              Go to Registration Pipeline to Process
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Link to full details */}
        <div className="py-2 border-t mt-4 flex justify-center">
          <Link
            to={`/monitoring/early-registration/${applicant.id}`}
            className="text-[hsl(var(--accent-link))] hover:underline flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            onClick={onClose}>
            View Full Details <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {showActions && (
        <ActionButtons
          applicant={applicant}
          onApprove={() => runAndClose(onApprove)}
          onReject={() => runAndClose(onReject)}
          onScheduleExam={() => runAndClose(onScheduleExam)}
          onRecordResult={() => runAndClose(onRecordResult)}
          onPass={() => runAndClose(onPass)}
          onFail={() => runAndClose(onFail)}
          onOfferRegular={() => runAndClose(onOfferRegular)}
          onTemporarilyEnroll={() => runAndClose(onTemporarilyEnroll)}
          onAssignLrn={onAssignLrn ? () => runAndClose(onAssignLrn) : undefined}
          onEnroll={onEnroll ? () => runAndClose(onEnroll) : undefined}
          onScheduleInterview={
            onScheduleInterview
              ? () => runAndClose(onScheduleInterview)
              : undefined
          }
          onScheduleStep={
            onScheduleStep
              ? (step) => runWithArgAndClose(onScheduleStep, step)
              : undefined
          }
          onRecordStepResult={
            onRecordStepResult
              ? (step) => runWithArgAndClose(onRecordStepResult, step)
              : undefined
          }
          onSetProfileLock={
            onSetProfileLock
              ? (lock) => runWithArgAndClose(onSetProfileLock, lock)
              : undefined
          }
          onMarkVerified={
            onMarkVerified ? () => runAndClose(onMarkVerified) : undefined
          }
          isMandatoryDocumentsMet={mandatoryMet}
        />
      )}

      {applicant.studentPhoto && (
        <ImageEnlarger
          src={getImageUrl(applicant.studentPhoto) || ""}
          isOpen={isPhotoEnlarged}
          onClose={() => setIsPhotoEnlarged(false)}
          alt={`${applicant.lastName} profile photo`}
        />
      )}
    </div>
  );
}
