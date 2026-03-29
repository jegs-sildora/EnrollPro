import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import api from '@/shared/api/axiosInstance';
import { toastApiError } from '@/shared/hooks/useApiToast';
import { Button } from '@/shared/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/shared/ui/dialog';
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/shared/ui/form';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/shared/ui/select';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { useSettingsStore } from '@/store/settings.slice';
import { sileo } from 'sileo';
import type { HealthRecord } from '@/features/enrollment/hooks/useApplicationDetail';

interface AddHealthRecordProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	applicantId: number;
	onSuccess: () => void;
	editRecord?: HealthRecord | null;
}

interface AcademicYear {
	id: number;
	yearLabel: string;
}

export function AddHealthRecord({
	isOpen,
	onOpenChange,
	applicantId,
	onSuccess,
	editRecord,
}: AddHealthRecordProps) {
	const { activeSchoolYearId } = useSettingsStore();
	const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
	const [loading, setLoading] = useState(false);

	const form = useForm({
		defaultValues: {
			schoolYearId: activeSchoolYearId?.toString() || '',
			assessmentPeriod: 'BOSY',
			assessmentDate: new Date().toISOString().split('T')[0],
			weightKg: '',
			heightCm: '',
			notes: '',
		},
	});

	useEffect(() => {
		if (isOpen) {
			const fetchYears = async () => {
				try {
					const res = await api.get('/school-years');
					setAcademicYears(res.data.schoolYears || []);
				} catch (err) {
					console.error('Failed to fetch school years', err);
				}
			};
			fetchYears();

			if (editRecord) {
				form.reset({
					schoolYearId: editRecord.schoolYearId.toString(),
					assessmentPeriod: editRecord.assessmentPeriod,
					assessmentDate: new Date(editRecord.assessmentDate)
						.toISOString()
						.split('T')[0],
					weightKg: editRecord.weightKg.toString(),
					heightCm: editRecord.heightCm.toString(),
					notes: editRecord.notes || '',
				});
			} else {
				form.reset({
					schoolYearId: activeSchoolYearId?.toString() || '',
					assessmentPeriod: 'BOSY',
					assessmentDate: new Date().toISOString().split('T')[0],
					weightKg: '',
					heightCm: '',
					notes: '',
				});
			}
		}
	}, [isOpen, editRecord, activeSchoolYearId, form]);

	const onSubmit = async (values: Record<string, string>) => {
		setLoading(true);
		try {
			const payload = {
				...values,
				schoolYearId: parseInt(values.schoolYearId, 10),
				weightKg: parseFloat(values.weightKg),
				heightCm: parseFloat(values.heightCm),
			};

			if (editRecord) {
				await api.put(
					`/students/${applicantId}/health-records/${editRecord.id}`,
					payload,
				);
				sileo.success({
					title: 'Record Updated',
					description: 'Health record has been updated successfully.',
				});
			} else {
				await api.post(`/students/${applicantId}/health-records`, payload);
				sileo.success({
					title: 'Record Added',
					description: 'Health record has been added successfully.',
				});
			}
			onSuccess();
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog
			open={isOpen}
			onOpenChange={onOpenChange}
		>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>{editRecord ? 'Edit' : 'Add'} Health Record</DialogTitle>
					<DialogDescription>
						Enter the weight and height measurements for the student.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className='space-y-4'
					>
						<div className='grid grid-cols-2 gap-4'>
							<FormField
								control={form.control}
								name='schoolYearId'
								render={({ field }) => (
									<FormItem>
										<FormLabel>School Year</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
											value={field.value}
											disabled={!!editRecord}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder='Select year' />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{academicYears.map((year) => (
													<SelectItem
														key={year.id}
														value={year.id.toString()}
													>
														{year.yearLabel}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='assessmentPeriod'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Period</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
											value={field.value}
											disabled={!!editRecord}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder='Select period' />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value='BOSY'>BoSY (Beginning)</SelectItem>
												<SelectItem value='EOSY'>EoSY (End)</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name='assessmentDate'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Date of Measurement</FormLabel>
									<FormControl>
										<Input
											type='date'
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className='grid grid-cols-2 gap-4'>
							<FormField
								control={form.control}
								name='weightKg'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Weight (kg)</FormLabel>
										<FormControl>
											<Input
												type='number'
												step='0.1'
												placeholder='e.g. 45.5'
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name='heightCm'
								render={({ field }) => (
									<FormItem>
										<FormLabel>Height (cm)</FormLabel>
										<FormControl>
											<Input
												type='number'
												step='0.1'
												placeholder='e.g. 150.0'
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name='notes'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Notes (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder='e.g. Measured by school nurse'
											className='resize-none'
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter className='pt-4'>
							<Button
								type='button'
								variant='outline'
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type='submit'
								disabled={loading}
							>
								{loading
									? 'Saving...'
									: editRecord
										? 'Update Record'
										: 'Save Record'}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
