import type { ScpType } from "@enrollpro/shared";
import type {
  ScpDocumentPolicy,
  ScpDocumentPhase,
  ScpDocumentRequirementDraft,
} from "./types";

export const DOCUMENT_POLICY_OPTIONS: Array<{
  value: ScpDocumentPolicy;
  label: string;
}> = [
  { value: "REQUIRED", label: "Required" },
  { value: "OPTIONAL", label: "Optional" },
  { value: "HIDDEN", label: "Hidden" },
];

export const DOCUMENT_PHASE_OPTIONS: Array<{
  value: ScpDocumentPhase;
  label: string;
}> = [
  { value: "EARLY_REGISTRATION", label: "Early Registration" },
  { value: "ENROLLMENT", label: "Enrollment" },
];

export const PHASE_ALL_VALUE = "__ALL_PHASES__";

export const DOCUMENT_ID_OPTIONS = [
  { value: "PSA_BIRTH_CERTIFICATE", label: "PSA Birth Certificate" },
  { value: "SF9_REPORT_CARD", label: "SF9 / Report Card" },
  { value: "SF10_PERMANENT_RECORD", label: "SF10 Permanent Record" },
  {
    value: "GOOD_MORAL_CERTIFICATE",
    label: "Certificate of Good Moral Character",
  },
  { value: "MEDICAL_CERTIFICATE", label: "Medical Certificate" },
  { value: "MEDICAL_EVALUATION", label: "Medical Evaluation" },
  { value: "PEPT_AE_CERTIFICATE", label: "PEPT / A&E Certificate" },
  { value: "PWD_ID", label: "PWD ID" },
  {
    value: "AFFIDAVIT_OF_UNDERTAKING",
    label: "Affidavit of Undertaking",
  },
  { value: "CONFIRMATION_SLIP", label: "Confirmation Slip" },
  {
    value: "CERTIFICATE_OF_RECOGNITION",
    label: "Certificate of Recognition in Sports",
  },
  { value: "WRITING_PORTFOLIO", label: "Writing Portfolio" },
  { value: "OTHERS", label: "Others" },
] as const;

export const BASE_DEFAULT_DOCUMENT_REQUIREMENTS: ScpDocumentRequirementDraft[] =
  [
    {
      docId: "PSA_BIRTH_CERTIFICATE",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Required for identity verification.",
    },
    {
      docId: "SF9_REPORT_CARD",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Required for latest academic record.",
    },
  ];

export const SCP_DOCUMENT_REQUIREMENT_TEMPLATES: Record<
  ScpType,
  ScpDocumentRequirementDraft[]
> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: [
    ...BASE_DEFAULT_DOCUMENT_REQUIREMENTS,
    {
      docId: "GOOD_MORAL_CERTIFICATE",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Character clearance from previous school.",
    },
    {
      docId: "MEDICAL_CERTIFICATE",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Health clearance for STE screening.",
    },
  ],
  SPECIAL_PROGRAM_IN_THE_ARTS: [...BASE_DEFAULT_DOCUMENT_REQUIREMENTS],
  SPECIAL_PROGRAM_IN_SPORTS: [
    ...BASE_DEFAULT_DOCUMENT_REQUIREMENTS,
    {
      docId: "CERTIFICATE_OF_RECOGNITION",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Proof of sports participation or achievement.",
    },
  ],
  SPECIAL_PROGRAM_IN_JOURNALISM: [
    ...BASE_DEFAULT_DOCUMENT_REQUIREMENTS,
    {
      docId: "WRITING_PORTFOLIO",
      policy: "OPTIONAL",
      phase: "EARLY_REGISTRATION",
      notes: "Sample writing outputs for evaluation.",
    },
  ],
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: [...BASE_DEFAULT_DOCUMENT_REQUIREMENTS],
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: [
    ...BASE_DEFAULT_DOCUMENT_REQUIREMENTS,
    {
      docId: "GOOD_MORAL_CERTIFICATE",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Character clearance from previous school.",
    },
    {
      docId: "MEDICAL_CERTIFICATE",
      policy: "REQUIRED",
      phase: "EARLY_REGISTRATION",
      notes: "Health clearance for workshop safety.",
    },
  ],
};

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
