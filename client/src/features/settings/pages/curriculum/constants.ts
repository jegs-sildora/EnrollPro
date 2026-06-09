export const SCP_TYPES = [
  {
    value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
    label: "Science, Technology, and Engineering (STE)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_THE_ARTS",
    label: "Special Program in the Arts (SPA)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_SPORTS",
    label: "Special Program in Sports (SPS)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_JOURNALISM",
    label: "Special Program in Journalism (SPJ)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
    label: "Special Program in Foreign Language (SPFL)",
  },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "Special Program in Tech-Voc Education (SPTVE)",
  },
] as const;

export const EXAM_STEP_KINDS = [
  "QUALIFYING_EXAMINATION",
  "PRELIMINARY_EXAMINATION",
  "FINAL_EXAMINATION",
] as const;
