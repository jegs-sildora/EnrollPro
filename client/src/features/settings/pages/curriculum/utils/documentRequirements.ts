import type { ScpDocumentRequirementInput, ScpType } from "@enrollpro/shared";
import {
  DOCUMENT_PHASE_OPTIONS,
  DOCUMENT_POLICY_OPTIONS,
  SCP_DOCUMENT_REQUIREMENT_TEMPLATES,
} from "../constants";
import type {
  ScpDocumentPhase,
  ScpDocumentPolicy,
  ScpDocumentRequirementDraft,
} from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createEmptyDocumentRequirement(): ScpDocumentRequirementDraft {
  return {
    docId: "",
    policy: "REQUIRED",
    phase: "EARLY_REGISTRATION",
    notes: null,
  };
}

export function normalizeDocumentRequirements(
  rawValue: unknown,
): ScpDocumentRequirementDraft[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  const normalized: ScpDocumentRequirementDraft[] = [];

  for (const item of rawValue) {
    if (!isRecord(item)) {
      continue;
    }

    const rawDocId = item.docId;
    const rawPolicy = item.policy;
    const rawPhase = item.phase;
    const rawNotes = item.notes;

    const docId =
      typeof rawDocId === "string" ? rawDocId.trim().toUpperCase() : "";
    if (!docId) {
      continue;
    }

    const policy = DOCUMENT_POLICY_OPTIONS.some(
      (option) => option.value === rawPolicy,
    )
      ? (rawPolicy as ScpDocumentPolicy)
      : "REQUIRED";

    const phase = DOCUMENT_PHASE_OPTIONS.some(
      (option) => option.value === rawPhase,
    )
      ? (rawPhase as ScpDocumentPhase)
      : null;

    const notes =
      typeof rawNotes === "string" && rawNotes.trim().length > 0
        ? rawNotes.trim()
        : null;

    normalized.push({
      docId,
      policy,
      phase,
      notes,
    });
  }

  return normalized;
}

export function getSuggestedDocumentRequirements(
  scpType: string,
): ScpDocumentRequirementDraft[] {
  const suggested = SCP_DOCUMENT_REQUIREMENT_TEMPLATES[scpType as ScpType] ?? [];
  return suggested.map((requirement) => ({ ...requirement }));
}

export function normalizeDocumentRequirementsForSave(
  requirements: ScpDocumentRequirementDraft[],
): ScpDocumentRequirementInput[] | null {
  const normalized: ScpDocumentRequirementInput[] = [];

  for (const requirement of requirements) {
    const docId = requirement.docId.trim().toUpperCase();
    if (!docId) {
      continue;
    }

    const policy: ScpDocumentPolicy = DOCUMENT_POLICY_OPTIONS.some(
      (option) => option.value === requirement.policy,
    )
      ? requirement.policy
      : "REQUIRED";

    const phase: ScpDocumentPhase | null = DOCUMENT_PHASE_OPTIONS.some(
      (option) => option.value === requirement.phase,
    )
      ? requirement.phase
      : null;

    normalized.push({
      docId,
      policy,
      phase,
      notes: requirement.notes?.trim() || null,
    });
  }

  return normalized.length > 0 ? normalized : null;
}
