import { Badge } from '@/components/ui/badge';

const CONFIG: Record<string, { label: string; className: string }> = {
  SUBMITTED:      { label: 'Submitted',      className: 'bg-slate-100 text-slate-700 border-slate-300' },
  UNDER_REVIEW:   { label: 'Under Review',   className: 'bg-blue-100 text-blue-800 border-blue-300' },
  FOR_REVISION:   { label: 'For Revision',   className: 'bg-orange-100 text-orange-800 border-orange-300' },
  ELIGIBLE:       { label: 'Eligible',       className: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  PENDING:        { label: 'Pending',        className: 'bg-amber-100 text-amber-800 border-amber-300' },
  EXAM_SCHEDULED: { label: 'Exam Scheduled', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  ASSESSMENT_SCHEDULED: { label: 'Assessment Scheduled', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  EXAM_TAKEN:     { label: 'Exam Taken',     className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  ASSESSMENT_TAKEN: { label: 'Assessment Taken', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  PASSED:         { label: 'Passed',         className: 'bg-green-100 text-green-800 border-green-300' },
  FAILED:         { label: 'Failed',         className: 'bg-red-100 text-red-800 border-red-300' },
  NOT_QUALIFIED:  { label: 'Not Qualified',  className: 'bg-red-100 text-red-800 border-red-300' },
  APPROVED:       { label: 'Approved',       className: 'bg-white text-green-700 border-green-500' },
  PRE_REGISTERED: { label: 'Approved',       className: 'bg-white text-green-700 border-green-500' },
  ENROLLED:       { label: 'Enrolled',       className: 'bg-green-500 text-white border-transparent' },
  REJECTED:       { label: 'Rejected',       className: 'bg-red-100 text-red-800 border-red-300' },
  WITHDRAWN:      { label: 'Withdrawn',      className: 'bg-zinc-100 text-zinc-700 border-zinc-300' },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = CONFIG[status] ?? {
    label: status, className: 'bg-muted text-muted-foreground border-muted-foreground',
  };
  return (
    <Badge
      variant="outline"
      className={className}
      aria-label={`Status: ${label}`}
    >
      {label}
    </Badge>
  );
}
