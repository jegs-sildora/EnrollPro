import { LearnerType, ApplicantType } from "../../generated/prisma/index.js";

export interface EnrollmentRequirement {
  type: string;
  label: string;
  isRequired: boolean;
  isOnceOnly: boolean;
  description: string;
  phase: 1 | 2;
}

interface ScpDocumentRequirementRule {
  docId: string;
  policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
  phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
  notes?: string | null;
}

const DOC_LABELS: Record<string, string> = {
  ACCOMPLISHED_APPLICATION_FORM: "Accomplished Application Form",
  PSA_BIRTH_CERTIFICATE: "PSA Birth Certificate",
  SF9_REPORT_CARD: "SF9 / Report Card",
  GOOD_MORAL_CERTIFICATE: "Certificate of Good Moral Character",
  MEDICAL_CERTIFICATE: "Medical Certificate",
  ID_PICTURE_2PCS: "1x1 or 2x2 ID Picture (2 pieces)",
  LONG_PLASTIC_ENVELOPE: "Long Plastic Envelope (1 piece)",
  CERTIFICATE_OF_RECOGNITION: "Certificates of Recognition in Sports",
  WRITING_PORTFOLIO: "Portfolio of Published Works",
};

function normalizeDocType(rawDocId: string): string {
  const token = rawDocId.trim().toUpperCase();

  switch (token) {
    case "PSA":
    case "PSA_BC":
      return "PSA_BIRTH_CERTIFICATE";
    case "SF9":
      return "SF9_REPORT_CARD";
    case "GOOD_MORAL":
      return "GOOD_MORAL_CERTIFICATE";
    case "MEDICAL_CERT":
      return "MEDICAL_CERTIFICATE";
    case "SPORTS_AWARDS":
      return "CERTIFICATE_OF_RECOGNITION";
    case "PORTFOLIO":
      return "WRITING_PORTFOLIO";
    case "APPLICATION_FORM":
      return "ACCOMPLISHED_APPLICATION_FORM";
    case "ID_PICTURE":
    case "ID_PHOTO":
      return "ID_PICTURE_2PCS";
    case "LONG_ENVELOPE":
    case "PLASTIC_ENVELOPE":
      return "LONG_PLASTIC_ENVELOPE";
    default:
      return token;
  }
}

function mapPhase(rule: ScpDocumentRequirementRule): 1 | 2 {
  return rule.phase === "ENROLLMENT" ? 2 : 1;
}

function applyDynamicDocumentRules(
  requirements: EnrollmentRequirement[],
  documentRequirements: ScpDocumentRequirementRule[],
): EnrollmentRequirement[] {
  const byType = new Map<string, EnrollmentRequirement>();
  for (const requirement of requirements) {
    byType.set(requirement.type, requirement);
  }

  for (const rule of documentRequirements) {
    const type = normalizeDocType(rule.docId);

    if (rule.policy === "HIDDEN") {
      byType.delete(type);
      continue;
    }

    byType.set(type, {
      type,
      label: DOC_LABELS[type] ?? type.replace(/_/g, " "),
      isRequired: rule.policy === "REQUIRED",
      isOnceOnly: type === "PSA_BIRTH_CERTIFICATE",
      description:
        rule.notes?.trim() ||
        "Dynamic SCP requirement configured by school settings.",
      phase: mapPhase(rule),
    });
  }

  return Array.from(byType.values());
}

/**
 * Determines the mandatory documentary requirements based on DO 017, s. 2025.
 */
