export type EnrollmentSubMenu =
  | "PENDING_VERIFICATION"
  | "SECTION_ASSIGNMENT"
  | "OFFICIAL_ROSTER";

export const ENROLLMENT_SUB_MENU_OPTIONS: Array<{
  value: EnrollmentSubMenu;
  label: string;
}> = [
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
  { value: "SECTION_ASSIGNMENT", label: "Section Assignment" },
  { value: "OFFICIAL_ROSTER", label: "Official Roster (Enrolled)" },
];

export const ENROLLMENT_SUB_MENU_DESCRIPTIONS: Record<
  EnrollmentSubMenu,
  string
> = {
  PENDING_VERIFICATION:
    "Intake queue for learners awaiting in-person physical document verification before section assignment.",
  SECTION_ASSIGNMENT:
    "Verified learners without a section, ready for section assignment and enrollment finalization.",
  OFFICIAL_ROSTER:
    "Finalized enrolled learners with locked sections, ready for LIS Master CSV export.",
};

export const PENDING_VERIFICATION_STATUSES = new Set([
  "SUBMITTED",
  "READY_FOR_ENROLLMENT",
]);

export const SECTION_ASSIGNMENT_STATUSES = new Set(["VERIFIED"]);
