import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Eye } from 'lucide-react';
import { sileo } from 'sileo';
import api from '@/shared/api/axiosInstance';
import { useSettingsStore } from '@/store/settings.slice';
import { toastApiError } from '@/shared/hooks/useApiToast';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/shared/ui/table';
import { Badge } from '@/shared/ui/badge';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/shared/ui/dialog';
import { Sheet, SheetContent } from '@/shared/ui/sheet';
import { Label } from '@/shared/ui/label';
import { format } from 'date-fns';
import { ApplicationDetailPanel } from '@/features/enrollment/components/ApplicationDetailPanel';
import { ScheduleExamDialog } from '@/features/enrollment/components/ScheduleExamDialog';
import { ScheduleInterviewDialog } from '@/features/enrollment/components/ScheduleInterviewDialog';
import { StatusBadge } from '@/features/enrollment/components/StatusBadge';
import { Skeleton } from '@/shared/ui/skeleton';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { formatScpType, SCP_LABELS } from '@/shared/lib/utils';
import type { ApplicantDetail } from '@/features/enrollment/hooks/useApplicationDetail';

interface Application {
	id: number;
	lrn: string;
	lastName: string;
	firstName: string;
	middleName: string | null;
	suffix: string | null;
	trackingNumber: string;
	status: string;
	applicantType: string;
	gradeLevelId: number;
	gradeLevel: { name: string };
	strand?: { name: string } | null;
	createdAt: string;
}

const APPLICANT_TYPES = [
	{ value: 'ALL', label: 'All Types' },
	...Object.entries(SCP_LABELS).map(([value, label]) => ({
		value,
		label,
	})),
];

