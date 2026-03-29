import { useState, useEffect } from 'react';
import {
	Check,
	AlertCircle,
	Info,
	Loader2,
	ExternalLink,
	BookOpen,
	Save,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router';
import api from '@/shared/api/axiosInstance';
import { toastApiError } from '@/shared/hooks/useApiToast';
import { sileo } from 'sileo';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/shared/ui/tooltip';
import type {
	LearnerType,
	ChecklistData,
} from '@/features/enrollment/hooks/useApplicationDetail';

interface Props {
	applicantId: number;
	learnerType: LearnerType;
	checklist?: ChecklistData;
	onRefresh: () => void;
}

interface RequirementItem {
	key: keyof Omit<ChecklistData, 'id' | 'applicantId' | 'updatedAt'>;
	label: string;
	description: string;
	isMandatory: boolean;
}

export function RequirementChecklist({
	applicantId,
	learnerType,
	checklist,
	onRefresh,
}: Props) {
	const [isUpdating, setIsUpdating] = useState(false);
	const [localChecklist, setLocalChecklist] = useState<Partial<ChecklistData>>(
		checklist || {},
	);

	useEffect(() => {
		if (checklist) {
			setLocalChecklist(checklist);
		}
	}, [checklist]);

	const requirements: RequirementItem[] = [
		{
			key: 'isPsaBirthCertPresented',
			label: 'PSA Birth Certificate',
			description:
				'Submitted once per school stay. Mandatory for new enrollees and transferees.',
			isMandatory: learnerType !== 'CONTINUING',
		},
		{
			key: 'isSf9Submitted',
			label: 'SF9 / Report Card',
			description:
				'Proof of last grade level completed. Mandatory for new enrollees and transferees.',
			isMandatory: learnerType !== 'CONTINUING',
		},
		{
			key: 'isConfirmationSlipReceived',
			label: 'Confirmation Slip',
			description:
				'Mandatory for Grade 8-10 and Grade 12 continuing learners to confirm intent to enroll.',
			isMandatory: learnerType === 'CONTINUING',
		},
		{
			key: 'isSf10Requested',
			label: 'SF10 (Permanent Record)',
			description:
				'NOT an initial requirement. Transmitted school-to-school via LIS tracking after enrollment.',
			isMandatory: false,
		},
		{
			key: 'isGoodMoralPresented',
			label: 'Good Moral Certificate',
			description: 'Not required for public schools per DO 017, s. 2025.',
			isMandatory: false,
		},
		{
			key: 'isMedicalEvalSubmitted',
			label: 'Medical Evaluation',
			description:
				'Not required unless for specific health-related program requirements or LWD.',
			isMandatory: false,
		},
		{
			key: 'isUndertakingSigned',
			label: 'Affidavit of Undertaking',
			description:
				'Required for transferees with unpaid private school fees or missing documents (Temporary Enrollment).',
			isMandatory: learnerType === 'TRANSFEREE',
		},
	];

	const handleToggle = (key: keyof ChecklistData, value: boolean) => {
		setLocalChecklist((prev) => ({ ...prev, [key]: value }));
	};

	const hasChanges = requirements.some(
		(req) => !!localChecklist[req.key] !== !!checklist?.[req.key],
	);

	const handleSave = async () => {
		setIsUpdating(true);
		try {
			// Strip non-updatable fields
			const payload = { ...localChecklist };
			delete payload.id;
			delete payload.applicantId;
			delete payload.updatedAt;

			await api.patch(`/applications/${applicantId}/checklist`, payload);
			sileo.success({
				title: 'Checklist Updated',
				description: 'Documentary Checklist has been updated.',
			});
			onRefresh();
		} catch (error) {
			toastApiError(error as never);
		} finally {
			setIsUpdating(false);
		}
	};

	const getLearnerTypeLabel = (type: LearnerType) => {
		switch (type) {
			case 'NEW_ENROLLEE':
				return 'New Enrollee';
			case 'TRANSFEREE':
				return 'Transferee';
			case 'RETURNING':
				return 'Returning (Balik-Aral)';
			case 'CONTINUING':
				return 'Continuing';
			default:
				return type;
		}
	};

	const mandatoryMet = requirements
		.filter((r) => r.isMandatory)
		.every((r) => localChecklist[r.key]);

	return (
		<Card>
			<CardHeader className='pb-3'>
				<div className='flex items-center justify-between'>
					<CardTitle className='text-sm font-bold uppercase tracking-wider flex items-center gap-2'>
						Documentary Checklist
						{isUpdating && (
							<Loader2 className='h-3 w-3 animate-spin text-muted-foreground' />
						)}
					</CardTitle>
					<div className='flex items-center gap-2'>
						<Badge variant={mandatoryMet ? 'success' : 'secondary'}>
							{mandatoryMet
								? 'Mandatory Documents Met'
								: 'Pending Mandatory Documents'}
						</Badge>
						<Button
							size='sm'
							onClick={handleSave}
							disabled={isUpdating || !hasChanges}
							className='h-7 text-[10px] font-bold uppercase tracking-tight gap-1.5'
						>
							{isUpdating ? (
								<Loader2 className='h-3 w-3 animate-spin' />
							) : (
								<Save className='h-3 w-3' />
							)}
							Save Changes
						</Button>
					</div>
				</div>
				<p className='text-[10px] text-muted-foreground mt-1'>
					Learner Type:{' '}
					<span className='font-bold text-primary'>
						{getLearnerTypeLabel(learnerType)}
					</span>
				</p>
			</CardHeader>
			<CardContent className='space-y-4'>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2'>
					{requirements.map((req) => (
						<div
							key={req.key}
							className='flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50'
						>
							<Checkbox
								id={req.key}
								checked={!!localChecklist[req.key]}
								onCheckedChange={(checked) => handleToggle(req.key, !!checked)}
								disabled={isUpdating}
								className='shrink-0'
							/>
							<div className='flex-1 space-y-1 overflow-hidden'>
								<div className='flex items-center gap-2'>
									<Label
										htmlFor={req.key}
										className='text-[12px] font-bold leading-tight cursor-pointer truncate'
										title={req.label}
									>
										{req.label}
									</Label>
									{req.isMandatory && (
										<Badge
											variant='outline'
											className='text-[8px] h-3.5 px-1 text-red-600 border-red-200 bg-red-50 shrink-0'
										>
											M
										</Badge>
									)}
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Info className='h-3 w-3 text-muted-foreground cursor-help shrink-0' />
											</TooltipTrigger>
											<TooltipContent>
												<p className='max-w-xs text-xs'>{req.description}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							</div>
							<div className='shrink-0'>
								{localChecklist[req.key] ? (
									<Check className='h-3.5 w-3.5 text-green-600' />
								) : (
									req.isMandatory && (
										<AlertCircle className='h-3.5 w-3.5 text-amber-500' />
									)
								)}
							</div>
						</div>
					))}
				</div>

				{checklist?.updatedAt && (
					<p className='text-[9px] text-right text-muted-foreground pt-2 border-t'>
						Last updated:{' '}
						{format(new Date(checklist.updatedAt), 'MMM dd, yyyy hh:mm a')}
					</p>
				)}

				<div className='pt-2'>
					<Button
						variant='outline'
						size='sm'
						className='w-full text-[10px] h-8 font-bold gap-2 uppercase tracking-wider'
						asChild
					>
						<Link
							to='/enrollment/requirements'
							target='_blank'
						>
							<BookOpen className='h-3 w-3' />
							View Requirements Guide
							<ExternalLink className='h-2 w-2 ml-auto' />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
