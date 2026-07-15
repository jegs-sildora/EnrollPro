export interface SectionFormState {
  name: string;
  curriculumProgram?: string;
  programType?: string;
  isHomogeneous?: boolean;
  adviserId: string;
  maxCapacity: number;
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
  advisingTeacher: { id: number; name: string } | null;
}
