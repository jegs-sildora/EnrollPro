
export const ENROLLMENT_SUB_MENU_VALUES = [
  "UNSECTIONED_POOL",
  "BATCH_WORKSPACE",
  "OFFICIAL_ROSTERS",
] as const;


export type EnrollmentSubMenu = (typeof ENROLLMENT_SUB_MENU_VALUES)[number];

export const ENROLLMENT_SUB_MENU_OPTIONS: Array<{
  value: EnrollmentSubMenu;
  label: string;
}> = [
  { value: "UNSECTIONED_POOL", label: "Unsectioned Learner Pool" },
  { value: "BATCH_WORKSPACE", label: "Batch Sectioning Workspace" },
  { value: "OFFICIAL_ROSTERS", label: "Official Class Rosters" },
];

export const ENROLLMENT_SUB_MENU_DESCRIPTIONS: Record<
  EnrollmentSubMenu,
  string
> = {
  UNSECTIONED_POOL:
    "Unified holding pool for qualified new intake and confirmed returning learners waiting for class assignments.",
  BATCH_WORKSPACE:
    "Mass sectioning environment to build balanced classes based on program requirements and gender parity.",
  OFFICIAL_ROSTERS:
    "Finalized class lists ready for DepEd School Form 1 (SF1) and LIS synchronization.",
};

export const UNSECTIONED_POOL_STATUSES = new Set([
  "READY_FOR_SECTIONING",
  "VERIFIED",
  "READY_FOR_ENROLLMENT",
]);

export const BATCH_WORKSPACE_STATUSES = new Set([
  "READY_FOR_SECTIONING",
  "VERIFIED",
]);

export const OFFICIAL_ROSTER_STATUSES = new Set([
  "ENROLLED",
  "OFFICIALLY_ENROLLED",
]);
