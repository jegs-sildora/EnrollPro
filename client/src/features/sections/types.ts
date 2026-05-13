export interface SectionFormState {
  name: string;
  programType: string;
  adviserId: string;
  maxCapacity: number;
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
  advisingTeacher: { id: number; name: string } | null;
}
