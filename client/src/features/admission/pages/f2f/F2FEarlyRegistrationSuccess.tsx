import { useState } from 'react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import {
	CheckCircle2,
	Copy,
	Check,
	UserPlus,
	FileText,
	ClipboardList,
	ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/shared/lib/utils';
import { format } from 'date-fns';
import { useSettingsStore } from '@/store/settings.slice';

interface F2FEarlyRegistrationSuccessProps {
	trackingNumber: string;
	encodedBy: string;
	onNewApplication?: () => void;
}

export default function F2FEarlyRegistrationSuccess({
	trackingNumber,
	encodedBy,
	onNewApplication,
}: F2FEarlyRegistrationSuccessProps) {
	const [copied, setCopied] = useState(false);
	const navigate = useNavigate();
	const { colorScheme, selectedAccentHsl } = useSettingsStore();

	const accentHsl = selectedAccentHsl ?? colorScheme?.accent_hsl;
	const currentHex = colorScheme?.palette?.find(
		(p) => p.hsl === accentHsl,
	)?.hex;
	const isFefe01 = currentHex?.toLowerCase() === '#fefe01';

	// Check if color is "light" (uses black foreground)
	const accentForeground =
		colorScheme?.palette?.find((p) => p.hsl === accentHsl)?.foreground ??
		colorScheme?.accent_foreground;
	const isLightColor = accentForeground === '0 0% 0%';

	const applyOverride = isFefe01 || isLightColor;

	const handleCopy = () => {
		navigator.clipboard.writeText(trackingNumber);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div
			className='max-w-3xl mx-auto'
			style={
				applyOverride
					? ({
							'--primary': '200 68% 9%',
							'--primary-foreground': '0 0% 100%',
						} as React.CSSProperties)
					: {}
			}
		>
			<Card className='shadow-lg border-2 border-primary/20'>
				<CardHeader className='text-center pb-2'>
					<div className='flex justify-center mb-4'>
						<div className='p-4 rounded-full bg-primary/10'>
							<CheckCircle2 className='w-12 h-12 text-primary' />
						</div>
					</div>
					<CardTitle className='text-2xl font-bold'>
						F2F Application Submitted
					</CardTitle>
					<CardDescription className='text-lg'>
						Walk-in EARLY REGISTRATION has been successfully recorded.
					</CardDescription>
				</CardHeader>

				<CardContent className='space-y-6 pt-6'>
					{/* Tracking Number Display */}
					<div
						onClick={handleCopy}
						className={cn(
							'bg-muted p-8 rounded-2xl text-center space-y-3 border-2 border-dashed cursor-pointer transition-all duration-200 group relative overflow-hidden',
							copied
								? 'border-primary bg-primary/5'
								: 'border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5',
						)}
					>
						<p className='text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black'>
							Application Tracking Number
						</p>
						<div className='flex items-center justify-center gap-4'>
							<p className='text-4xl  font-black text-foreground tracking-tighter'>
								{trackingNumber}
							</p>
							<div
								className={cn(
									'p-2 rounded-lg transition-colors',
									copied
										? 'bg-primary text-primary-foreground'
										: 'bg-muted-foreground/10 group-hover:bg-primary/20',
								)}
							>
								{copied ? (
									<Check className='w-5 h-5' />
								) : (
									<Copy className='w-5 h-5' />
								)}
							</div>
						</div>
						<p
							className={cn(
								'text-xs font-bold transition-all duration-200',
								copied ? 'text-primary scale-110' : 'text-muted-foreground',
							)}
						>
							{copied ? 'COPIED TO CLIPBOARD!' : 'CLICK TO COPY'}
						</p>
					</div>

					{/* Encoder Info */}
					<div className='bg-muted/50 p-4 rounded-xl border border-border/50'>
						<div className='grid grid-cols-2 gap-4 text-sm'>
							<div>
								<p className='text-[10px] text-muted-foreground uppercase tracking-wide font-bold mb-1'>
									Encoded By
								</p>
								<p className='font-semibold'>{encodedBy}</p>
							</div>
							<div>
								<p className='text-[10px] text-muted-foreground uppercase tracking-wide font-bold mb-1'>
									Date & Time
								</p>
								<p className='font-semibold'>
									{format(new Date(), "MMM dd, yyyy 'at' h:mm a")}
								</p>
							</div>
						</div>
					</div>

					{/* Next Steps */}
					<div className='space-y-4'>
						<h3 className='font-semibold text-lg flex items-center gap-2'>
							<FileText className='w-5 h-5' />
							What's Next
						</h3>
						<ul className='space-y-3 text-sm list-decimal pl-5'>
							<li>
								<strong>Provide tracking number:</strong> Give the applicant
								their tracking number for monitoring.
							</li>
							<li>
								<strong>Document submission:</strong> Collect and verify
								original documents (PSA Birth Certificate, SF9).
							</li>
							<li>
								<strong>Application review:</strong> The application is now in
								the queue for registrar review.
							</li>
							<li>
								<strong>SCP applicants:</strong> Schedule entrance exam/audition
								if applicable.
							</li>
						</ul>
					</div>

					{/* Action Buttons */}
					<div className='flex flex-col md:flex-row gap-4 pt-6 border-t border-border/50'>
						<Button
							variant='outline'
							className='flex-1 gap-2 h-12 font-bold'
							onClick={() => navigate('/applications')}
						>
							<ClipboardList className='w-4 h-4' />
							View Applications
						</Button>
						<Button
							className='flex-1 gap-2 h-12 font-bold bg-primary text-primary-foreground hover:opacity-90'
							onClick={onNewApplication}
						>
							<UserPlus className='w-4 h-4' />
							New Walk-in Application
							<ArrowRight className='w-4 h-4' />
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
