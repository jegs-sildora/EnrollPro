import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { format } from 'date-fns';
import api from '@/shared/api/axiosInstance';
import { toastApiError } from '@/shared/hooks/useApiToast';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/shared/ui/dialog';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { sileo } from 'sileo';
import type { ApplicantDetail } from '@/features/enrollment/hooks/useApplicationDetail';
import { formatScpType } from '@/shared/lib/utils';

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	applicant: ApplicantDetail | null;
	onSuccess: () => void;
	onCloseSheet?: () => void;
}

export function ScheduleExamDialog({
	open,
	onOpenChange,
	applicant,
	onSuccess,
	onCloseSheet,
}: Props) {
	const [examDate, setExamDate] = useState('');
	const [examTime, setExamTime] = useState('');
	const [examVenue, setExamVenue] = useState('');
	const [examNotes, setExamNotes] = useState('');
	const [scpConfig, setScpConfig] = useState<{
		scpType: string;
		examRequired: boolean;
		documentsRequired: string[];
		assessmentType?: string;
		examDate?: string;
		examTime?: string;
		notes?: string;
	} | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (open && applicant) {
			const fetchScpConfig = async () => {
				setLoading(true);
				try {
					const scpRes = await api.get(`/settings/scp-config`);
					const config = scpRes.data.scpConfigs.find(
						(c: { scpType: string }) => c.scpType === applicant.applicantType,
					);
					setScpConfig(config || null);

					if (config?.examDate) {
						setExamDate(format(new Date(config.examDate), 'yyyy-MM-dd'));
					} else {
						setExamDate('');
					}

					if (config?.examTime) {
						setExamTime(config.examTime);
					} else {
						setExamTime('');
					}

					if (config?.notes) {
						setExamNotes(config.notes);
					} else {
						setExamNotes('');
					}

					setExamVenue('');
				} catch (err) {
					toastApiError(err as never);
				} finally {
					setLoading(false);
				}
			};
			fetchScpConfig();
		}
	}, [open, applicant]);

	if (!applicant) return null;

	const handleSchedule = async () => {
		if (!examDate) return;
		try {
			await api.patch(`/applications/${applicant.id}/schedule-exam`, {
				examDate,
				examTime,
				examVenue,
				examNotes,
			});
			sileo.success({
				title: 'Scheduled',
				description: 'Exam scheduled successfully.',
			});
			onOpenChange(false);
			onSuccess();
			if (onCloseSheet) onCloseSheet();
		} catch (err) {
			toastApiError(err as never);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
		>
			<DialogContent className='max-w-2xl sm:w-full overflow-y-auto max-h-[90vh] scrollbar-thin'>
				<DialogHeader>
					<DialogTitle className='font-bold uppercase'>
						Schedule Exam
					</DialogTitle>
					<DialogDescription className='font-bold text-foreground'>
						Applicant: {applicant.lastName}, {applicant.firstName} (
						{applicant.gradeLevel.name} -{' '}
						{formatScpType(applicant.applicantType)})
					</DialogDescription>
				</DialogHeader>

				<div className='space-y-4 py-2'>
					<div className='rounded-lg border p-3 bg-slate-50 space-y-2'>
						<div className='flex items-center gap-2 text-emerald-700 font-bold text-sm'>
							<span>✓</span>
							<span>Documents Verified</span>
						</div>
						<p className='text-xs text-foreground leading-relaxed font-bold'>
							SF9 (Grade 6 Report Card) and PSA Birth Certificate have been
							checked and filed.
						</p>
					</div>

					<div className='space-y-1.5'>
						<Label className='font-semibold'>
							Assessment Type
						</Label>
						<div className='p-2 rounded border bg-muted/30 text-sm font-bold uppercase'>
							{scpConfig?.assessmentType || 'Written Entrance Exam'}
						</div>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label className='font-semibold'>Exam Date</Label>
							<div className='p-2 rounded border bg-muted/30 text-sm font-bold uppercase'>
								{examDate
									? format(new Date(examDate), 'MMMM d, yyyy')
									: 'NOT SET BY ADMIN'}
							</div>
						</div>
						<div className='space-y-2'>
							<Label className='font-semibold'>Exam Time</Label>
							<div className='p-2 rounded border bg-muted/30 text-sm font-bold'>
								{examTime
									? new Date(`2000-01-01T${examTime}`).toLocaleTimeString(
											'en-US',
											{
												hour: 'numeric',
												minute: '2-digit',
												hour12: true,
											},
										)
									: 'NOT SET BY ADMIN'}
							</div>
						</div>
					</div>

					<div className='grid grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label className='font-semibold'>Venue</Label>
							<Input
								className='uppercase font-bold'
								placeholder='e.g. Science Lab'
								value={examVenue}
								onChange={(e) => setExamVenue(e.target.value)}
							/>
						</div>
						<div className='space-y-2'>
							<Label className='font-semibold'>Notes</Label>
							<Input
								className='uppercase font-bold'
								placeholder='e.g. Bring pencils'
								value={examNotes}
								onChange={(e) => setExamNotes(e.target.value)}
							/>
						</div>
					</div>

					<Alert className='flex items-center bg-primary/5 border-primary/20 p-3 gap-3 min-h-0 [&>svg]:static [&>svg]:translate-y-0'>
						<Info className='h-4 w-4 stroke-primary shrink-0' />
						<AlertDescription className='!p-0 !m-0 !translate-y-0 font-bold text-primary/80 text-xs leading-tight'>
							A confirmation email will be sent to the parent/guardian at{' '}
							<span className='font-bold underline text-primary'>
								{applicant.emailAddress || 'N/A'}
							</span>{' '}
							with the exam schedule.
						</AlertDescription>
					</Alert>
				</div>

				<DialogFooter>
					<Button
						className='font-bold'
						variant='outline'
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className='font-bold'
						onClick={handleSchedule}
						disabled={!examDate || loading}
					>
						Confirm Schedule
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
