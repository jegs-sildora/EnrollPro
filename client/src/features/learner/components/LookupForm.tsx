import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from '@/shared/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { AlertCircle } from 'lucide-react';
import depedLogo from '@/assets/DepEd-logo.png';

interface LookupFormProps {
	onLookup: (lrn: string, birthDate: string, pin: string) => Promise<void>;
	loading: boolean;
	error: string | null;
}

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

export function LookupForm({ onLookup, loading, error }: LookupFormProps) {
	const [lrn, setLrn] = useState('');
	const [pin, setPin] = useState('');
	const [month, setMonth] = useState('');
	const [day, setDay] = useState('');
	const [year, setYear] = useState('');

	const currentYear = new Date().getFullYear();
	const years = Array.from({ length: 50 }, (_, i) =>
		String(currentYear - 3 - i),
	);
	const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!lrn || !month || !day || !year || !pin) return;

		// Format date as YYYY-MM-DD
		const monthIdx = MONTHS.indexOf(month) + 1;
		const formattedDate = `${year}-${String(monthIdx).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

		onLookup(lrn, formattedDate, pin);
	};

	const isFormValid =
		lrn.length === 12 && pin.length === 6 && month && day && year;

	return (
		<Card className='w-full max-w-md mx-auto shadow-lg border-primary/10'>
			<CardHeader className='text-center pb-2'>
				<div className='flex justify-center mb-4'>
					<img
						src={depedLogo}
						alt='DepEd Logo'
						className='h-20 w-auto object-contain'
					/>
				</div>
				<CardTitle className='text-2xl font-bold tracking-tight'>
					View Your School Records
				</CardTitle>
				<CardDescription className='text-sm'>
					Enter your details below to access your SIMS record and health
					monitoring (SF8).
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					onSubmit={handleSubmit}
					className='space-y-5'
				>
					{error && (
						<Alert
							variant='destructive'
							className='py-3'
						>
							<AlertCircle className='h-4 w-4' />
							<AlertDescription className='text-xs font-medium'>
								{error}
							</AlertDescription>
						</Alert>
					)}

					<div className='space-y-2'>
						<Label
							htmlFor='lrn'
							className='text-xs font-bold uppercase tracking-wider text-muted-foreground'
						>
							Learner Reference Number (LRN) *
						</Label>
						<Input
							id='lrn'
							placeholder='12-digit LRN'
							className='h-11 text-lg tracking-[0.2em] font-mono text-center'
							value={lrn}
							onChange={(e) =>
								setLrn(e.target.value.replace(/\D/g, '').slice(0, 12))
							}
							maxLength={12}
							required
						/>
					</div>

					<div className='space-y-2'>
						<Label className='text-xs font-bold uppercase tracking-wider text-muted-foreground'>
							Date of Birth *
						</Label>
						<div className='grid grid-cols-3 gap-2'>
							<Select
								value={month}
								onValueChange={setMonth}
							>
								<SelectTrigger className='h-11'>
									<SelectValue placeholder='Month' />
								</SelectTrigger>
								<SelectContent>
									{MONTHS.map((m) => (
										<SelectItem
											key={m}
											value={m}
										>
											{m}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={day}
								onValueChange={setDay}
							>
								<SelectTrigger className='h-11'>
									<SelectValue placeholder='Day' />
								</SelectTrigger>
								<SelectContent>
									{days.map((d) => (
										<SelectItem
											key={d}
											value={d}
										>
											{d}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							<Select
								value={year}
								onValueChange={setYear}
							>
								<SelectTrigger className='h-11'>
									<SelectValue placeholder='Year' />
								</SelectTrigger>
								<SelectContent>
									{years.map((y) => (
										<SelectItem
											key={y}
											value={y}
										>
											{y}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className='space-y-2'>
						<Label
							htmlFor='pin'
							className='text-xs font-bold uppercase tracking-wider text-muted-foreground'
						>
							Portal PIN *
						</Label>
						<Input
							id='pin'
							type='password'
							placeholder='6-digit PIN'
							className='h-11 text-center text-lg tracking-[0.5em]'
							value={pin}
							onChange={(e) =>
								setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
							}
							maxLength={6}
							required
						/>
						<p className='text-[10px] text-muted-foreground text-center'>
							(Found on your official enrollment confirmation slip)
						</p>
					</div>

					<Button
						type='submit'
						className='w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 transition-all'
						disabled={!isFormValid || loading}
					>
						{loading ? 'Verifying Identity...' : 'View My Records →'}
					</Button>

					<div className='text-center pt-2 border-t'>
						<button
							type='button'
							className='text-[10px] text-muted-foreground hover:text-primary transition-colors underline'
							onClick={() =>
								alert(
									'Please visit the school registrar in person with a valid ID or birth certificate to reset your PIN.',
								)
							}
						>
							Forgot PIN? Contact the school registrar.
						</button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
