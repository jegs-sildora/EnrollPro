export type SectionTypeMode = "HOME_ROOM" | "TLE_LABORATORY";

export interface SectionFormState {
  name: string;
  programType: string;
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
