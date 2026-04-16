import { format } from 'date-fns';
import type { ApplicantDetail } from '@/features/enrollment/hooks/useApplicationDetail';
import { STATUS_CONFIG } from '../constants';

interface Props {
	applicant: ApplicantDetail;
}

export function StatusTimeline({ applicant }: Props) {
	// Use a simulated basic timeline if emailLogs or auditLogs are not structured yet,
	// or build from applicant timestamps
	const timeline = [];

	if (applicant.createdAt && !isNaN(new Date(applicant.createdAt).getTime())) {
		timeline.push({
			date: new Date(applicant.createdAt),
			label: `Submitted (${applicant.admissionChannel === 'F2F' ? 'F2F' : 'Online'})`,
		});
	}

	// Example heuristic timeline. In reality, we'd map over applicant.emailLogs or an audit array.
	// We'll stick to a simple display.
	if (
		[
			'UNDER_REVIEW',
			'ELIGIBLE',
			'ASSESSMENT_SCHEDULED',
			'ASSESSMENT_TAKEN',
			'PASSED',
			'INTERVIEW_SCHEDULED',
			'PRE_REGISTERED',
			'ENROLLED',
			'REJECTED',
		].includes(applicant.status) &&
		applicant.updatedAt &&
		!isNaN(new Date(applicant.updatedAt).getTime())
	) {
		const statusLabel =
			STATUS_CONFIG[applicant.status]?.label ||
			applicant.status.replace('_', ' ');
		timeline.push({
			date: new Date(applicant.updatedAt),
			label: `Status changed to ${statusLabel}`,
		});
	}

	// Sort by date desc
	timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

	return (
		<div className='mt-4 p-4 border-t'>
			<h3 className='text-xs font-bold text-muted-foreground tracking-wider mb-3 uppercase'>
				Timeline
			</h3>
			<div className='space-y-3'>
				{timeline.map((event, idx) => (
					<div
						key={idx}
						className='flex gap-3 items-start'
					>
						<div className='flex flex-col items-center pt-1'>
							<div className='w-2 h-2 rounded-full bg-muted-foreground' />
							{idx < timeline.length - 1 && (
								<div className='w-px h-full bg-border mt-1' />
							)}
						</div>
						<div className='text-sm'>
							<p className='font-medium text-foreground'>{event.label}</p>
							<p className='text-xs text-muted-foreground'>
								{format(event.date, 'MMM d, yyyy h:mm a')}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