export function getRequiredDocuments(params: {
  learnerType: LearnerType;
  gradeLevel: string;
  applicantType: ApplicantType;
  isLwd: boolean;
  isPeptAePasser?: boolean;
  documentRequirements?: ScpDocumentRequirementRule[] | null;
}) {
  const {
    learnerType,
    gradeLevel,
    applicantType,
    isLwd,
    isPeptAePasser,
    documentRequirements,
  } = params;
  const requirements: EnrollmentRequirement[] = [];

  // 1. Enrollment Forms - Phase 2 requirements
  if (learnerType === "CONTINUING") {
    // Continuing learners only need Confirmation Slip
    requirements.push({
      type: "CONFIRMATION_SLIP",
      label: "Enrollment Confirmation Slip (Annex C)",
      isRequired: true,
      isOnceOnly: false,
      description: "Simple form confirming intent to continue",
      phase: 2,
    });
  }

  // 2. PSA Birth Certificate - Rule 1: Submitted once per school
  if (learnerType !== "CONTINUING") {
    requirements.push({
      type: "PSA_BIRTH_CERTIFICATE",
      label: "PSA Birth Certificate",
      isRequired: true,
      isOnceOnly: true,
      description:
        "Required once per school stay. Secondary proof accepted if unavailable.",
      phase: 1,
    });
  }

  // 3. school records (SF9 / Report Card)
  if (learnerType === "NEW_ENROLLEE") {
    const prevGrade = gradeLevel === "7" ? "6" : "10";
    requirements.push({
      type: "SF9_REPORT_CARD",
      label: `SF9 (Grade ${prevGrade} Report Card)`,
      isRequired: true,
      isOnceOnly: false,
      description: `Proof of Grade ${prevGrade} completion`,
      phase: 1,
    });
  } else if (learnerType === "TRANSFEREE") {
    requirements.push({
      type: "SF9_REPORT_CARD",
      label: "Most Recent SF9 (Report Card)",
      isRequired: true,
      isOnceOnly: false,
      description: "From previous school",
      phase: 1,
    });
  } else if (learnerType === "RETURNING") {
    requirements.push({
      type: "ACADEMIC_RECORD",
      label: "Most Recent Academic Record",
      isRequired: true,
      isOnceOnly: false,
      description:
        "SF9, certification, or any prior record (flexible for Balik-Aral)",
      phase: 1,
    });
  }

  // 4. PEPT / A&E Certificate
  if (isPeptAePasser) {
    requirements.push({
      type: "PEPT_AE_CERTIFICATE",
      label: "PEPT/A&E Certificate of Rating",
      isRequired: true,
      isOnceOnly: false,
      description: "Required for PEPT/A&E passers",
      phase: 1,
    });
  }

  // 5. LWD Requirements
  if (isLwd) {
    requirements.push({
      type: "PWD_ID",
      label: "PWD ID",
      isRequired: false, // Optional but encouraged
      isOnceOnly: false,
      description: "If available, for support services",
      phase: 2,
    });
    requirements.push({
      type: "MEDICAL_EVALUATION",
      label: "Medical Evaluation/Diagnosis",
      isRequired: false, // Optional but encouraged
      isOnceOnly: false,
      description: "From a Licensed Medical Specialist",
      phase: 2,
    });
  }

  // 6. Transferee specific: Affidavit of Undertaking
  if (learnerType === "TRANSFEREE") {
    requirements.push({
      type: "AFFIDAVIT_OF_UNDERTAKING",
      label: "Affidavit of Undertaking",
      isRequired: false, // Only if unpaid fees at private school
      isOnceOnly: false,
      description:
        "Required only if there are unpaid fees at the previous private school",
      phase: 2,
    });
  }

  // 7. SCP-specific requirements: dynamic first, hardcoded fallback
  const hasDynamicRules =
    Array.isArray(documentRequirements) && documentRequirements.length > 0;

  if (hasDynamicRules) {
    return applyDynamicDocumentRules(requirements, documentRequirements);
  }

  if (applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
    requirements.push(
      {
        type: "GOOD_MORAL_CERTIFICATE",
        label: "Certificate of Good Moral Character",
        isRequired: true,
        isOnceOnly: false,
        description: "Issued by previous school principal/adviser.",
        phase: 1,
      },
      {
        type: "MEDICAL_CERTIFICATE",
        label: "Medical Certificate",
        isRequired: true,
        isOnceOnly: false,
        description: "Physical health clearance for STE admission.",
        phase: 1,
      },
      {
        type: "ID_PICTURE_2PCS",
        label: "1x1 or 2x2 ID Picture (2 pieces)",
        isRequired: true,
        isOnceOnly: false,
        description: "Required for STE application profiling and records.",
        phase: 1,
      },
      {
        type: "LONG_PLASTIC_ENVELOPE",
        label: "Long Plastic Envelope (1 piece)",
        isRequired: true,
        isOnceOnly: false,
        description:
          "Required for organizing and submitting documentary records.",
        phase: 1,
      },
    );
  }

  if (applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
    requirements.push({
      type: "ACCOMPLISHED_APPLICATION_FORM",
      label: "Accomplished Application Form",
      isRequired: true,
      isOnceOnly: false,
      description: "Program-specific SPA application form.",
      phase: 1,
    });
  }

  if (applicantType === "SPECIAL_PROGRAM_IN_SPORTS") {
    requirements.push(
      {
        type: "ACCOMPLISHED_APPLICATION_FORM",
        label: "Accomplished Application Form",
        isRequired: true,
        isOnceOnly: false,
        description: "Program-specific SPS application form.",
        phase: 1,
      },
      {
        type: "MEDICAL_CERTIFICATE",
        label: "Strict Medical Certificate",
        isRequired: true,
        isOnceOnly: false,
        description: "Clearing for intense physical activity/tryouts.",
        phase: 1,
      },
      {
        type: "CERTIFICATE_OF_RECOGNITION",
        label: "Certificates of Recognition in Sports",
        isRequired: true,
        isOnceOnly: false,
        description: "Proof of participation or achievement in sports.",
        phase: 1,
      },
    );
  }

  if (applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM") {
    requirements.push(
      {
        type: "ACCOMPLISHED_APPLICATION_FORM",
        label: "Accomplished Application Form",
        isRequired: true,
        isOnceOnly: false,
        description: "Program-specific SPJ application form.",
        phase: 1,
      },
      {
        type: "WRITING_PORTFOLIO",
        label: "Portfolio of Published Works",
        isRequired: false,
        isOnceOnly: false,
        description: "Recommended if available.",
        phase: 1,
      },
    );
  }

  if (applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE") {
    requirements.push({
      type: "ACCOMPLISHED_APPLICATION_FORM",
      label: "Accomplished Application Form",
      isRequired: true,
      isOnceOnly: false,
      description: "Program-specific SPFL application form.",
      phase: 1,
    });
  }

  if (applicantType === "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION") {
    requirements.push(
      {
        type: "ACCOMPLISHED_APPLICATION_FORM",
        label: "Accomplished Application Form",
        isRequired: true,
        isOnceOnly: false,
        description: "Program-specific SPTVE application form.",
        phase: 1,
      },
      {
        type: "GOOD_MORAL_CERTIFICATE",
        label: "Certificate of Good Moral Character",
        isRequired: true,
        isOnceOnly: false,
        description: "Issued by previous school principal/adviser.",
        phase: 1,
      },
    );
  }

  return requirements;
}
