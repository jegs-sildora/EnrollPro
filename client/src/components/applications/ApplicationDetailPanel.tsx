import { format } from "date-fns";
import { Link } from "react-router";
import { X, ExternalLink } from "lucide-react";
import { useApplicationDetail } from "@/hooks/useApplicationDetail";
import { StatusBadge } from "./StatusBadge";
import { ActionButtons } from "./ActionButtons";
import { SCPAssessmentBlock } from "./SCPAssessmentBlock";
import { StatusTimeline } from "./StatusTimeline";
import {
  PersonalInfo,
  GuardianContact,
  PreviousSchool,
  Classifications,
} from "./BeefSections";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Props {
  id: number;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onScheduleExam: () => void;
  onRecordResult: () => void;
  onPass: () => void;
  onFail: () => void;
  onOfferRegular: () => void;
}

export function ApplicationDetailPanel({
  id,
  onClose,
  onApprove,
  onReject,
  onScheduleExam,
  onRecordResult,
  onPass,
  onFail,
  onOfferRegular,
}: Props) {
  const { data: applicant, loading, error } = useApplicationDetail(id);

  if (loading) {
    return (
      <div className="h-full flex flex-col p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-[200px] w-full mt-8" />
        <Skeleton className="h-[100px] w-full mt-4" />
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className="h-full flex flex-col p-6 items-center justify-center text-center">
        <p className="text-destructive mb-2">{error || "Application not found"}</p>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div>
          <h2 className="text-lg font-bold tracking-tight">APPLICATION DETAIL</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>#{applicant.trackingNumber}</span>
            <span>·</span>
            <span>{applicant.admissionChannel === 'F2F' ? 'F2F' : 'Online'}</span>
            <span>·</span>
            <span>{format(new Date(applicant.createdAt), 'MMM d, yyyy')}</span>
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Summary Block */}
        <div className="bg-[hsl(var(--muted))] p-4 rounded-md border">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-lg uppercase tracking-tight">
                {applicant.lastName}, {applicant.firstName} {applicant.middleName}
              </h3>
              <p className="text-sm">
                Grade {applicant.gradeLevel.name} · {applicant.applicantType === 'REGULAR' ? 'Regular Admission' : `⚡ ${applicant.applicantType}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                LRN: {applicant.lrn || 'N/A'}
              </p>
            </div>
            <StatusBadge status={applicant.status} />
          </div>
        </div>

        {/* SCP Assessment Block (Only if not regular) */}
        <SCPAssessmentBlock applicant={applicant} />

        {/* Collapsible BEEF Sections */}
        <div className="space-y-2">
          <PersonalInfo applicant={applicant} />
          <GuardianContact applicant={applicant} />
          <PreviousSchool applicant={applicant} />
          <Classifications applicant={applicant} />
        </div>

        {/* Timeline */}
        <StatusTimeline applicant={applicant} />

        {/* Link to full details */}
        <div className="py-2 border-t mt-4 flex justify-center">
          <Link 
            to={`/applications/admission/${applicant.id}`} 
            className="text-[hsl(var(--accent))] hover:underline flex items-center gap-1.5 text-sm font-medium"
            onClick={onClose}
          >
            View Full Details <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

      </div>

      {/* Action Buttons Pinned to Bottom */}
      <ActionButtons 
        applicant={applicant}
        onApprove={onApprove}
        onReject={onReject}
        onScheduleExam={onScheduleExam}
        onRecordResult={onRecordResult}
        onPass={onPass}
        onFail={onFail}
        onOfferRegular={onOfferRegular}
      />
    </div>
  );
}
