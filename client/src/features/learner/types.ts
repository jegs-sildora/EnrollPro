/** Shape returned by POST /learner/lookup */
export interface LearnerProfile {
  id: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  birthDate: string;
  sex: "Male" | "Female";
  motherTongue?: string | null;
  nationality?: string | null;
  religion?: string | null;
  status: string;
  curriculum?: string | null;
  studentPhoto?: string | null;
  currentAddress?: {
    houseNumber?: string | null;
    street?: string | null;
    barangay?: string | null;
    municipality?: string | null;
    province?: string | null;
  } | null;
  enrollment?: {
    curriculum?: string | null;
    tleProgramName?: string | null;
    section?: {
      name: string;
      advisingTeacher?: { firstName: string; lastName: string } | null;
    } | null;
  } | null;
  schoolYear?: { id: number; yearLabel: string } | null;
  gradeLevel?: { name: string } | null;
  lastSchoolName?: string | null;
  schoolYearLastAttended?: string | null;
  lastGradeCompleted?: string | null;
  healthRecords: HealthRecord[];
  pendingConfirmation?: {
    applicationId: number;
    status: string;
    gradeLevelName: string;
    gradeLevelDisplayOrder?: number | null;
    tleProgramId?: number | null;
    tleProgramName?: string | null;
    tleStatus?: string | null;
    guardianName?: string | null;
  } | null;
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

export interface AcademicHistoryEntry {
  id: number;
  schoolYear: { id: number; yearLabel: string };
  gradeLevel: { id: number; name: string };
  status: string;
  applicantType: string;
  enrollmentRecord?: {
    section: { id: number; name: string } | null;
    finalAverage?: number | null;
    eosyStatus?: string | null;
  } | null;
}
