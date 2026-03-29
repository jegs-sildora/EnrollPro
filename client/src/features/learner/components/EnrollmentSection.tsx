import { Badge } from '@/shared/ui/badge';
import { GraduationCap, History } from 'lucide-react';

import type { LearnerProfile } from '../types';

interface Props {
	learner: LearnerProfile;
}

export function EnrollmentSection({ learner }: Props) {
	const currentEnrollment = learner.enrollment;

	// History is not directly in the API yet, but we can show the current and previous school
	const history = [
		{
			schoolYear: learner.schoolYear?.yearLabel || 'Current',
			gradeLevel: learner.gradeLevel?.name || 'N/A',
			sectionOrSchool: currentEnrollment?.section?.name || 'N/A',
			status: 'ENROLLED',
		},
	];

	if (learner.lastSchoolName) {
		history.push({
			schoolYear: learner.schoolYearLastAttended || 'Previous',
			gradeLevel: learner.lastGradeCompleted || 'N/A',
			sectionOrSchool: learner.lastSchoolName,
			status: 'PRIOR SCHOOL',
		});
	}

	return (
		<div className='space-y-8'>
			{/* Current Enrollment */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 border-b pb-2 mb-4 border-emerald-200'>
					<GraduationCap className='h-5 w-5 text-emerald-600' />
					<h2 className='text-sm font-bold uppercase tracking-widest text-emerald-700'>
						Current Enrollment
					</h2>
				</div>

				{currentEnrollment ? (
					<div className='grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4'>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
								School Year
							</span>
							<span className='text-sm font-bold'>
								{learner.schoolYear?.yearLabel || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
								Grade Level
							</span>
							<span className='text-sm font-bold'>
								{learner.gradeLevel?.name || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
								Section
							</span>
							<span className='text-sm font-bold'>
								{currentEnrollment.section?.name || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
								Class Adviser
							</span>
							<span className='text-sm font-bold'>
								{currentEnrollment.section?.advisingTeacher
									? `${currentEnrollment.section.advisingTeacher.lastName}, ${currentEnrollment.section.advisingTeacher.firstName}`
									: 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
								Status
							</span>
							<Badge className='w-fit bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-tighter h-5 px-1.5'>
								{learner.status}
							</Badge>
						</div>
					</div>
				) : (
					<p className='text-sm text-muted-foreground italic'>
						No active enrollment record found.
					</p>
				)}
			</section>

			{/* Enrollment History */}
			<section className='space-y-4'>
				<div className='flex items-center gap-2 border-b pb-2 mb-4 border-slate-200'>
					<History className='h-5 w-5 text-slate-600' />
					<h2 className='text-sm font-bold uppercase tracking-widest text-slate-700'>
						Enrollment History
					</h2>
				</div>

				<div className='rounded-lg border border-muted/30 overflow-hidden bg-muted/5'>
					<table className='w-full text-sm'>
						<thead className='bg-muted/30'>
							<tr className='text-[10px] uppercase tracking-wider text-muted-foreground font-bold'>
								<th className='px-4 py-2 text-left'>Year</th>
								<th className='px-4 py-2 text-left'>Grade</th>
								<th className='px-4 py-2 text-left'>Section / School</th>
								<th className='px-4 py-2 text-right'>Status</th>
							</tr>
						</thead>
						<tbody className='divide-y divide-muted/30'>
							{history.map((h, i: number) => (
								<tr
									key={i}
									className='hover:bg-muted/10 transition-colors'
								>
									<td className='px-4 py-3 font-semibold text-xs'>
										{h.schoolYear}
									</td>
									<td className='px-4 py-3 text-xs'>{h.gradeLevel}</td>
									<td className='px-4 py-3 text-xs'>{h.sectionOrSchool}</td>
									<td className='px-4 py-3 text-right'>
										<span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase'>
											{h.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
