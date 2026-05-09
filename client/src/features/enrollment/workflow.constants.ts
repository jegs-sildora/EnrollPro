export const ENROLLMENT_SUB_MENU_VALUES = [
  "PENDING_VERIFICATION",
  "ROLLOVER_ELIGIBLE",
  "SECTION_ASSIGNMENT",
  "OFFICIAL_ROSTER",
] as const;

export type EnrollmentSubMenu = (typeof ENROLLMENT_SUB_MENU_VALUES)[number];

export const ENROLLMENT_SUB_MENU_OPTIONS: Array<{
  value: EnrollmentSubMenu;
  label: string;
}> = [
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
  { value: "ROLLOVER_ELIGIBLE", label: "Rollover Eligible" },
  { value: "SECTION_ASSIGNMENT", label: "Section Assignment" },
  { value: "OFFICIAL_ROSTER", label: "Official Roster (Enrolled)" },
];

export const ENROLLMENT_SUB_MENU_DESCRIPTIONS: Record<
  EnrollmentSubMenu,
  string
> = {
  PENDING_VERIFICATION:
    "LIS BOSY queue for learners awaiting in-person physical document verification before section tagging.",
  ROLLOVER_ELIGIBLE:
    "Continuing learners from the previous school year awaiting section assignment for the new term.",
  SECTION_ASSIGNMENT:
    "Verified learners without a section, ready for official LIS section assignment and enrollment finalization.",
  OFFICIAL_ROSTER:
    "Finalized enrolled learners with locked sections, ready for LIS Master CSV export and EOSY transition.",
};

export const PENDING_VERIFICATION_STATUSES = new Set([
  "PENDING_BEEF",
  "AWAITING_VERIFICATION",
  "SUBMITTED_BEEF",
  "READY_FOR_ENROLLMENT",
]);

export const ROLLOVER_ELIGIBLE_STATUSES = new Set([
  "READY_FOR_SECTIONING", // We set continuing learners to this
]);

export const SECTION_ASSIGNMENT_STATUSES = new Set([
  "READY_FOR_SECTIONING",
  "VERIFIED",
]);

export const OFFICIAL_ROSTER_STATUSES = new Set([
  "ENROLLED",
  "OFFICIALLY_ENROLLED",
]);
