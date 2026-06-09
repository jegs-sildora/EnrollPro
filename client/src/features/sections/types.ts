export type SectionTypeMode = "HOME_ROOM" | "TLE_LABORATORY";

export interface SectionFormState {
  name: string;
  curriculumProgram?: string;
  programType?: string;
  sectionType: SectionTypeMode;
  adviserId: string;
  maxCapacity: number;
  tleProgramId: number | null;
}

export interface TeacherOption {
  id: number;
  name: string;
  employeeId: string | null;
}

export interface AdviserCandidate {
  id: number;
  name: string;
  employeeId: string | null;
  department: string | null;
  specialization: string | null;
  isActive: boolean;
  designationTitle: string | null;
  assignedSection: {
    id: number;
    name: string;
    gradeLevelName: string | null;
  } | null;
}

export interface SectionItem {
  id: number;
  name: string;
  sortOrder: number;
  programType: string;
  isHomogeneous: boolean;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  tleProgramId?: number | null;
  advisingTeacher: { id: number; name: string } | null;
}
