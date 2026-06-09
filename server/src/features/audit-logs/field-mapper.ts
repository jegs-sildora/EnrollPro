export const DEPED_FIELD_MAP: Record<string, string> = {
  // Common
  id: "ID",
  createdAt: "Created At",
  updatedAt: "Updated At",
  isActive: "Is Active",
  status: "Status",

  // School Year / Term Dates
  yearLabel: "School Year",
  classOpeningDate: "Class Opening Date",
  classEndDate: "Class End Date",
  enrollOpenDate: "Official Enrollment Open Date",
  enrollCloseDate: "Official Enrollment Close Date",
  requireReadingAssessmentContinuing: "Require Reading Assessment (Continuing)",
  requireReadingAssessmentNew: "Require Reading Assessment (New Enrollees)",
  isEosyFinalized: "Is EOSY Finalized",
  clonedFromId: "Cloned From ID",
  term1Start: "Term 1 Start Date",
  term1End: "Term 1 End Date",
  term2Start: "Term 2 Start Date",
  term2End: "Term 2 End Date",
  term3Start: "Term 3 Start Date",
  term3End: "Term 3 End Date",
  term4Start: "Term 4 Start Date",
  term4End: "Term 4 End Date",

  // Settings
  systemName: "System Name",
  activeSchoolYearId: "Active School Year ID",
  isBosyOpen: "BOSY Confirmation Window Status",
  
  // Teachers / Users
  firstName: "First Name",
  lastName: "Last Name",
  middleName: "Middle Name",
  email: "Email Address",
  role: "System Role",
  departmentId: "Department ID",
  employeeId: "Employee ID",
  dateOfBirth: "Date of Birth",
  contactNumber: "Contact Number",
  gender: "Gender",

  // Learners
  lrn: "Learner Reference Number (LRN)",
  extensionName: "Extension Name",
  track: "Track",
  strand: "Strand",
  specialization: "Specialization",
  gradeLevelId: "Grade Level ID",
  sectionId: "Class Section ID",
  
  // Enrollment
  enrollmentStatus: "Enrollment Status",
  academicStatus: "Academic Status",
  promotionStatus: "Promotion Status",
  eosyStatus: "End of School Year Status",
  isIrregular: "Is Irregular",
};

/**
 * Converts a camelCase or snake_case key into Title Case if it's not in the dictionary.
 */
export function formatAuditField(key: string): string {
  if (DEPED_FIELD_MAP[key]) {
    return DEPED_FIELD_MAP[key];
  }

  // Fallback formatting
  const spaced = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).trim();
}
