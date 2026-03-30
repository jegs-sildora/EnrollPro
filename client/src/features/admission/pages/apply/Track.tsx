import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import {
	Search,
	Loader2,
	CheckCircle2,
	Clock,
	AlertCircle,
	FileText,
	Calendar,
	User,
	BookOpen,
	Download,
	MapPin,
	ClipboardList,
} from 'lucide-react';
import api from '@/shared/api/axiosInstance';
import { cn, formatManilaDate, getManilaNow } from '@/shared/lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '@/store/settings.slice';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const API_BASE =
	import.meta.env.VITE_API_URL?.replace('/api', '') ||
	'http://192.168.254.106:3001';
const trackSchema = z.object({
	trackingNumber: z
		.string()
		.min(1, 'Tracking number is required')
		.regex(
			/^APP-\d{4}-\d{5}$/,
			'Invalid tracking number format (e.g. APP-2026-00000)',
		),
});

type TrackFormData = z.infer<typeof trackSchema>;

interface ApplicationStatus {
	trackingNumber: string;
	firstName: string;
	middleName?: string;
	lastName: string;
	status: string;
	applicantType: string;
	createdAt: string;
	gradeLevel: { name: string };
	strand?: { name: string };
	enrollment?: { section: { name: string }; enrolledAt: string };
	assessments?: {
		type: string;
		scheduledDate?: string;
		scheduledTime?: string;
		venue?: string;
		notes?: string;
	}[];
	rejectionReason?: string;
	scpDetail?: { scpType: string };
}

const statusConfig: Record<
	string,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
		color: string;
		desc: string;
	}
> = {
	SUBMITTED: {
		label: 'Submitted',
		icon: Clock,
		color: 'text-slate-600 bg-slate-50 border-slate-200',
		desc: 'Your application has been received and is waiting for initial review.',
	},
	UNDER_REVIEW: {
		label: 'Under Review',
		icon: Search,
		color: 'text-blue-600 bg-blue-50 border-blue-200',
		desc: 'The Registrar is currently verifying your documents and information.',
	},
	FOR_REVISION: {
		label: 'For Revision',
		icon: AlertCircle,
		color: 'text-orange-600 bg-orange-50 border-orange-200',
		desc: 'A fixable issue was found. Please follow the instructions sent to your email to correct your application.',
	},
	ELIGIBLE: {
		label: 'Eligible',
		icon: CheckCircle2,
		color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
		desc: 'Basic screening is complete. You are cleared for the next step.',
	},
	EXAM_SCHEDULED: {
		label: 'Exam Scheduled',
		icon: Calendar,
		color: 'text-amber-600 bg-amber-50 border-amber-200',
		desc: 'An entrance exam has been scheduled for you. Please check the details below.',
	},
	ASSESSMENT_SCHEDULED: {
		label: 'Interview Scheduled',
		icon: Calendar,
		color: 'text-amber-600 bg-amber-50 border-amber-200',
		desc: 'A follow-up interview has been scheduled for you. Please check the details below.',
	},
	ASSESSMENT_TAKEN: {
		label: 'Assessment Taken',
		icon: CheckCircle2,
		color: 'text-purple-600 bg-purple-50 border-purple-200',
		desc: 'You have completed the assessment. We are now processing your results.',
	},
	PASSED: {
		label: 'Passed',
		icon: CheckCircle2,
		color: 'text-green-600 bg-green-50 border-green-200',
		desc: 'Congratulations! You have passed the program assessment and are cleared for pre-registration.',
	},
	PRE_REGISTERED: {
		label: 'Approved',
		icon: CheckCircle2,
		color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
		desc: 'Congratulations! Your application is approved. You are now officially admitted and assigned to a section.',
	},
	TEMPORARILY_ENROLLED: {
		label: 'Temporarily Enrolled',
		icon: Clock,
		color: 'text-blue-600 bg-blue-50 border-blue-200',
		desc: 'You are allowed to attend classes while your remaining documents are being completed.',
	},
	ENROLLED: {
		label: 'Enrolled',
		icon: CheckCircle2,
		color: 'text-green-700 bg-green-100 border-green-300',
		desc: 'Welcome! You are now an officially enrolled student for this School Year.',
	},
	NOT_QUALIFIED: {
		label: 'Not Qualified',
		icon: AlertCircle,
		color: 'text-amber-600 bg-amber-50 border-amber-200',
		desc: 'You did not meet the specialized program criteria. The Registrar may offer a regular section if available.',
	},
	REJECTED: {
		label: 'Rejected',
		icon: AlertCircle,
		color: 'text-red-600 bg-red-50 border-red-200',
		desc: 'Your application was not accepted due to eligibility or data integrity issues.',
	},
	WITHDRAWN: {
		label: 'Withdrawn',
		icon: AlertCircle,
		color: 'text-zinc-400 bg-zinc-50 border-zinc-200',
		desc: 'This application has been voluntarily withdrawn.',
	},
};

