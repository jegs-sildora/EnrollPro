import { LearnerType, ApplicantType } from "../../generated/prisma/index.js";

export interface EnrollmentRequirement {
  type: string;
  label: string;
  isRequired: boolean;
  isOnceOnly: boolean;
  isMet?: boolean;
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
  hasPsaVerified?: boolean;
  documentRequirements?: ScpDocumentRequirementRule[] | null;
}) {
  const {
    learnerType,
    gradeLevel,
    applicantType,
    isLwd,
    isPeptAePasser,
    hasPsaVerified,
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

  // 2. PSA Birth Certificate - Rule 1: Submitted once per school stay
  // Exempt if CONTINUING or if already verified on file
  if (learnerType !== "CONTINUING") {
    requirements.push({
      type: "PSA_BIRTH_CERTIFICATE",
      label: "PSA Birth Certificate",
      isRequired: !hasPsaVerified,
      isOnceOnly: true,
      isMet: hasPsaVerified,
      description: hasPsaVerified
        ? "✔️ Verified and Locked on File (DepEd 'Once Only' Rule)"
        : "Required once per school stay. Secondary proof accepted if unavailable.",
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

  return requirements;
}
