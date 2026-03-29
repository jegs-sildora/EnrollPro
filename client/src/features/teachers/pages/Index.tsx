import { useState, useEffect, useCallback } from 'react';
import { sileo } from 'sileo';
import {
	GraduationCap,
	Plus,
	Edit2,
	UserMinus,
	UserCheck,
	RefreshCw,
	Check,
} from 'lucide-react';
import api from '@/shared/api/axiosInstance';
import { toastApiError } from '@/shared/hooks/useApiToast';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/shared/ui/dialog';
import { ConfirmationModal } from '@/shared/ui/confirmation-modal';
import { Skeleton } from '@/shared/ui/skeleton';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';

interface Teacher {
	id: number;
	employeeId: string | null;
	firstName: string;
	lastName: string;
	middleName: string | null;
	contactNumber: string | null;
	specialization: string | null;
	subjects: string[];
	isActive: boolean;
	createdAt: string;
}

export default function Teachers() {
	const [teachers, setTeachers] = useState<Teacher[]>([]);
	const [loading, setLoading] = useState(true);

	// Rule A & B: Delayed loading
	const showSkeleton = useDelayedLoading(loading);

	const [createOpen, setCreateOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deactivateId, setDeactivateId] = useState<number | null>(null);
	const [reactivateId, setReactivateId] = useState<number | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		middleName: '',
		employeeId: '',
		contactNumber: '',
		specialization: '',
	});

	const [editFormData, setEditFormData] = useState({
		firstName: '',
		lastName: '',
		middleName: '',
		employeeId: '',
		contactNumber: '',
		specialization: '',
	});

	const fetchTeachers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await api.get('/teachers');
			setTeachers(res.data.teachers || []);
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTeachers();
	}, [fetchTeachers]);

	const handleCreate = async () => {
		setSubmitting(true);
		try {
			await api.post('/teachers', formData);
			sileo.success({
				title: 'Teacher Created',
				description: `${formData.lastName}, ${formData.firstName} has been added.`,
			});
			setCreateOpen(false);
			setFormData({
				firstName: '',
				lastName: '',
				middleName: '',
				employeeId: '',
				contactNumber: '',
				specialization: '',
			});
			fetchTeachers();
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setSubmitting(false);
		}
	};

	const startEditing = (teacher: Teacher) => {
		setEditingId(teacher.id);
		setEditFormData({
			firstName: teacher.firstName,
			lastName: teacher.lastName,
			middleName: teacher.middleName || '',
			employeeId: teacher.employeeId || '',
			contactNumber: teacher.contactNumber || '',
			specialization: teacher.specialization || '',
		});
	};

	const cancelEditing = () => {
		setEditingId(null);
	};

	const handleUpdate = async (id: number) => {
		setSubmitting(true);
		try {
			await api.put(`/teachers/${id}`, editFormData);
			sileo.success({
				title: 'Teacher Updated',
				description: 'Changes saved successfully.',
			});
			setEditingId(null);
			fetchTeachers();
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setSubmitting(false);
		}
	};

	const handleToggleStatus = async (
		id: number,
		action: 'deactivate' | 'reactivate',
	) => {
		setSubmitting(true);
		try {
			await api.patch(`/teachers/${id}/${action}`);
			sileo.success({
				title:
					action === 'deactivate'
						? 'Teacher Deactivated'
						: 'Teacher Reactivated',
				description: 'Teacher status updated successfully.',
			});
			setDeactivateId(null);
			setReactivateId(null);
			fetchTeachers();
		} catch (err) {
			toastApiError(err as never);
		} finally {
			setSubmitting(false);
		}
	};

	const formatName = (t: Teacher) =>
		`${t.lastName}, ${t.firstName}${t.middleName ? ` ${t.middleName.charAt(0)}.` : ''}`;

	return (
		<div className='space-y-6 max-w-full overflow-x-hidden'>
			<div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
				<div className='space-y-1 text-left'>
					<h1 className='text-2xl md:text-3xl font-bold flex items-center justify-start gap-2 text-balance'>
						<GraduationCap className='h-7 w-7 md:h-8 md:w-8 text-primary' />
						Teacher Management
					</h1>
					<p className='text-sm text-muted-foreground text-balance'>
						Manage teacher profiles for section adviser assignment
					</p>
				</div>
				<div className='flex justify-end'>
					<Button
						onClick={() => {
							setFormData({
								firstName: '',
								lastName: '',
								middleName: '',
								employeeId: '',
								contactNumber: '',
								specialization: '',
							});
							setCreateOpen(true);
						}}
						className='w-fit shadow-sm'
					>
						<Plus className='h-4 w-4 mr-2' />
						Add Teacher
					</Button>
				</div>
			</div>

			<Card className='overflow-hidden max-w-full'>
				<CardHeader className='pb-3 px-4 md:px-6 border-b bg-muted/10'>
					<div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
						<CardTitle className='text-lg font-semibold'>
							Teacher Directory
						</CardTitle>
						<Button
							variant='outline'
							size='icon'
							className='h-9 w-9 shrink-0'
							onClick={fetchTeachers}
						>
							<RefreshCw
								className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
							/>
						</Button>
					</div>
				</CardHeader>
				<CardContent className='p-0'>
					<div className='p-4 md:p-6'>
						<div className='rounded-md border border-border bg-background overflow-hidden'>
							<div className='w-full overflow-x-auto scrollbar-thin'>
								<table className='w-full text-sm border-collapse table-fixed lg:table-auto min-w-200'>
									<thead className='bg-muted/50 border-b'>
										<tr>
											<th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-24'>
												Employee ID
											</th>
											<th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-48'>
												Full Name
											</th>
											<th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-40'>
												Specialization
											</th>
											<th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-32'>
												Contact
											</th>
											<th className='px-4 py-3.5 text-center font-semibold border-r last:border-r-0 text-muted-foreground uppercase tracking-wider text-[10px] w-24'>
												Status
											</th>
											<th className='px-4 py-3.5 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-48'>
												Actions
											</th>
										</tr>
									</thead>
									<tbody className='divide-y'>
										{showSkeleton ? (
											Array.from({ length: 5 }).map((_, i) => (
												<tr key={i}>
													<td className='px-4 py-4'>
														<Skeleton className='h-4 w-16 mx-auto' />
													</td>
													<td className='px-4 py-4'>
														<Skeleton className='h-4 w-32 mx-auto' />
													</td>
													<td className='px-4 py-4'>
														<Skeleton className='h-4 w-24 mx-auto' />
													</td>
													<td className='px-4 py-4'>
														<Skeleton className='h-4 w-20 mx-auto' />
													</td>
													<td className='px-4 py-4'>
														<Skeleton className='h-6 w-16 mx-auto rounded-full' />
													</td>
													<td className='px-4 py-4'>
														<Skeleton className='h-8 w-24 mx-auto' />
													</td>
												</tr>
											))
										) : teachers.length === 0 ? (
											<tr>
												<td
													colSpan={6}
													className='px-4 py-12 text-center text-muted-foreground italic'
												>
													No teachers found. Click "Add Teacher" to create one.
												</td>
											</tr>
										) : (
											teachers.map((teacher) => (
												<tr
													key={teacher.id}
													className={`hover:bg-muted/30 transition-colors ${!teacher.isActive ? 'opacity-60 bg-muted/10' : ''}`}
												>
													<td className='px-4 py-4 text-center  text-xs border-r last:border-r-0'>
														{editingId === teacher.id ? (
															<Input
																value={editFormData.employeeId}
																onChange={(e) =>
																	setEditFormData({
																		...editFormData,
																		employeeId: e.target.value,
																	})
																}
																className='h-8 text-xs'
															/>
														) : (
															teacher.employeeId || '—'
														)}
													</td>
													<td className='px-4 py-4 text-center font-medium border-r last:border-r-0'>
														{editingId === teacher.id ? (
															<div className='space-y-1'>
																<Input
																	placeholder='Last Name'
																	value={editFormData.lastName}
																	onChange={(e) =>
																		setEditFormData({
																			...editFormData,
																			lastName: e.target.value,
																		})
																	}
																	className='h-7 text-xs'
																/>
																<Input
																	placeholder='First Name'
																	value={editFormData.firstName}
																	onChange={(e) =>
																		setEditFormData({
																			...editFormData,
																			firstName: e.target.value,
																		})
																	}
																	className='h-7 text-xs'
																/>
															</div>
														) : (
															formatName(teacher)
														)}
													</td>
													<td className='px-4 py-4 text-center text-xs border-r last:border-r-0'>
														{editingId === teacher.id ? (
															<Input
																value={editFormData.specialization}
																onChange={(e) =>
																	setEditFormData({
																		...editFormData,
																		specialization: e.target.value,
																	})
																}
																className='h-8 text-xs'
															/>
														) : (
															teacher.specialization || '—'
														)}
													</td>
													<td className='px-4 py-4 text-center text-xs border-r last:border-r-0'>
														{editingId === teacher.id ? (
															<Input
																value={editFormData.contactNumber}
																onChange={(e) =>
																	setEditFormData({
																		...editFormData,
																		contactNumber: e.target.value,
																	})
																}
																className='h-8 text-xs'
															/>
														) : (
															teacher.contactNumber || '—'
														)}
													</td>
													<td className='px-4 py-4 text-center border-r last:border-r-0'>
														<div className='flex items-center justify-center gap-1.5'>
															<div
																className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${teacher.isActive ? 'bg-green-500 ring-green-100' : 'bg-slate-400 ring-slate-100'}`}
															/>
															<span className='text-[11px] font-medium'>
																{teacher.isActive ? 'Active' : 'Inactive'}
															</span>
														</div>
													</td>
													<td className='px-4 py-4 text-center'>
														<div className='flex flex-wrap items-center justify-center gap-1.5'>
															{editingId === teacher.id ? (
																<>
																	<Button
																		variant='default'
																		size='sm'
																		className='h-7 px-2 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700'
																		onClick={() => handleUpdate(teacher.id)}
																		disabled={submitting}
																	>
																		<Check className='h-3 w-3' />
																		Update
																	</Button>
																	<Button
																		variant='outline'
																		size='sm'
																		className='h-7 px-2 text-[10px] gap-1'
																		onClick={cancelEditing}
																		disabled={submitting}
																	>
																		Cancel
																	</Button>
																</>
															) : (
																<>
																	<Button
																		variant='outline'
																		size='sm'
																		className='h-7 px-2 text-[10px] gap-1'
																		onClick={() => startEditing(teacher)}
																	>
																		<Edit2 className='h-3 w-3' />
																		Edit
																	</Button>
																	{teacher.isActive ? (
																		<Button
																			variant='outline'
																			size='sm'
																			className='h-7 px-2 text-[10px] gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground'
																			onClick={() =>
																				setDeactivateId(teacher.id)
																			}
																		>
																			<UserMinus className='h-3 w-3' />
																			Deactivate
																		</Button>
																	) : (
																		<Button
																			variant='outline'
																			size='sm'
																			className='h-7 px-2 text-[10px] gap-1 text-emerald-600 hover:bg-emerald-600 hover:text-white'
																			onClick={() =>
																				setReactivateId(teacher.id)
																			}
																		>
																			<UserCheck className='h-3 w-3' />
																			Reactivate
																		</Button>
																	)}
																</>
															)}
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Add Teacher Dialog */}
			<Dialog
				open={createOpen}
				onOpenChange={setCreateOpen}
			>
				<DialogContent className='w-[95vw] max-w-lg sm:w-full overflow-y-auto max-h-[90vh]'>
					<DialogHeader>
						<DialogTitle>Add Teacher</DialogTitle>
						<DialogDescription>
							Add a new teacher to the directory. Teachers are not system users
							— they have no login accounts.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-4 py-2'>
						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Last Name *</Label>
								<Input
									placeholder='e.g. Santos'
									value={formData.lastName}
									onChange={(e) =>
										setFormData({ ...formData, lastName: e.target.value })
									}
								/>
							</div>
							<div className='space-y-2'>
								<Label>First Name *</Label>
								<Input
									placeholder='e.g. Maria'
									value={formData.firstName}
									onChange={(e) =>
										setFormData({ ...formData, firstName: e.target.value })
									}
								/>
							</div>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Middle Name</Label>
								<Input
									placeholder='e.g. Cruz'
									value={formData.middleName}
									onChange={(e) =>
										setFormData({ ...formData, middleName: e.target.value })
									}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Employee ID</Label>
								<Input
									placeholder='e.g. EMP-001'
									value={formData.employeeId}
									onChange={(e) =>
										setFormData({ ...formData, employeeId: e.target.value })
									}
								/>
							</div>
						</div>
						<div className='grid gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>Contact Number</Label>
								<Input
									placeholder='e.g. 09171234567'
									value={formData.contactNumber}
									onChange={(e) =>
										setFormData({ ...formData, contactNumber: e.target.value })
									}
								/>
							</div>
							<div className='space-y-2'>
								<Label>Specialization</Label>
								<Input
									placeholder='e.g. Mathematics'
									value={formData.specialization}
									onChange={(e) =>
										setFormData({ ...formData, specialization: e.target.value })
									}
								/>
							</div>
						</div>
					</div>
					<DialogFooter className='gap-2 sm:gap-0'>
						<Button
							variant='outline'
							onClick={() => setCreateOpen(false)}
							disabled={submitting}
							className='w-full sm:w-auto'
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreate}
							disabled={submitting || !formData.firstName || !formData.lastName}
							className='w-full sm:w-auto'
						>
							{submitting ? 'Creating...' : 'Create Teacher'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmationModal
				open={!!deactivateId}
				onOpenChange={(open) => !open && setDeactivateId(null)}
				title='Deactivate Teacher'
				description="This teacher will be marked as inactive and won't appear in section adviser dropdowns."
				confirmText='Yes, Deactivate'
				onConfirm={() =>
					deactivateId && handleToggleStatus(deactivateId, 'deactivate')
				}
				loading={submitting}
				variant='warning'
			/>

			<ConfirmationModal
				open={!!reactivateId}
				onOpenChange={(open) => !open && setReactivateId(null)}
				title='Reactivate Teacher'
				description='This teacher will be marked as active and will appear in section adviser dropdowns again.'
				confirmText='Yes, Reactivate'
				onConfirm={() =>
					reactivateId && handleToggleStatus(reactivateId, 'reactivate')
				}
				loading={submitting}
				variant='info'
			/>
		</div>
	);
}
