import { useFormContext } from 'react-hook-form';
import type { EarlyRegistrationFormData } from '../types';
import {
	ACADEMIC_CLUSTERS,
	TECHPRO_CLUSTERS,
	SPA_ART_FIELDS,
	SPS_SPORTS,
	SPFL_LANGUAGES,
} from '../types';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Checkbox } from '@/shared/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';
import { Separator } from '@/shared/ui/separator';
import { Switch } from '@/shared/ui/switch';
import { InfoIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useSettingsStore } from '@/store/settings.slice';

export default function Step3Preferences() {
	const {
		register,
		watch,
		setValue,
		formState: { errors },
	} = useFormContext<EarlyRegistrationFormData>();
	const { schoolName } = useSettingsStore();

	const gradeLevel = watch('gradeLevel');
	const shsTrack = watch('shsTrack');
	const isScpApplication = watch('isScpApplication');
	const scpType = watch('scpType');
	const electiveCluster = watch('electiveCluster');

	const clusters =
		shsTrack === 'Academic' ? ACADEMIC_CLUSTERS : TECHPRO_CLUSTERS;
	const showStemGrades = electiveCluster === 'AC-STEM';

	return (
		<div className='space-y-8'>
			{/* Section 2: Grade Level & Program */}
			<div className='space-y-6'>
				<h3 className='text-lg font-semibold'>
					Section 2: Grade Level & Program
				</h3>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
					<div className='space-y-2'>
						<Label>
							Grade Level to Enroll <span className='text-destructive'>*</span>
						</Label>
						<Select
							value={gradeLevel}
							onValueChange={(val: '7' | '11') => setValue('gradeLevel', val)}
						>
							<SelectTrigger className='font-bold'>
								<SelectValue placeholder='Select Grade Level' />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='7'>Grade 7 (JHS)</SelectItem>
								<SelectItem value='11'>Grade 11 (SHS)</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{gradeLevel === '11' && (
						<div className='space-y-2'>
							<Label>
								SHS Track <span className='text-destructive'>*</span>
							</Label>
							<RadioGroup
								value={shsTrack}
								onValueChange={(val: 'Academic' | 'TechPro') => {
									setValue('shsTrack', val);
									setValue('electiveCluster', undefined);
								}}
								className='flex gap-4 pt-2'
							>
								<div className='flex items-center space-x-2'>
									<RadioGroupItem
										value='Academic'
										id='track-acad'
									/>
									<Label htmlFor='track-acad'>Academic</Label>
								</div>
								<div className='flex items-center space-x-2'>
									<RadioGroupItem
										value='TechPro'
										id='track-tech'
									/>
									<Label htmlFor='track-tech'>Tech-Pro</Label>
								</div>
							</RadioGroup>
						</div>
					)}
				</div>

				{gradeLevel === '11' && shsTrack && (
					<div className='space-y-4 p-4 border rounded-md bg-muted/20'>
						<div className='space-y-2'>
							<Label>
								Preferred Elective Cluster{' '}
								<span className='text-destructive'>*</span>
							</Label>
							<Select
								value={electiveCluster}
								onValueChange={(val) => setValue('electiveCluster', val)}
							>
								<SelectTrigger className='font-bold'>
									<SelectValue placeholder='Select Cluster' />
								</SelectTrigger>
								<SelectContent>
									{clusters.map((c) => (
										<SelectItem
											key={c.value}
											value={c.value}
										>
											{c.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{showStemGrades && (
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2'>
								<div className='space-y-2'>
									<Label htmlFor='g10Science'>
										Grade 10 Science Final Grade
									</Label>
									<Input
										autoComplete='off'
										className='font-bold'
										id='g10Science'
										type='number'
										{...register('g10ScienceGrade', { valueAsNumber: true })}
										placeholder='0-100'
									/>
									{watch('g10ScienceGrade') &&
										watch('g10ScienceGrade')! < 85 && (
											<p className='text-xs text-amber-600'>
												Note: STEM requires Science â‰¥ 85
											</p>
										)}
								</div>
								<div className='space-y-2'>
									<Label htmlFor='g10Math'>
										Grade 10 Mathematics Final Grade
									</Label>
									<Input
										autoComplete='off'
										className='font-bold'
										id='g10Math'
										type='number'
										{...register('g10MathGrade', { valueAsNumber: true })}
										placeholder='0-100'
									/>
									{watch('g10MathGrade') && watch('g10MathGrade')! < 85 && (
										<p className='text-xs text-amber-600'>
											Note: STEM requires Mathematics â‰¥ 85
										</p>
									)}
								</div>
							</div>
						)}
					</div>
				)}

				{gradeLevel === '7' && (
					<div className='space-y-4'>
						<div className='flex items-center space-x-2'>
							<Switch
								id='scp-app'
								checked={isScpApplication}
								onCheckedChange={(checked) =>
									setValue('isScpApplication', checked)
								}
							/>
							<Label htmlFor='scp-app'>
								Applying for Special Curricular Program (SCP)?
							</Label>
						</div>

						{isScpApplication && (
							<div className='p-4 border rounded-md bg-muted/20 space-y-4'>
								<div className='space-y-2'>
									<Label>
										Which SCP? <span className='text-destructive'>*</span>
									</Label>
									<Select
										value={scpType}
										onValueChange={(val: string) =>
											setValue(
												'scpType',
												val as EarlyRegistrationFormData['scpType'],
											)
										}
									>
										<SelectTrigger className='font-bold'>
											<SelectValue placeholder='Select SCP' />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='SCIENCE_TECHNOLOGY_AND_ENGINEERING'>
												Science, Technology & Engineering (STE)
											</SelectItem>
											<SelectItem value='SPECIAL_PROGRAM_IN_THE_ARTS'>
												Special Program in the Arts (SPA)
											</SelectItem>
											<SelectItem value='SPECIAL_PROGRAM_IN_SPORTS'>
												Special Program in Sports (SPS)
											</SelectItem>
											<SelectItem value='SPECIAL_PROGRAM_IN_JOURNALISM'>
												Special Program in Journalism (SPJ)
											</SelectItem>
											<SelectItem value='SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE'>
												Special Program in Foreign Language (SPFL)
											</SelectItem>
											<SelectItem value='SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION'>
												Special Program in Tech-Voc Education (SPTVE)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{scpType === 'SPECIAL_PROGRAM_IN_THE_ARTS' && (
									<div className='space-y-2'>
										<Label>
											SPA Art Field <span className='text-destructive'>*</span>
										</Label>
										<Select onValueChange={(val) => setValue('artField', val)}>
											<SelectTrigger className='font-bold'>
												<SelectValue placeholder='Select Art Field' />
											</SelectTrigger>
											<SelectContent>
												{SPA_ART_FIELDS.map((f) => (
													<SelectItem
														key={f}
														value={f}
													>
														{f}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}

								{scpType === 'SPECIAL_PROGRAM_IN_SPORTS' && (
									<div className='space-y-2'>
										<Label>Sports (Select all that apply)</Label>
										<div className='grid grid-cols-2 lg:grid-cols-3 gap-2'>
											{SPS_SPORTS.map((s) => (
												<div
													key={s}
													className='flex items-center space-x-2'
												>
													<Checkbox
														id={`sport-${s}`}
														checked={watch('sportsList')?.includes(s)}
														onCheckedChange={(checked) => {
															const current = watch('sportsList') || [];
															if (checked)
																setValue('sportsList', [...current, s]);
															else
																setValue(
																	'sportsList',
																	current.filter((i) => i !== s),
																);
														}}
														className='data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary'
													/>
													<Label
														htmlFor={`sport-${s}`}
														className='text-sm'
													>
														{s}
													</Label>
												</div>
											))}
										</div>
									</div>
								)}

								{scpType === 'SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE' && (
									<div className='space-y-2'>
										<Label>
											Preferred Foreign Language{' '}
											<span className='text-destructive'>*</span>
										</Label>
										<Select
											onValueChange={(val) => setValue('foreignLanguage', val)}
										>
											<SelectTrigger className='font-bold'>
												<SelectValue placeholder='Select Language' />
											</SelectTrigger>
											<SelectContent>
												{SPFL_LANGUAGES.map((l) => (
													<SelectItem
														key={l}
														value={l}
													>
														{l}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>

			<Separator />

			{/* Section 7: Previous School Information */}
			<div className='space-y-6'>
				<h3 className='text-lg font-semibold'>
					Section 7: Previous School Information
				</h3>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
					<div className='space-y-2 md:col-span-2'>
						<Label htmlFor='prev-school'>
							Name of Last School Attended{' '}
							<span className='text-destructive'>*</span>
						</Label>
						<Input
							autoComplete='off'
							className='font-bold'
							id='prev-school'
							{...register('lastSchoolName')}
						/>
						{errors.lastSchoolName && (
							<p className='text-xs text-destructive'>
								{errors.lastSchoolName.message}
							</p>
						)}
					</div>
					<div className='space-y-2'>
						<Label htmlFor='prev-school-id'>School ID (If known)</Label>
						<Input
							autoComplete='off'
							className='font-bold'
							id='prev-school-id'
							{...register('lastSchoolId')}
						/>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='prev-grade'>
							Last Grade Level Completed{' '}
							<span className='text-destructive'>*</span>
						</Label>
						<Input
							autoComplete='off'
							className='font-bold'
							id='prev-grade'
							{...register('lastGradeCompleted')}
							placeholder='e.g. Grade 6'
						/>
					</div>
					<div className='space-y-2'>
						<Label htmlFor='prev-sy'>
							School Year Last Attended{' '}
							<span className='text-destructive'>*</span>
						</Label>
						<Input
							autoComplete='off'
							className='font-bold'
							id='prev-sy'
							{...register('schoolYearLastAttended')}
							placeholder='e.g. 2025-2026'
						/>
					</div>
					<div className='space-y-2'>
						<Label>
							Type of Last School <span className='text-destructive'>*</span>
						</Label>
						<RadioGroup
							defaultValue={watch('lastSchoolType')}
							onValueChange={(
								val: 'Public' | 'Private' | 'International' | 'ALS',
							) => setValue('lastSchoolType', val)}
							className='flex flex-wrap gap-4 pt-2'
						>
							{['Public', 'Private', 'International', 'ALS'].map((t) => (
								<div
									key={t}
									className='flex items-center space-x-2'
								>
									<RadioGroupItem
										value={t}
										id={`school-type-${t}`}
									/>
									<Label htmlFor={`school-type-${t}`}>{t}</Label>
								</div>
							))}
						</RadioGroup>
					</div>
				</div>
			</div>

			<Separator />

			{/* Section 9: Learner Type */}
			<div className='space-y-6'>
				<h3 className='text-lg font-semibold'>Section 9: Learner Type</h3>
				<div className='space-y-2'>
					<Label>
						Type of Learner <span className='text-destructive'>*</span>
					</Label>
					<Select
						value={watch('learnerType')}
						onValueChange={(
							val:
								| 'Regular'
								| 'Transferee'
								| 'Returning Learner'
								| 'OSCYA'
								| 'ALS',
						) => setValue('learnerType', val)}
					>
						<SelectTrigger className='font-bold'>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='Regular'>Regular</SelectItem>
							<SelectItem value='Transferee'>Transferee</SelectItem>
							<SelectItem value='Returning Learner'>
								Returning Learner (Balik-Aral)
							</SelectItem>
							<SelectItem value='OSCYA'>
								Out-of-School Children Youth & Adults (OSCYA)
							</SelectItem>
							<SelectItem value='ALS'>ALS Learner</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<Separator />

			{/* Section 10: Certification */}
			<div className='space-y-4 bg-primary/5 p-6 rounded-lg border border-primary/20'>
				<h3 className='text-lg font-semibold flex items-center gap-2'>
					<InfoIcon className='w-5 h-5 text-primary' />
					Section 10: Certification & Consent
				</h3>

				<div className='bg-background border border-primary/10 rounded-md p-4 text-sm'>
					I certify that all information I have provided on this form is true,
					correct, and complete to the best of my knowledge and belief.
				</div>

				<div className='flex items-start space-x-3 pt-2'>
					<Checkbox
						id='certify'
						checked={watch('isCertifiedTrue')}
						onCheckedChange={(checked) =>
							setValue('isCertifiedTrue', checked === true)
						}
						className='data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground border-primary'
					/>
					<Label
						htmlFor='certify'
						className='text-sm font-medium leading-tight'
					>
						I certify the accuracy of the information provided above.{' '}
						<span className='text-destructive'>*</span>
					</Label>
				</div>

				<div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-4'>
					<div className='space-y-2'>
						<Label htmlFor='signature'>
							Full Name of Parent/Guardian (or Learner if 18+){' '}
							<span className='text-destructive'>*</span>
						</Label>
						<Input
							autoComplete='off'
							className='font-bold'
							id='signature'
							{...register('parentGuardianSignature')}
							placeholder='Type your full name'
						/>
						{errors.parentGuardianSignature && (
							<p className='text-xs text-destructive'>
								{errors.parentGuardianSignature.message}
							</p>
						)}
					</div>
					<div className='space-y-2'>
						<Label>Date</Label>
						<Input
							autoComplete='off'
							value={format(new Date(), 'MMMM dd, yyyy')}
							readOnly
							className='bg-muted font-bold'
						/>
					</div>
				</div>

				<p className='text-[10px] text-muted-foreground mt-4 italic'>
					Your Data Privacy consent was recorded at the start of this form.
					Submission of this form constitutes official application for EARLY
					REGISTRATION{schoolName ? ` to ${schoolName}` : ''}.
				</p>
			</div>
		</div>
	);
}
