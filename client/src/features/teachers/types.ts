export interface TeacherDesignation {
  id: number;
  schoolId: number | null;
  schoolYearId: number;
  isClassAdviser: boolean;
  advisorySectionId: number | null;
  advisorySection: {
    id: number;
    name: string;
    gradeLevelId: number;
    gradeLevelName: string | null;
  } | null;
  advisoryEquivalentHoursPerWeek: number;
  isTic: boolean;
  isTeachingExempt: boolean;
  customTargetTeachingHoursPerWeek: number | null;
  computedMaxWeeklyHours: number;
  designationNotes: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  updateReason: string | null;
  updatedById: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface AdvisorySectionOption {
  id: number;
  label: string;
  gradeLevelName: string;
  sectionName: string;
  maxCapacity: number;
  enrolledCount: number;
  currentAdviserId: number | null;
  currentAdviserName: string | null;
}

export interface SectionsApiResponse {
  gradeLevels?: Array<{
    gradeLevelName: string;
    sections?: Array<{
      id: number;
      name: string;
      maxCapacity: number;
      enrolledCount: number;
      advisingTeacher?: {
        id?: number | null;
        name?: string | null;
      } | null;
    }>;
  }>;
}

export interface DesignationCollision {
  sectionId: number;
  sectionName: string;
  gradeLevelId: number;
  gradeLevelName: string | null;
  currentAdviserId: number;
  currentAdviserName: string;
}

export interface Teacher {
  id: number;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  email: string | null;
  contactNumber: string | null;
  designationTitle: string | null;
  specialization: string | null;
  department: string | null;
  plantillaPosition: string | null;
  photoPath: string | null;
  subjects: string[];
  sectionCount: number;
  designation: TeacherDesignation | null;
  isActive: boolean;
  createdAt: string;
}

export interface TeacherFormState {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  employeeId: string;
  contactNumber: string;
  designation: string;
  specialization: string;
  department: string;
  plantillaPosition: string;
  subjects: string[];
  photo: string | null;
}

export interface DesignationFormState {
  isClassAdviser: boolean;
  advisorySectionId: string;
  advisoryEquivalentHoursPerWeek: string;
  isTic: boolean;
  isTeachingExempt: boolean;
  customTargetTeachingHoursPerWeek: string;
  designationNotes: string;
  effectiveFrom: string;
  effectiveTo: string;
  isCustomPeriod: boolean;
  reason: string;
}

export type DesignationDrawerTab = "role-load" | "schedule-notes" | "review";
export type TeacherStatusFilter = "all" | "active" | "inactive";
export type TeacherDesignationFilter =
  | "all"
  | "adviser"
  | "tic"
  | "exempt"
  | "none";
