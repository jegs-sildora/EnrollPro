import { useFormContext } from 'react-hook-form';
import type { EarlyRegistrationFormData } from '../types';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import { DatePicker } from '@/shared/ui/date-picker';
import { Info, AlertCircle, Camera, X } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';

export default function Step1Personal() {
	const {
		register,
		watch,
		setValue,
		formState: { errors },
	} = useFormContext<EarlyRegistrationFormData>();
	const birthdate = watch('birthdate');
	const studentPhoto = watch('studentPhoto');

	const onBirthdateChange = (date: Date | undefined) => {
		if (date) {
			setValue('birthdate', date);
			const age = differenceInYears(new Date(), date);
			setValue('age', age);
		}
	};

	const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validation: 2MB limit
		if (file.size > 5 * 1024 * 1024) {
			alert('File size must be less than 5MB');
			return;
		}

		// Validation: JPG/PNG only
		if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
			alert('Only JPG and PNG files are accepted');
			return;
		}

		const reader = new FileReader();
		reader.onloadend = () => {
			setValue('studentPhoto', reader.result as string);
		};
		reader.readAsDataURL(file);
	};

	const clearPhoto = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setValue('studentPhoto', undefined);
	};

	return (
		<div className='space-y-8'>
			{/* ─── Name & Photo Section ─── */}
			<div className='grid grid-cols-1 md:grid-cols-4 gap-6 items-start'>
				{/* PHOTO UPLOADER COLUMN */}
				<div className='md:col-span-1 flex flex-col items-center justify-center space-y-3'>
					<Label className='text-sm font-semibold self-start md:self-center'>
						Student Photo
					</Label>
					<div className='relative group'>
						<div
							className={cn(
								'w-32 h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all duration-200',
								studentPhoto
									? 'border-primary/50 bg-background'
									: 'border-muted-foreground/30 bg-muted/50 hover:border-primary/50 hover:bg-muted/80',
							)}
						>
							{studentPhoto ? (
								<div className='relative w-full h-full'>
									<img
										src={studentPhoto}
										alt='Preview'
										className='w-full h-full object-cover'
									/>
									<button
										onClick={clearPhoto}
										type='button'
										className='absolute top-1 right-1 p-1 bg-primary text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20'
									>
										<X className='w-3 h-3' />
									</button>
								</div>
							) : (
								<div className='flex flex-col items-center text-muted-foreground group-hover:text-primary transition-colors'>
									<Camera className='w-8 h-8 mb-1' />
									<span className='text-[10px] uppercase font-bold tracking-tight'>
										Upload 2x2
									</span>
								</div>
							)}
						</div>
						{/* Professional Hidden Input */}
						<input
							type='file'
							className='absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed z-10'
							accept='image/jpeg,image/png,image/jpg'
							onChange={handlePhotoChange}
							title='Upload student photo'
						/>
					</div>
					<p className='text-[10px] text-center text-muted-foreground leading-tight'>
						Accepted formats: JPG, PNG.
						<br />
						Max size: 5MB.
					</p>
				</div>

				{/* NAME FIELDS COLUMN */}
				<div className='md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4'>
					<div className='space-y-1.5'>
						<Label
							htmlFor='lastName'
							className='text-sm font-semibold'
						>
							Last Name <span className='text-destructive'>*</span>
						</Label>
						<Input
							id='lastName'
							{...register('lastName')}
							autoComplete='off'
							placeholder='e.g. DELA CRUZ'
							className={cn(
								'h-11 uppercase font-bold',
								errors.lastName &&
									'border-destructive focus-visible:ring-destructive',
							)}
						/>
						{errors.lastName && (
							<p className='text-[11px] text-destructive font-medium flex items-center gap-1'>
								<AlertCircle className='w-3 h-3' /> {errors.lastName.message}
							</p>
						)}
					</div>

					<div className='space-y-1.5'>
						<Label
							htmlFor='firstName'
							className='text-sm font-semibold'
						>
							First Name <span className='text-destructive'>*</span>
						</Label>
						<Input
							id='firstName'
							{...register('firstName')}
							autoComplete='off'
							placeholder='e.g. JUAN'
							className={cn(
								'h-11 uppercase font-bold',
								errors.firstName &&
									'border-destructive focus-visible:ring-destructive',
							)}
						/>
						{errors.firstName && (
							<p className='text-[11px] text-destructive font-medium flex items-center gap-1'>
								<AlertCircle className='w-3 h-3' /> {errors.firstName.message}
							</p>
						)}
					</div>

					<div className='space-y-1.5'>
						<Label
							htmlFor='middleName'
							className='text-sm font-semibold'
						>
							Middle Name
						</Label>
						<Input
							id='middleName'
							{...register('middleName')}
							autoComplete='off'
							placeholder='Write N/A if none'
							className='h-11 uppercase font-bold'
						/>
					</div>

					<div className='space-y-1.5'>
						<Label
							htmlFor='extensionName'
							className='text-sm font-semibold'
						>
							Suffix (Extension)
						</Label>
						<Select
							onValueChange={(val) => setValue('extensionName', val)}
							defaultValue={watch('extensionName') || 'N/A'}
						>
							<SelectTrigger className='h-11 font-bold'>
								<SelectValue placeholder='Select Suffix' />
							</SelectTrigger>
							<SelectContent>
								{['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV', 'V'].map((opt) => (
									<SelectItem
										key={opt}
										value={opt}
									>
										{opt}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>

			{/* ─── DOB, Age, Sex Row ─── */}
			<div className='grid grid-cols-1 md:grid-cols-3 gap-3 items-start'>
				<div className='space-y-1.5'>
					<Label className='text-sm font-semibold'>
						Date of Birth <span className='text-destructive'>*</span>
					</Label>
					<DatePicker
						date={birthdate}
						setDate={onBirthdateChange}
						minDate={new Date('2000-01-01')}
						maxDate={new Date()}
						placeholder='Select Birthdate'
						className={cn(
							'h-11 font-bold border-input uppercase',
							errors.birthdate && 'border-destructive',
						)}
					/>
					{errors.birthdate && (
						<p className='text-[11px] text-destructive font-medium flex items-center gap-1'>
							<AlertCircle className='w-3 h-3' /> {errors.birthdate.message}
						</p>
					)}
				</div>

				<div className='space-y-1.5'>
					<Label
						htmlFor='age'
						className='text-sm font-semibold'
					>
						Age
					</Label>
					<Input
						id='age'
						{...register('age', { valueAsNumber: true })}
						autoComplete='off'
						readOnly
						className='h-11 font-bold cursor-not-allowed '
					/>
					<p className='text-[12px] text-muted-foreground italic'>
						Auto-calculated
					</p>
				</div>

				<div className='space-y-3'>
					<Label className='text-sm font-semibold'>
						Sex <span className='text-destructive'>*</span>
					</Label>
					<RadioGroup
						defaultValue={watch('sex')}
						onValueChange={(val) => setValue('sex', val as 'Male' | 'Female')}
						className='flex gap-6 pt-1'
					>
						<div className='flex items-center space-x-2.5'>
							<RadioGroupItem
								value='Male'
								id='sex-male'
								className='w-5 h-5 border-[#061E29] text-[#061E29]'
							/>
							<Label
								htmlFor='sex-male'
								className='font-medium cursor-pointer text-sm'
							>
								Male
							</Label>
						</div>
						<div className='flex items-center space-x-2.5'>
							<RadioGroupItem
								value='Female'
								id='sex-female'
								className='w-5 h-5 border-[#061E29] text-[#061E29]'
							/>
							<Label
								htmlFor='sex-female'
								className='font-medium cursor-pointer text-sm'
							>
								Female
							</Label>
						</div>
					</RadioGroup>
					<p className='text-[12px] text-muted-foreground italic'>
						As recorded on PSA Birth Certificate
					</p>
				</div>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6'>
				<div className='space-y-1.5'>
					<Label
						htmlFor='placeOfBirth'
						className='text-sm font-semibold'
					>
						Place of Birth <span className='text-destructive'>*</span>
					</Label>
					<Input
						id='placeOfBirth'
						{...register('placeOfBirth')}
						autoComplete='off'
						placeholder='City/Municipality, Province'
						className={cn(
							'h-11 font-bold uppercase',
							errors.placeOfBirth && 'border-destructive',
						)}
					/>
					{errors.placeOfBirth && (
						<p className='text-[11px] text-destructive font-medium flex items-center gap-1'>
							<AlertCircle className='w-3 h-3' /> {errors.placeOfBirth.message}
						</p>
					)}
				</div>

				<div className='space-y-1.5'>
					<Label
						htmlFor='religion'
						className='text-sm font-semibold'
					>
						Religion
					</Label>
					<Input
						id='religion'
						{...register('religion')}
						autoComplete='off'
						placeholder='e.g. Roman Catholic'
						className='h-11 font-bold uppercase'
					/>
				</div>
			</div>

			<div className='pt-6 border-t border-border/40'>
				<h3 className='text-sm font-bold uppercase tracking-widest text-[#061E29] mb-6'>
					Reference Numbers
				</h3>
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6'>
					<div className='space-y-2'>
						<div className='flex items-center gap-2'>
							<Label
								htmlFor='lrn'
								className='text-sm font-semibold'
							>
								Learner Reference Number (LRN), if applicable
							</Label>
							<Info className='w-3.5 h-3.5 text-muted-foreground cursor-help' />
						</div>
						<Input
							id='lrn'
							{...register('lrn')}
							autoComplete='off'
							placeholder='000000000000'
							maxLength={12}
							className={cn(
								'h-11  tracking-widest font-bold',
								errors.lrn && 'border-destructive',
							)}
							onInput={(e) => {
								e.currentTarget.value = e.currentTarget.value.replace(
									/[^0-9]/g,
									'',
								);
							}}
						/>
						<p className='text-[10px] text-muted-foreground italic'>
							12 digits • found on the learner's Grade 6 Report Card (SF9).
						</p>
						{errors.lrn && (
							<p className='text-[11px] text-destructive font-medium flex items-center gap-1'>
								<AlertCircle className='w-3 h-3' /> {errors.lrn.message}
							</p>
						)}
					</div>

					<div className='space-y-2'>
						<Label
							htmlFor='psaBirthCertNumber'
							className='text-sm font-semibold'
						>
							PSA Birth Certificate Number
						</Label>
						<Input
							id='psaBirthCertNumber'
							{...register('psaBirthCertNumber')}
							autoComplete='off'
							placeholder='PSA BC Number'
							className='h-11 font-bold'
						/>
						<p className='text-[10px] text-muted-foreground italic'>
							Found on the birth certificate (While this field is optional, the
							physical document must be submitted for verification.).
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
