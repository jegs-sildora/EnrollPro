import { Badge } from '@/shared/ui/badge';
import { GraduationCap, History } from 'lucide-react';
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";

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

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: "schoolYear",
        header: "Year",
        cell: ({ row }) => (
          <span className="font-semibold text-xs text-left block">
            {row.original.schoolYear}
          </span>
        ),
      },
      {
        accessorKey: "gradeLevel",
        header: "Grade",
        cell: ({ row }) => (
          <span className="text-xs text-left block">
            {row.original.gradeLevel}
          </span>
        ),
      },
      {
        accessorKey: "sectionOrSchool",
        header: "Section / School",
        cell: ({ row }) => (
          <span className="text-xs text-left block">
            {row.original.sectionOrSchool}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="text-right">
            <span className="text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
              {row.original.status}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

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
							<span className='text-[0.625rem] font-bold text-muted-foreground uppercase tracking-wider'>
								School Year
							</span>
							<span className='text-sm font-bold'>
								{learner.schoolYear?.yearLabel || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[0.625rem] font-bold text-muted-foreground uppercase tracking-wider'>
								Grade Level
							</span>
							<span className='text-sm font-bold'>
								{learner.gradeLevel?.name || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[0.625rem] font-bold text-muted-foreground uppercase tracking-wider'>
								Section
							</span>
							<span className='text-sm font-bold'>
								{currentEnrollment.section?.name || 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[0.625rem] font-bold text-muted-foreground uppercase tracking-wider'>
								Class Adviser
							</span>
							<span className='text-sm font-bold'>
								{currentEnrollment.section?.advisingTeacher
									? `${currentEnrollment.section.advisingTeacher.lastName}, ${currentEnrollment.section.advisingTeacher.firstName}`
									: 'N/A'}
							</span>
						</div>
						<div className='grid grid-cols-[140px_1fr] gap-4 items-center py-2 border-b border-muted/30'>
							<span className='text-[0.625rem] font-bold text-muted-foreground uppercase tracking-wider'>
								Status
							</span>
							<Badge className='w-fit bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[0.625rem] font-bold uppercase tracking-tighter h-5 px-1.5'>
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

				<DataTable
          columns={columns}
          data={history}
          className="border-none rounded-none bg-transparent"
        />
			</section>
		</div>
	);
}