const SCP_LABELS: Record<string, string> = {
	SCIENCE_TECHNOLOGY_AND_ENGINEERING: 'Science, Technology & Engineering',
	SPECIAL_PROGRAM_IN_THE_ARTS: 'Special Program in the Arts',
	SPECIAL_PROGRAM_IN_SPORTS: 'Special Program in Sports',
	SPECIAL_PROGRAM_IN_JOURNALISM: 'Special Program in Journalism',
	SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: 'Special Program in Foreign Language',
	SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
		'Special Program in Tech-Voc Education',
	STEM_GRADE_11: 'STEM (Grade 11)',
};

interface TrackApplicationProps {
	onResultsFetched?: (hasResults: boolean) => void;
}

export default function TrackApplication({
	onResultsFetched,
}: TrackApplicationProps) {
	const { schoolName, logoUrl } = useSettingsStore();
	const [status, setStatus] = useState<ApplicationStatus | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState('');
	const pdfRef = useRef<HTMLDivElement>(null);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<TrackFormData>({
		resolver: zodResolver(trackSchema),
	});

	const downloadPDF = async () => {
		if (!pdfRef.current || !status) return;
		setIsGenerating(true);

		try {
			const element = pdfRef.current;
			element.style.visibility = 'visible';
			element.style.position = 'fixed';
			element.style.left = '-9999px';
			element.style.top = '0';
			element.style.height = 'auto';
			element.style.overflow = 'visible';

			await new Promise((resolve) => setTimeout(resolve, 800));

			const canvas = await html2canvas(element, {
				scale: 2,
				useCORS: true,
				allowTaint: true,
				logging: false,
				backgroundColor: '#ffffff',
				windowWidth: 800,
			});

			const imgData = canvas.toDataURL('image/jpeg', 0.98);
			const imgWidth = 595.28;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;

			const pdf = new jsPDF({
				orientation: 'portrait',
				unit: 'pt',
				format: 'a4',
			});

			pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
			pdf.save(`Early_Registration_Confirmation_${status.trackingNumber}.pdf`);

			element.style.visibility = 'hidden';
			element.style.position = 'fixed';
			element.style.height = '0';
			element.style.overflow = 'hidden';
		} catch (error) {
			console.error('PDF Generation failed:', error);
			alert('Failed to generate PDF. Please try again.');
		} finally {
			setIsGenerating(false);
		}
	};

	const onTrack = async (data: TrackFormData) => {
		setIsLoading(true);
		setError('');
		setStatus(null);
		onResultsFetched?.(false);

		try {
			// Small delay for professional feel
			await new Promise((resolve) => setTimeout(resolve, 500));
			const response = await api.get(
				`/applications/track/${data.trackingNumber}`,
			);
			setStatus(response.data);
			onResultsFetched?.(true);
		} catch (err: unknown) {
			const message =
				(err as { response?: { data?: { message?: string } } })?.response?.data
					?.message ||
				'Could not find an application with that tracking number.';
			setError(message);
			onResultsFetched?.(false);
		} finally {
			setIsLoading(false);
		}
	};

	const config = status
		? statusConfig[status.status] || statusConfig.SUBMITTED
		: null;
	const Icon = config?.icon;

	const isScpApplication = status
		? status.applicantType !== 'REGULAR' || !!status.scpDetail
		: false;
	const scpType = status?.scpDetail?.scpType ?? status?.applicantType;
	const latestAssessment = status?.assessments?.[0] ?? null;
	const examDate = latestAssessment?.scheduledDate ?? null;
	const examTime = latestAssessment?.scheduledTime ?? null;
	const examVenue = latestAssessment?.venue ?? null;
	const examNotes = latestAssessment?.notes ?? null;

	return (
		<div
			className={cn('max-w-4xl mx-auto p-4 md:p-8 transition-all duration-500')}
		>
			<Card
				className={cn(
					'shadow-xl border-2 border-primary/5 rounded-3xl overflow-hidden transition-all duration-500 w-full',
				)}
			>
				<CardHeader className='bg-primary text-primary-foreground p-8 text-center'>
					<CardTitle className='text-2xl font-black uppercase tracking-tight'>
						Application Monitor
					</CardTitle>
					<CardDescription className='text-primary-foreground/90 font-bold'>
						Enter your tracking number to check your status
					</CardDescription>
				</CardHeader>
				<CardContent className='p-8'>
					<form
						onSubmit={handleSubmit(onTrack)}
						className='space-y-6'
					>
						<div className='space-y-2'>
							<Label
								htmlFor='trackingNumber'
								className='text-xs font-black uppercase tracking-widest text-muted-foreground'
							>
								Tracking Number
							</Label>
							<div className='relative'>
								<Input
									id='trackingNumber'
									{...register('trackingNumber')}
									placeholder='APP-2026-XXXXX'
									className={cn(
										'h-14 pl-12 text-lg font-black border-2 transition-all',
										errors.trackingNumber
											? 'border-primary focus-visible:ring-primary'
											: 'border-primary/10 focus-visible:border-primary focus-visible:ring-primary/5',
									)}
									autoComplete='off'
								/>
								<Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground' />
							</div>
							{errors.trackingNumber && (
								<p className='text-xs text-primary font-bold'>
									{errors.trackingNumber.message}
								</p>
							)}
						</div>

						<Button
							type='submit'
							className='w-full h-14 text-lg font-black uppercase tracking-widest bg-primary hover:bg-primary/90 transition-all text-primary-foreground'
							disabled={isLoading}
						>
							{isLoading ? 'Searching...' : 'Check Status'}
						</Button>
					</form>

					{!status && !error && (
						<div className='mt-8 pt-6 border-t border-dashed text-center'>
							<p className='text-md font-bold text-muted-foreground uppercase tracking-widest'>
								Lost or missing confirmation slip?
							</p>
							<p className='text-xs text-muted-foreground/60 mt-1 uppercase font-bold'>
								Enter your tracking number above to retrieve and download your
								official slip.
							</p>
						</div>
					)}

					<AnimatePresence mode='wait'>
						{error && (
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								className='mt-8 p-6 bg-primary/5 border-2 border-primary/20 rounded-2xl flex items-start gap-4'
							>
								<AlertCircle className='w-6 h-6 text-primary shrink-0 mt-0.5' />
								<div>
									<h4 className='font-black text-primary uppercase tracking-tight'>
										Application Not Found
									</h4>
									<p className='text-sm font-bold text-primary/80 mt-1'>
										{error}
									</p>
								</div>
							</motion.div>
						)}

						{status && config && (
							<motion.div
								initial={{ opacity: 0, scale: 0.95 }}
								animate={{ opacity: 1, scale: 1 }}
								className='mt-10 space-y-8'
							>
								<div
									className={cn(
										'p-8 rounded-3xl border-2 flex flex-col items-center text-center gap-4',
										config.color,
									)}
								>
									<div className='p-4 rounded-full bg-white shadow-sm border border-current/20'>
										{Icon && <Icon className='w-10 h-10' />}
									</div>
									<div>
										<h3 className='text-xs font-black uppercase tracking-[0.2em] opacity-70'>
											Current Status
										</h3>
										<p className='text-3xl font-black uppercase tracking-tight mt-1'>
											{config.label}
										</p>
									</div>
									<p className='text-sm font-bold leading-relaxed max-w-sm opacity-90'>
										{config.desc}
									</p>
								</div>

								<div
									className={cn(
										'grid gap-4 text-center',
										isScpApplication
											? 'grid-cols-1 md:grid-cols-3'
											: 'grid-cols-1 md:grid-cols-2',
									)}
								>
									<div className='p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1'>
										<p className='text-[0.625rem] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-center gap-1.5'>
											<User className='w-3 h-3' /> Applicant Name
										</p>
										<p className='font-black text-primary uppercase'>
											{status.lastName}, {status.firstName}{' '}
											{status.middleName || ''}
										</p>
									</div>
									<div className='p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1'>
										<p className='text-[0.625rem] font-black uppercase text-muted-foreground tracking-widest flex items-center justify-center gap-1.5'>
											<FileText className='w-3 h-3' /> Grade Level
										</p>
										<p className='font-black text-primary uppercase'>
											{status.gradeLevel.name}
										</p>
									</div>

									{isScpApplication && (
										<div className='p-5 bg-primary/5 border border-primary/10 rounded-2xl space-y-1'>
											<p className='text-[0.625rem] font-black uppercase text-primary/60 tracking-widest flex items-center justify-center gap-1.5'>
												<BookOpen className='w-3 h-3' /> SCP Program
											</p>
											<p className='font-black text-primary uppercase'>
												{scpType
													? SCP_LABELS[scpType] || scpType
													: 'Special Program'}
											</p>
										</div>
									)}

									{(status.status === 'EXAM_SCHEDULED' ||
										status.status === 'ASSESSMENT_SCHEDULED') &&
										examDate && (
											<>
												<div className='p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1'>
													<p className='text-[0.625rem] font-black uppercase text-purple-600 tracking-widest flex items-center justify-center gap-1.5'>
														<Calendar className='w-3 h-3' /> Scheduled Date
													</p>
													<p className='font-black text-purple-900 uppercase'>
														{format(new Date(examDate), 'MMMM dd, yyyy')}
													</p>
													<p className='text-[0.625rem] font-bold text-purple-700/70 uppercase'>
														{examTime
															? new Date(
																	`2000-01-01T${examTime}`,
																).toLocaleTimeString('en-US', {
																	hour: 'numeric',
																	minute: '2-digit',
																	hour12: true,
																})
															: format(new Date(examDate), 'hh:mm a')}
													</p>
												</div>
												<div className='p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1'>
													<p className='text-[0.625rem] font-black uppercase text-purple-600 tracking-widest flex items-center justify-center gap-1.5'>
														<MapPin className='w-3 h-3' /> Exam Location
													</p>
													<p className='font-black text-purple-900 uppercase'>
														{examVenue || 'TO BE ANNOUNCED'}
													</p>
												</div>
												<div className='p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-1'>
													<p className='text-[0.625rem] font-black uppercase text-purple-600 tracking-widest flex items-center justify-center gap-1.5'>
														<ClipboardList className='w-3 h-3' /> Additional
														Notes
													</p>
													<p className='font-bold text-purple-900/80 text-[0.625rem] uppercase italic leading-tight line-clamp-2'>
														{examNotes || 'No special instructions'}
													</p>
												</div>
											</>
										)}

									{status.status === 'FOR_REVISION' &&
										status.rejectionReason && (
											<div
												className={cn(
													'p-5 bg-primary/5 border border-primary/20 rounded-2xl space-y-1',
													isScpApplication ? 'md:col-span-3' : 'md:col-span-2',
												)}
											>
												<p className='text-[0.625rem] font-black uppercase text-primary tracking-widest flex items-center justify-center gap-1.5'>
													<AlertCircle className='w-3 h-3' /> Revision Details
												</p>
												<p className='font-bold text-primary/90 italic'>
													"{status.rejectionReason}"
												</p>
											</div>
										)}

									<div
										className={cn(
											'p-5 bg-white border border-border rounded-2xl space-y-1 text-center',
											isScpApplication ? 'md:col-span-3' : 'md:col-span-2',
										)}
									>
										<p className='text-[0.625rem] font-black uppercase text-muted-foreground tracking-widest'>
											Date Submitted
										</p>
										<p className='text-xs font-bold text-muted-foreground'>
											{format(new Date(status.createdAt), 'MMMM dd, yyyy')}
										</p>
									</div>
								</div>

								<div className='flex flex-col items-center justify-center '>
									<div className='mt-8 pt-6 border-t border-dashed text-center'>
										<p className='text-md font-bold text-muted-foreground uppercase tracking-widest'>
											Lost or missing confirmation slip?
										</p>
										<p className='text-xs text-muted-foreground/60 mt-1 uppercase font-bold'>
											Enter your tracking number above to retrieve and download
											your official slip.
										</p>
									</div>
									<div className='flex items-center justify-center mt-6'>
										<Button
											className='h-12 px-8 font-bold w-full sm:w-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90'
											onClick={downloadPDF}
											disabled={isGenerating}
										>
											{isGenerating ? (
												<Loader2 className='w-4 h-4 animate-spin' />
											) : (
												<Download className='w-4 h-4' />
											)}
											{isGenerating
												? 'Generating PDF...'
												: 'Retrieve Confirmation Slip (PDF)'}
										</Button>
									</div>
								</div>

								<div className='pt-4 text-center'>
									<p className='text-[0.6875rem] font-bold text-muted-foreground/60 uppercase tracking-widest'>
										Last updated: {format(new Date(), 'hh:mm a')}
									</p>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					{/* ── PDF Container (Hidden) ── */}
					{status && (
						<div
							ref={pdfRef}
							style={{
								visibility: 'hidden',
								position: 'fixed',
								left: '-9999px',
								top: '0',
								width: '800px',
								height: '0',
								overflow: 'hidden',
								padding: '60px',
								backgroundColor: '#ffffff',
								color: '#061E29',
								pointerEvents: 'none',
							}}
							className='font-sans'
						>
							<div
								style={{ borderColor: '#061E29' }}
								className='flex flex-col items-center justify-center gap-6 mb-4 border-b-2 pb-10'
							>
								<div className='flex items-center justify-center gap-10 w-full'>
									{logoUrl ? (
										<img
											src={`${API_BASE}${logoUrl}`}
											crossOrigin='anonymous'
											alt='School Logo'
											className='h-28 w-28 object-contain'
										/>
									) : (
										<div
											style={{ backgroundColor: '#f3f4f6' }}
											className='h-28 w-28 rounded-full flex items-center justify-center font-bold text-4xl text-[#061E29]'
										>
											{schoolName?.charAt(0)}
										</div>
									)}
									<div className='text-center flex-1'>
										<h1
											style={{ color: '#061E29' }}
											className='text-3xl font-black uppercase tracking-tight mb-1'
										>
											{schoolName}
										</h1>
										<p
											style={{ color: '#4b5563' }}
											className='text-base font-bold uppercase tracking-[0.2em] mb-2'
										>
											Early Registration Portal
										</p>
										<div
											style={{ backgroundColor: '#061E29', color: '#ffffff' }}
											className='flex items-center justify-center px-6 py-3 rounded-xl text-xs font-black tracking-widest uppercase text-center'
										>
											<p className='-mt-3'>
												Official EARLY REGISTRATION Confirmation Slip
											</p>
										</div>
									</div>
								</div>
							</div>

							<div className='space-y-6'>
								<div className='text-center space-y-4'>
									<h2
										style={{ color: '#061E29' }}
										className='text-4xl font-black tracking-tight'
									>
										Application Received!
									</h2>
									<p
										style={{ color: '#4b5563' }}
										className='text-xl font-medium'
									>
										Your application has been successfully submitted to{' '}
										<span
											style={{ color: '#061E29' }}
											className='font-bold'
										>
											{schoolName}
										</span>
										.
									</p>
								</div>

								<div
									style={{ backgroundColor: '#f9fafb', borderColor: '#061E29' }}
									className='p-12 rounded-3xl border-4 text-center space-y-6 relative overflow-hidden border-dashed'
								>
									<p
										style={{ color: '#6b7280' }}
										className='text-xs uppercase tracking-[0.3em] font-black'
									>
										Application Tracking Number
									</p>
									<p
										style={{ color: '#061E29' }}
										className='text-7xl  font-black tracking-tighter'
									>
										{status.trackingNumber}
									</p>

									<div className='pt-6 flex justify-center gap-12 text-center'>
										<div className='space-y-1'>
											<p
												style={{ color: '#9ca3af' }}
												className='text-[0.625rem] font-black uppercase'
											>
												Date Generated
											</p>
											<p
												style={{ color: '#061E29' }}
												className='text-sm font-bold'
											>
												{formatManilaDate(getManilaNow(), {
													year: 'numeric',
													month: 'long',
													day: 'numeric',
												})}
											</p>
										</div>
										<div className='space-y-1'>
											<p
												style={{ color: '#9ca3af' }}
												className='text-[0.625rem] font-black uppercase'
											>
												Time Generated
											</p>
											<p
												style={{ color: '#061E29' }}
												className='text-sm font-bold'
											>
												{formatManilaDate(getManilaNow(), {
													hour: '2-digit',
													minute: '2-digit',
												})}
											</p>
										</div>
									</div>
								</div>

								<div
									style={{ borderColor: '#f3f4f6' }}
									className='space-y-8 bg-white p-8 border-2 rounded-3xl'
								>
									<h3
										style={{ color: '#061E29' }}
										className='text-2xl font-black flex items-center gap-3 uppercase tracking-tight -mt-3'
									>
										Important Next Steps
									</h3>
									<div className='grid grid-cols-1 gap-6 text-sm'>
										{[
											{
												title: 'Check your email',
												desc: 'A confirmation has been sent to your primary contact email.',
											},
											{
												title: 'Wait for verification',
												desc: 'Our Registrar will review your documents within 3-5 working days.',
											},
											{
												title: 'Prepare original documents',
												desc: 'Submit PSA Birth Certificate and SF9 (Report Card) upon request.',
											},
											{
												title: 'Monitor Portal',
												desc: 'Use your tracking number to check the status of your application.',
											},
										].map((step, i) => (
											<div
												key={i}
												className='flex gap-4 items-start'
											>
												<div
													style={{ backgroundColor: '#061E29' }}
													className='w-2 h-2 rounded-full mt-3 shrink-0'
												/>
												<div>
													<p
														style={{ color: '#061E29' }}
														className='font-black uppercase tracking-wide'
													>
														{step.title}
													</p>
													<p
														style={{ color: '#4b5563' }}
														className='font-medium'
													>
														{step.desc}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>

								<div
									style={{ borderColor: '#061E29' }}
									className='border-t-4 pt-12 mt-12 flex justify-between items-end'
								>
									<div className='space-y-2'>
										<p
											style={{ color: '#9ca3af' }}
											className='text-[0.625rem] font-black uppercase tracking-widest'
										>
											Security Validation
										</p>
										<div
											style={{ backgroundColor: '#061E29', color: '#ffffff' }}
											className='px-4 py-2  text-xs font-bold'
										>
											VALID_AUTHENTIC_SUBMISSION_
											{status.trackingNumber.replace(/-/g, '_')}
										</div>
									</div>
									<div className='text-right space-y-1'>
										<p
											style={{ color: '#061E29' }}
											className='font-black uppercase tracking-tight text-lg leading-none'
										>
											EnrollPro Management System
										</p>
										<p
											style={{ color: '#9ca3af' }}
											className='text-[0.625rem] font-bold'
										>
											This document is electronically generated. No physical
											signature required.
										</p>
									</div>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
