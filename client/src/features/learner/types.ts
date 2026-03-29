/** Shape returned by POST /learner/lookup */
export interface LearnerProfile {
	id: number;
	lrn: string;
	firstName: string;
	lastName: string;
	middleName?: string | null;
	suffix?: string | null;
	birthDate: string;
	sex: 'Male' | 'Female';
	motherTongue?: string | null;
	nationality?: string | null;
	religion?: string | null;
	status: string;
	currentAddress?: {
		houseNumber?: string | null;
		street?: string | null;
		barangay?: string | null;
		municipality?: string | null;
		province?: string | null;
	} | null;
	enrollment?: {
		section?: {
			name: string;
			advisingTeacher?: { firstName: string; lastName: string } | null;
		} | null;
	} | null;
	schoolYear?: { yearLabel: string } | null;
	gradeLevel?: { name: string } | null;
	lastSchoolName?: string | null;
	schoolYearLastAttended?: string | null;
	lastGradeCompleted?: string | null;
	healthRecords: HealthRecord[];
}

export interface HealthRecord {
	id: number;
	schoolYear: string;
	assessmentPeriod: string;
	assessmentDate: string;
	weightKg: number;
	heightCm: number;
	notes?: string | null;
}
