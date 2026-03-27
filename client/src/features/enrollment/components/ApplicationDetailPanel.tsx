import { useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router";
import { ExternalLink, User } from "lucide-react";
import { useApplicationDetail } from "@/features/enrollment/hooks/useApplicationDetail";
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
import { Skeleton } from "@/shared/ui/skeleton";
import { Button } from "@/shared/ui/button";
import { SheetTitle, SheetDescription } from "@/shared/ui/sheet";

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
  onTemporarilyEnroll: () => void;
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
  onTemporarilyEnroll,
}: Props) {
  const { data: applicant, loading, error } = useApplicationDetail(id);
  const [photoError, setPhotoError] = useState(false);

  const getImageUrl = (photo: string | null) => {
    if (!photo) return null;
    if (photo.startsWith("data:")) return photo;
    // Assuming /uploads/filename.ext - need to prefix with backend origin
    const baseUrl = (import.meta.env.VITE_API_URL || "http://192.168.254.106:3001/api").replace(/\/api$/, "");
    return `${baseUrl}${photo}`;
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full overflow-hidden bg-background'>
        <div className='flex items-center justify-between p-4 border-b shrink-0'>
          <div>
            <SheetTitle className='text-lg font-bold tracking-tight uppercase'>
              <Skeleton className='h-6 w-40' />
            </SheetTitle>
            <SheetDescription
              asChild
              className='text-xs text-muted-foreground mt-1'>
              <div>
                <Skeleton className='h-3 w-24' />
              </div>
            </SheetDescription>
          </div>
        </div>
        <div className='flex-1 p-6 space-y-4 overflow-y-auto'>
          <Skeleton className='h-32 w-full' />
          <Skeleton className='h-[200px] w-full mt-8' />
          <Skeleton className='h-[100px] w-full mt-4' />
        </div>
      </div>
    );
  }

  if (error || !applicant) {
    return (
      <div className='flex flex-col h-full overflow-hidden bg-background'>
        <div className='flex items-center justify-between p-4 border-b shrink-0'>
          <SheetTitle className='text-lg font-bold tracking-tight uppercase'>
            Error
          </SheetTitle>
          <SheetDescription className='hidden'>
            Failed to load application
          </SheetDescription>
        </div>
        <div className='h-full flex flex-col p-6 items-center justify-center text-center'>
          <p className='text-destructive mb-4'>
            {error || "Application not found"}
          </p>
          <Button variant='outline' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full overflow-hidden bg-background'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b shrink-0 bg-primary'>
        <div>
          <SheetTitle className='text-lg text-primary-foreground font-bold tracking-tight uppercase'>
            Application Detail
          </SheetTitle>
          <SheetDescription className='text-xs text-primary-foreground flex items-center gap-1.5'>
            <span>#{applicant.trackingNumber}</span>
            <span>·</span>
            <span>
              {applicant.admissionChannel === "F2F" ? "F2F" : "Online"}
            </span>
            <span>·</span>
            <span>{format(new Date(applicant.createdAt), "MMM d, yyyy")}</span>
          </SheetDescription>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4 font-bold'>
        {/* Summary Block */}
        <div className='bg-[hsl(var(--muted))] p-4 rounded-md border'>
          <div className='flex flex-col items-center mb-6 pt-2'>
            <div className='w-32 h-32 rounded-xl border-2 border-primary shadow-md overflow-hidden bg-background flex items-center justify-center mb-4'>
              {applicant.studentPhoto && !photoError ? (
                <img
                  src={getImageUrl(applicant.studentPhoto) || ""}
                  alt='Student'
                  className='w-full h-full object-cover'
                  onError={() => setPhotoError(true)}
                />
              ) : (
                <div className='w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/30'>
                  <User className='w-10 h-10 mb-1 opacity-20' />
                  <span className='text-[8px] font-black uppercase tracking-tighter opacity-40'>
                    {photoError ? "Invalid Photo" : "No Photo"}
                  </span>
                </div>
              )}
            </div>
            <div className='text-center'>
              <h3 className='font-bold text-xl uppercase tracking-tight text-foreground'>
                {applicant.lastName}, {applicant.firstName}{" "}
                {applicant.middleName}
              </h3>
              <div className='flex items-center justify-center gap-2 mt-1'>
                <StatusBadge status={applicant.status} />
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4 border-t pt-4'>
            <div>
              <p className='text-[10px] text-muted-foreground uppercase tracking-widest'>
                Program / Level
              </p>
              <p className='text-sm text-foreground'>
                {applicant.gradeLevel.name} ·{" "}
                {applicant.applicantType === "REGULAR"
                  ? "Regular"
                  : applicant.applicantType}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-[10px] text-muted-foreground uppercase tracking-widest'>
                Reference
              </p>
              <p className='text-sm text-foreground'>
                LRN: {applicant.lrn || "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* SCP Assessment Block (Only if not regular) */}
        <SCPAssessmentBlock applicant={applicant} />

        {/* Collapsible BEEF Sections */}
        <div className='space-y-2'>
          <PersonalInfo applicant={applicant} />
          <GuardianContact applicant={applicant} />
          <PreviousSchool applicant={applicant} />
          <Classifications applicant={applicant} />
        </div>

        {/* Timeline */}
        <StatusTimeline applicant={applicant} />

        {/* Link to full details */}
        <div className='py-2 border-t mt-4 flex justify-center'>
          <Link
            to={`/applications/admission/${applicant.id}`}
            className='text-[hsl(var(--accent-link))] hover:underline flex items-center gap-1.5 text-sm font-medium'
            onClick={onClose}>
            View Full Details <ExternalLink className='h-3 w-3' />
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
        onTemporarilyEnroll={onTemporarilyEnroll}
      />
    </div>
  );
}