export default function EarlyRegistration() {
	const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
	const ayId = viewingSchoolYearId ?? activeSchoolYearId;

	const [applications, setApplications] = useState<Application[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);

	// Rule A & B: Delayed loading
	const showSkeleton = useDelayedLoading(loading);

	// Filters
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState('ALL');
	const [type, setType] = useState('ALL');
	const [page, setPage] = useState(1);

	// Detail/Action state
	const [selectedApp, setSelectedApp] = useState<
		Application | ApplicantDetail | null
	>(null);
	const [actionType, setActionType] = useState<
		'APPROVE' | 'REJECT' | 'RESULT' | 'ELIGIBLE' | null
	>(null);
	const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
	const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
	const [rejectionReason, setRejectionReason] = useState('');
	const [examScore, setExamScore] = useState('');
	const [examResult, setExamResult] = useState('PASSED');
	const [sections, setSections] = useState<
		{
			id: number;
			name: string;
			maxCapacity: number;
			_count: { enrollments: number };
		}[]
	>([]);
	const [selectedSectionId, setSelectedSectionId] = useState<string>('');

	const [selectedId, setSelectedId] = useState<number | null>(null);

	// --- Resizable Panel Logic (Fluid Percentage) ---
	const [panelPercentage, setPanelPercentage] = useState(45); // Default 45vw
	const isResizing = useRef(false);

	const handleMouseMove = useCallback((e: MouseEvent) => {
		if (!isResizing.current) return;
		const newWidthPercent =
			((window.innerWidth - e.clientX) / window.innerWidth) * 100;

		// Constraints: Between 20% and 95%
		if (newWidthPercent > 20 && newWidthPercent < 95) {
			setPanelPercentage(newWidthPercent);
		}
	}, []);

	const stopResizing = useCallback(() => {
		isResizing.current = false;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', stopResizing);
		document.body.style.cursor = 'default';
		document.body.style.userSelect = 'auto';
	}, [handleMouseMove]);

	const startResizing = useCallback(() => {
		isResizing.current = true;
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', stopResizing);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}, [handleMouseMove, stopResizing]);
	// ------------------------------------------------

	const fetchData = useCallback(async () => {
		if (!ayId) {
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (search) params.append('search', search);

			if (status !== 'ALL') {
				params.append('status', status);
			}

			if (type !== 'ALL') params.append('applicantType', type);
			params.append('page', String(page));
			params.append('limit', '50');

			const res = await api.get(`/applications?${params.toString()}`);

			let filteredApps = res.data.applications;
			if (status === 'ALL') {
				filteredApps = filteredApps.filter(
					(app: Application) =>
						!['ENROLLED', 'PRE_REGISTERED'].includes(app.status),
				);
			}

			setApplications(filteredApps);
			setTotal(
				status === 'ALL'
					? res.data.total -
							(res.data.applications.length - filteredApps.length)
					: res.data.total,
			);
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setLoading(false);
		}
	}, [ayId, search, status, type, page]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const fetchSections = async (glId: number) => {
		try {
			const res = await api.get(`/sections?gradeLevelId=${glId}`);
			setSections(res.data.sections);
		} catch (err) {
			toastApiError(err as never);
		}
	};

	const handleApprove = async () => {
		if (!selectedApp || !selectedSectionId) return;
		try {
			await api.patch(`/applications/${selectedApp.id}/approve`, {
				sectionId: parseInt(selectedSectionId),
			});
			sileo.success({
				title: 'Pre-registered',
				description: 'Student moved to Enrollment phase.',
			});
			setActionType(null);
			setSelectedId(null);
			fetchData();
		} catch (err) {
			toastApiError(err as never);
		}
	};

	const handleMarkEligible = async () => {
		if (!selectedApp) return;
		try {
			await api.patch(`/applications/${selectedApp.id}/mark-eligible`);
			sileo.success({
				title: 'Eligible',
				description: 'Marked as eligible for assessment.',
			});
			setActionType(null);
			fetchData();
		} catch (err) {
			toastApiError(err as never);
		}
	};

	const handleReject = async () => {
		if (!selectedApp) return;
		try {
			await api.patch(`/applications/${selectedApp.id}/reject`, {
				rejectionReason,
			});
			sileo.success({
				title: 'Rejected',
				description: 'Application has been rejected.',
			});
			fetchData();
		} catch (err) {
			toastApiError(err as never);
		}
	};

	const handleRecordResult = async () => {
		if (!selectedApp) return;
		try {
			await api.patch(`/applications/${selectedApp.id}/record-result`, {
				examScore: parseFloat(examScore),
				examResult,
				examNotes: 'Recorded from Early Registration portal',
			});

			if (examResult === 'PASSED') {
				await api.patch(`/applications/${selectedApp.id}/pass`);
			} else {
				await api.patch(`/applications/${selectedApp.id}/fail`);
			}

			sileo.success({
				title: 'Result Recorded',
				description: 'Applicant assessment result saved.',
			});
			setActionType(null);
			fetchData();
		} catch (err) {
			toastApiError(err as never);
		}
	};

	return (
		<div className='flex h-[calc(100vh-2rem)] overflow-hidden'>
			<div className='flex-1 flex flex-col space-y-4 sm:space-y-6 overflow-auto px-2 sm:px-0'>
				<div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div>
						<h1 className='text-3xl font-bold tracking-tight'>
							Early Registration Monitoring Dashboard
						</h1>
						<p className='font-bold'>Applicant screening and assessment workflow</p>
					</div>
				</div>

				<Card className='border-none shadow-sm bg-[hsl(var(--card))]'>
					<CardHeader className='px-3 sm:px-6 pb-3'>
						<div className='flex flex-col md:flex-row gap-3 md:gap-4 items-end'>
							<div className='flex-1 space-y-2 w-full'>
								<Label className='text-sm uppercase tracking-wider font-bold'>
									Search Applicant
								</Label>
								<div className='relative'>
									<Search className='absolute left-2.5 top-2.5 h-4 w-4' />
									<Input
										placeholder='LRN, First Name, Last Name...'
										className='pl-9 h-10 text-sm font-bold'
										value={search}
										onChange={(e) => setSearch(e.target.value)}
									/>
								</div>
							</div>
							<div className='grid grid-cols-2 md:flex gap-3 md:gap-4 w-full md:w-auto'>
								<div className='space-y-2'>
									<Label className='text-sm uppercase tracking-wider font-bold'>
										Application Status
									</Label>
									<Select
										value={status}
										onValueChange={setStatus}
									>
										<SelectTrigger className='h-10 md:w-48 text-sm font-bold'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem
												value='ALL'
												className='text-sm font-bold'
											>
												All Active Application
											</SelectItem>
											<SelectItem
												value='SUBMITTED'
												className='text-sm font-bold'
											>
												Submitted
											</SelectItem>
											<SelectItem
												value='UNDER_REVIEW'
												className='text-sm font-bold'
											>
												Under Review
											</SelectItem>
											<SelectItem
												value='FOR_REVISION'
												className='text-sm font-bold'
											>
												For Revision
											</SelectItem>
											<SelectItem
												value='ELIGIBLE'
												className='text-sm font-bold'
											>
												Eligible
											</SelectItem>
											<SelectItem
												value='ASSESSMENT_SCHEDULED'
												className='text-sm font-bold'
											>
												Exam Scheduled
											</SelectItem>
											<SelectItem
												value='ASSESSMENT_TAKEN'
												className='text-sm font-bold'
											>
												Exam Taken
											</SelectItem>

											<SelectItem
												value='NOT_QUALIFIED'
												className='text-sm font-bold'
											>
												Not Qualified
											</SelectItem>
											<SelectItem
												value='REJECTED'
												className='text-sm font-bold'
											>
												Rejected
											</SelectItem>
											<SelectItem
												value='WITHDRAWN'
												className='text-sm font-bold'
											>
												Withdrawn
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className='space-y-2'>
									<Label className='text-sm uppercase tracking-wider font-bold '>
										Type
									</Label>
									<Select
										value={type}
										onValueChange={setType}
									>
										<SelectTrigger className='h-10 md:w-48 text-sm font-bold'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{APPLICANT_TYPES.map((t) => (
												<SelectItem
													key={t.value}
													value={t.value}
													className='text-sm font-bold'
												>
													{t.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
							<Button
								variant='outline'
								className='h-10 px-3 w-full md:w-auto text-sm font-bold'
								onClick={() => {
									setSearch('');
									setStatus('ALL');
									setType('ALL');
								}}
							>
								Reset
							</Button>
						</div>
					</CardHeader>
					<CardContent className='px-3 sm:px-6'>
						<div className='rounded-xl border overflow-hidden'>
							<Table className='border-collapse'>
								<TableHeader className='bg-[hsl(var(--primary))]'>
									<TableRow>
										<TableHead className='text-center font-bold text-primary-foreground text-sm'>
											APPLICANT
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground hidden md:table-cell text-sm'>
											LRN
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground text-sm'>
											GRADE LEVEL
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground hidden lg:table-cell text-sm'>
											TYPE
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground text-sm'>
											STATUS
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground hidden xl:table-cell text-sm'>
											DATE
										</TableHead>
										<TableHead className='text-center font-bold text-primary-foreground text-sm'>
											ACTIONS
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{showSkeleton ? (
										Array.from({ length: 5 }).map((_, i) => (
											<TableRow key={i}>
												<TableCell className='text-sm'>
													<div className='space-y-2'>
														<Skeleton className='h-4 w-32' />
														<Skeleton className='h-3 w-24' />
													</div>
												</TableCell>
												<TableCell className='hidden md:table-cell text-sm'>
													<Skeleton className='h-4 w-24' />
												</TableCell>
												<TableCell className='text-sm'>
													<div className='space-y-2 text-center flex flex-col items-center'>
														<Skeleton className='h-4 w-16' />
														<Skeleton className='h-3 w-20' />
													</div>
												</TableCell>
												<TableCell className='hidden lg:table-cell text-sm'>
													<div className='flex justify-center'>
														<Skeleton className='h-4 w-16' />
													</div>
												</TableCell>
												<TableCell className='text-sm'>
													<div className='flex justify-center'>
														<Skeleton className='h-6 w-20 rounded-full' />
													</div>
												</TableCell>
												<TableCell className='hidden xl:table-cell text-sm'>
													<div className='flex justify-center'>
														<Skeleton className='h-4 w-24' />
													</div>
												</TableCell>
												<TableCell className='text-sm'>
													<div className='flex justify-center'>
														<Skeleton className='h-8 w-16' />
													</div>
												</TableCell>
											</TableRow>
										))
									) : applications.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={7}
												className='h-24 text-center text-sm '
											>
												No applicants found.
											</TableCell>
										</TableRow>
									) : (
										applications.map((app) => (
											<TableRow
												key={app.id}
												className={`hover:bg-[hsl(var(--muted))] transition-colors text-center cursor-pointer text-sm ${selectedId === app.id ? 'bg-[hsl(var(--muted))] shadow-inner' : ''}`}
												onClick={() => setSelectedId(app.id)}
											>
												<TableCell>
													<div className='flex flex-col text-left'>
														<span className='font-bold text-sm uppercase'>
															{app.lastName}, {app.firstName}
														</span>
														<span className='text-sm font-bold'>
															{app.trackingNumber}
														</span>
													</div>
												</TableCell>
												<TableCell className='hidden md:table-cell text-sm font-bold'>
													{app.lrn}
												</TableCell>
												<TableCell>
													<div className='flex flex-col'>
														<span className='font-bold text-sm'>
															Grade {app.gradeLevel.name}
														</span>
														{app.strand && (
															<span className=' text-sm'>
																{app.strand.name}
															</span>
														)}
													</div>
												</TableCell>
												<TableCell className='hidden lg:table-cell'>
													<Badge
														variant='outline'
														className='font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center'
													>
														{formatScpType(app.applicantType)}
													</Badge>
												</TableCell>
												<TableCell>
													<StatusBadge
														status={app.status}
														className='text-sm font-bold'
													/>
												</TableCell>
												<TableCell className=' text-sm hidden xl:table-cell font-bold'>
													{format(new Date(app.createdAt), 'MMMM dd, yyyy')}
												</TableCell>
												<TableCell className='text-center'>
													<Button
														variant='secondary'
														size='sm'
														className='h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground'
														onClick={(e) => {
															e.stopPropagation();
															setSelectedId(app.id);
														}}
													>
														<Eye className='h-3 w-3 mr-1' /> View
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</div>

						<div className='flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold'>
							<span className='text-xs '>
								Showing {applications.length} applicants
							</span>
							<div className='flex items-center gap-2'>
								<Button
									variant='outline'
									size='sm'
									className='h-9 sm:h-8 text-xs'
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page === 1}
								>
									Previous
								</Button>
								<Badge
									variant='secondary'
									className='px-3 h-8 text-xs'
								>
									Page {page}
								</Badge>
								<Button
									variant='outline'
									size='sm'
									className='h-9 sm:h-8 text-xs'
									onClick={() => setPage((p) => p + 1)}
									disabled={page * 50 >= total}
								>
									Next
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* TIER 1 - SLIDE-OVER PANEL */}
			<Sheet
				open={selectedId !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedId(null);
				}}
			>
				<SheetContent
					side='right'
					className='p-0 flex flex-row border-l overflow-visible w-screen sm:w-auto sm:max-w-none'
					style={
						typeof window !== 'undefined' && window.innerWidth >= 640
							? { width: `${panelPercentage}vw` }
							: undefined
					}
				>
					{/* Resize Handle — hidden on mobile */}
					<div
						onMouseDown={startResizing}
						className='absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group'
					>
						<div className='h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50' />
					</div>

					{selectedId && (
						<div className='flex-1 flex flex-col h-full overflow-hidden'>
							<ApplicationDetailPanel
								id={selectedId}
								onClose={() => setSelectedId(null)}
								onApprove={() => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setSelectedApp(app);
										setActionType('APPROVE');
										fetchSections(app.gradeLevelId);
									}
								}}
								onReject={() => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setSelectedApp(app);
										setActionType('REJECT');
									}
								}}
								onScheduleExam={async () => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setLoading(true);
										try {
											const fullRes = await api.get(
												`/applications/${selectedId}`,
											);
											setSelectedApp(fullRes.data);
											setIsScheduleDialogOpen(true);
										} catch (err) {
											toastApiError(err as never);
										} finally {
											setLoading(false);
										}
									}
								}}
								onRecordResult={() => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setSelectedApp(app);
										setActionType('RESULT');
									}
								}}
								onPass={async () => {
									try {
										await api.patch(`/applications/${selectedId}/pass`);
										sileo.success({
											title: 'Passed',
											description: 'Applicant marked as PASSED.',
										});
										fetchData();
									} catch (e) {
										toastApiError(e as never);
									}
								}}
								onFail={async () => {
									try {
										await api.patch(`/applications/${selectedId}/fail`);
										sileo.success({
											title: 'Failed',
											description: 'Applicant marked as FAILED.',
										});
										fetchData();
									} catch (e) {
										toastApiError(e as never);
									}
								}}
								onOfferRegular={() => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setSelectedApp(app);
										setActionType('APPROVE');
										fetchSections(app.gradeLevelId);
									}
								}}
								onTemporarilyEnroll={async () => {
									if (
										!confirm(
											'Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.',
										)
									)
										return;
									try {
										await api.patch(
											`/applications/${selectedId}/temporarily-enroll`,
										);
										sileo.success({
											title: 'Updated',
											description: 'Applicant is now temporarily enrolled.',
										});
										fetchData();
									} catch (e) {
										toastApiError(e as never);
									}
								}}
								onScheduleInterview={async () => {
									const app = applications.find((a) => a.id === selectedId);
									if (app) {
										setLoading(true);
										try {
											const fullRes = await api.get(
												`/applications/${selectedId}`,
											);
											setSelectedApp(fullRes.data);
											setIsInterviewDialogOpen(true);
										} catch (err) {
											toastApiError(err as never);
										} finally {
											setLoading(false);
										}
									}
								}}
							/>
						</div>
					)}
				</SheetContent>
			</Sheet>

			{/* Action Dialogs */}
			<Dialog
				open={actionType !== null}
				onOpenChange={(open) => !open && setActionType(null)}
			>
				<DialogContent className='sm:max-w-md'>
					<DialogHeader>
						<DialogTitle className='text-xs'>
							{actionType === 'APPROVE' && 'Approve & Pre-register'}
							{actionType === 'ELIGIBLE' && 'Mark as Eligible'}
							{actionType === 'REJECT' && 'Reject Application'}
							{actionType === 'RESULT' && 'Record Assessment Result'}
						</DialogTitle>
						<DialogDescription className='text-xs'>
							Candidate: {selectedApp?.lastName}, {selectedApp?.firstName}
						</DialogDescription>
					</DialogHeader>

					{actionType === 'ELIGIBLE' && (
						<div className='py-4'>
							<p className='text-xs'>
								Marking this applicant as{' '}
								<span className='font-bold text-cyan-700'>ELIGIBLE</span> means
								their documents are verified and they are cleared for assessment
								or direct pre-registration.
							</p>
						</div>
					)}

					{actionType === 'APPROVE' && (
						<div className='space-y-4 py-4'>
							<p className='text-xs text-emerald-700 font-medium'>
								This candidate will be moved to the Enrollment phase and
								assigned to a section.
							</p>
							<div className='space-y-2'>
								<Label className='text-xs'>
									Select Section for {selectedApp?.gradeLevel.name}
								</Label>
								<Select
									value={selectedSectionId}
									onValueChange={setSelectedSectionId}
								>
									<SelectTrigger className='text-xs'>
										<SelectValue placeholder='Choose a section...' />
									</SelectTrigger>
									<SelectContent>
										{sections.map((s) => (
											<SelectItem
												key={s.id}
												value={String(s.id)}
												disabled={s._count.enrollments >= s.maxCapacity}
												className='text-xs'
											>
												{s.name} ({s._count.enrollments}/{s.maxCapacity})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					)}

					{actionType === 'REJECT' && (
						<div className='space-y-4 py-4'>
							<div className='space-y-2'>
								<Label className='text-xs'>Reason for Rejection</Label>
								<textarea
									className='w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
									placeholder='Explain why this application is being rejected...'
									value={rejectionReason}
									onChange={(e) => setRejectionReason(e.target.value)}
								/>
							</div>
						</div>
					)}

					{actionType === 'RESULT' && (
						<div className='space-y-4 py-4'>
							<div className='space-y-2'>
								<Label className='text-xs'>Score / Rating</Label>
								<Input
									type='number'
									step='0.01'
									placeholder='e.g. 85.5'
									value={examScore}
									onChange={(e) => setExamScore(e.target.value)}
									className='text-xs'
								/>
							</div>
							<div className='space-y-2'>
								<Label className='text-xs'>Final Verdict</Label>
								<Select
									value={examResult}
									onValueChange={setExamResult}
								>
									<SelectTrigger className='text-xs'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem
											value='PASSED'
											className='text-xs'
										>
											PASSED - Qualifies for Program
										</SelectItem>
										<SelectItem
											value='FAILED'
											className='text-xs'
										>
											FAILED - Did not meet criteria
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant='outline'
							onClick={() => setActionType(null)}
							className='text-xs'
						>
							Cancel
						</Button>
						{actionType === 'ELIGIBLE' && (
							<Button
								className='bg-cyan-600 hover:bg-cyan-700 text-xs'
								onClick={handleMarkEligible}
							>
								Confirm Eligibility
							</Button>
						)}
						{actionType === 'APPROVE' && (
							<Button
								className='bg-emerald-600 hover:bg-emerald-700 text-xs'
								onClick={handleApprove}
								disabled={!selectedSectionId}
							>
								Confirm Pre-registration
							</Button>
						)}
						{actionType === 'REJECT' && (
							<Button
								variant='default'
								onClick={handleReject}
								disabled={!rejectionReason}
								className='text-xs'
							>
								Reject Application
							</Button>
						)}
						{actionType === 'RESULT' && (
							<Button
								onClick={handleRecordResult}
								className='text-xs'
							>
								Save Result
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<ScheduleExamDialog
				open={isScheduleDialogOpen}
				onOpenChange={isScheduleDialogOpen ? setIsScheduleDialogOpen : () => {}}
				applicant={selectedApp as ApplicantDetail | null}
				onSuccess={fetchData}
				onCloseSheet={() => setSelectedId(null)}
			/>
			<ScheduleInterviewDialog
				open={isInterviewDialogOpen}
				onOpenChange={setIsInterviewDialogOpen}
				applicant={selectedApp as ApplicantDetail | null}
				onSuccess={fetchData}
			/>
		</div>
	);
}
