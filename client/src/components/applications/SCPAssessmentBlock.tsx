import { format } from 'date-fns';
import type { ApplicantDetail } from '@/hooks/useApplicationDetail';

interface Props {
  applicant: ApplicantDetail;
}

export function SCPAssessmentBlock({ applicant }: Props) {
  if (applicant.applicantType === 'REGULAR') return null;

  return (
    <div className="border border-indigo-200 bg-indigo-50/50 rounded-md p-3 mb-4 space-y-2">
      <div className="flex items-center gap-2 font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-2">
        <span>⚡</span>
        <span>{applicant.scpType} ASSESSMENT</span>
      </div>

      <div className="text-sm grid grid-cols-[110px_1fr] gap-1">
        <span className="text-muted-foreground">Type:</span>
        <span className="font-medium">{applicant.assessmentType || 'Not specified'}</span>

        <span className="text-muted-foreground">Date:</span>
        <span className="font-medium">
          {applicant.examDate ? format(new Date(applicant.examDate), 'MMM dd, yyyy') : 'Not yet scheduled'}
        </span>

        {applicant.examVenue && (
          <>
            <span className="text-muted-foreground">Venue:</span>
            <span className="font-medium">{applicant.examVenue}</span>
          </>
        )}

        <span className="text-muted-foreground">Score/Result:</span>
        <span className="font-medium">
          {applicant.examScore !== null ? `${applicant.examScore} / 100` : applicant.examResult || '—'}
        </span>

        {applicant.auditionResult && (
          <>
            <span className="text-muted-foreground">Audition:</span>
            <span className="font-medium">{applicant.auditionResult}</span>
          </>
        )}

        {applicant.tryoutResult && (
          <>
            <span className="text-muted-foreground">Tryout:</span>
            <span className="font-medium">{applicant.tryoutResult}</span>
          </>
        )}

        {applicant.examNotes && (
          <>
            <span className="text-muted-foreground">Notes:</span>
            <span className="font-medium italic text-indigo-800">{applicant.examNotes}</span>
          </>
        )}
      </div>
    </div>
  );
}
