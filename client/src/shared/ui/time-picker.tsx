import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';

interface TimePickerProps {
	value?: string | null; // format "HH:mm" (24h)
	onChange: (value: string) => void;
	className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
	// Internal state for 12h format
	const [hour, setHour] = React.useState('08');
	const [minute, setMinute] = React.useState('00');
	const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM');

	// Sync internal state with external value
	React.useEffect(() => {
		if (value && value.includes(':')) {
			const [h24, m] = value.split(':');
			const hInt = parseInt(h24);
			const p = hInt >= 12 ? 'PM' : 'AM';

			// Convert to 12h
			let h12 = hInt % 12;
			if (h12 === 0) h12 = 12;

			setHour(h12.toString().padStart(2, '0'));
			setMinute(m.padStart(2, '0'));
			setPeriod(p);
		} else {
			setHour('');
			setMinute('');
			setPeriod('AM');
		}
	}, [value]);

	const updateValue = (h: string, m: string, p: 'AM' | 'PM') => {
		let hInt = parseInt(h);
		if (p === 'PM' && hInt < 12) hInt += 12;
		if (p === 'AM' && hInt === 12) hInt = 0;

		const h24 = hInt.toString().padStart(2, '0');
		const mStr = m.padStart(2, '0');
		onChange(`${h24}:${mStr}`);
	};

	const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = e.target.value.replace(/\D/g, '');
		if (val.length > 2) val = val.slice(-2);

		if (val === '') {
			setHour('');
			return;
		}

		let h = parseInt(val);
		if (h > 12) h = 12;
		// Allow '0' to be typed so user can type '08', etc.
		setHour(val);

		if (h >= 1 && h <= 12) {
			updateValue(h.toString().padStart(2, '0'), minute, period);
		}
	};

	const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let val = e.target.value.replace(/\D/g, '');
		if (val.length > 2) val = val.slice(-2);

		if (val === '') {
			setMinute('');
			return;
		}

		let m = parseInt(val);
		if (m > 59) m = 59;
		setMinute(val);

		if (val.length <= 2) {
			updateValue(hour, m.toString().padStart(2, '0'), period);
		}
	};

	const handlePeriodChange = (p: 'AM' | 'PM') => {
		setPeriod(p);
		updateValue(hour, minute, p);
	};

	return (
		<div className={cn('flex items-center gap-2', className)}>
			<div className='flex items-center rounded-md border border-input bg-background px-2 py-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'>
				<Clock className='mr-2 h-3 w-3 text-muted-foreground' />
				<input
					className='w-6 border-none bg-transparent p-0 text-center text-xs font-medium focus:outline-none'
					value={hour}
					onChange={handleHourChange}
					onBlur={() => setHour(hour.padStart(2, '0'))}
					placeholder='HH'
				/>
				<span className='text-muted-foreground mx-0.5'>:</span>
				<input
					className='w-6 border-none bg-transparent p-0 text-center text-xs font-medium focus:outline-none'
					value={minute}
					onChange={handleMinuteChange}
					onBlur={() => setMinute(minute.padStart(2, '0'))}
					placeholder='MM'
				/>
			</div>
			<Select
				value={period}
				onValueChange={(v: string) => handlePeriodChange(v as 'AM' | 'PM')}
			>
				<SelectTrigger className='h-8 w-[65px] text-[10px] font-bold'>
					<SelectValue placeholder='AM/PM' />
				</SelectTrigger>
				<SelectContent>
					<SelectItem
						value='AM'
						className='text-xs'
					>
						AM
					</SelectItem>
					<SelectItem
						value='PM'
						className='text-xs'
					>
						PM
					</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
