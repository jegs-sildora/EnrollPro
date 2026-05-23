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
  ancillaryRoles: string[];
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
  programType: string;
  isHomogeneous: boolean;
  tleProgramId?: number | null;
  tleProgramName?: string | null;
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
      programType: string;
      isHomogeneous: boolean;
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
  sex: "MALE" | "FEMALE";
  designationTitle: string | null;
  specialization: string | null;
  department: string | null;
  plantillaPosition: string | null;
  photoPath: string | null;
  sectionCount: number;
  designation: TeacherDesignation | null;
  isActive: boolean;
  createdAt: string;
  userAccount: {
    id: number;
    isActive: boolean;
    lastLoginAt: string | null;
    mustChangePassword: boolean;
  } | null;
}

export interface TeacherFormState {
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  employeeId: string;
  contactNumber: string;
  sex: "MALE" | "FEMALE";
  specialization: string;
  department: string;
  plantillaPosition: string;
}

export interface DesignationFormState {
  isClassAdviser: boolean;
  advisorySectionId: string;
  ancillaryRoles: string[];
  designationNotes: string;
  effectiveFrom: string;
  effectiveTo: string;
  isCustomPeriod: boolean;
  reason: string;
}

export type DesignationDrawerTab = "designation" | "schedule-notes" | "review";
export type TeacherStatusFilter = "all" | "active" | "inactive";
export type TeacherDesignationFilter = string;
