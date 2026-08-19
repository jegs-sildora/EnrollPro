import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/index.js";

export const SMART_OUTCOME_ENVELOPE_KEY = "__smartOutcome";
export const SMART_OUTCOME_SCHEMA_VERSION = "enrollpro.smart-outcome.v1";

export interface StoredSmartSubjectGrades {
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  Final?: number | null;
  remarks?: string | null;
}

export interface SmartOutcomeEnvelope {
  schemaVersion: typeof SMART_OUTCOME_SCHEMA_VERSION;
  source: "SMART";
  schoolYearId: number;
  sectionId: number;
  ready: true;
  finalGeneralAverage: number;
  finalOutcome: "PROMOTED" | "RETAINED" | "CONDITIONALLY_PROMOTED";
  publishedAt: string | null;
  revision: string | null;
  synchronizedAt: string;
  checksum: string;
  subjects: Record<string, StoredSmartSubjectGrades>;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  const object = asObject(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.entries(object)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  );
}

function hashSmartSource(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function isStoredSubjectGrades(value: unknown): value is StoredSmartSubjectGrades {
  const object = asObject(value);
  if (!object) return false;
  return ["T1", "T2", "T3", "Final", "remarks"].some((key) => key in object);
}

function readSubjectMap(value: unknown): Record<string, StoredSmartSubjectGrades> | null {
  const object = asObject(value);
  if (!object) return null;
  const entries = Object.entries(object).filter(
    (entry): entry is [string, StoredSmartSubjectGrades] => isStoredSubjectGrades(entry[1]),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function buildSmartOutcomeEnvelope(input: {
  schoolYearId: number;
  sectionId: number;
  finalGeneralAverage: number;
  finalOutcome: SmartOutcomeEnvelope["finalOutcome"];
  publishedAt: string | null;
  revision: string | null;
  synchronizedAt?: string;
  subjects: Record<string, StoredSmartSubjectGrades>;
}): SmartOutcomeEnvelope {
  const source: Omit<SmartOutcomeEnvelope, "synchronizedAt" | "checksum"> = {
    schemaVersion: SMART_OUTCOME_SCHEMA_VERSION,
    source: "SMART" as const,
    schoolYearId: input.schoolYearId,
    sectionId: input.sectionId,
    ready: true as const,
    finalGeneralAverage: input.finalGeneralAverage,
    finalOutcome: input.finalOutcome,
    publishedAt: input.publishedAt,
    revision: input.revision,
    subjects: input.subjects,
  };
  return {
    ...source,
    synchronizedAt: input.synchronizedAt ?? new Date().toISOString(),
    checksum: hashSmartSource(source),
  };
}

export function readSmartOutcomeEnvelope(value: unknown): SmartOutcomeEnvelope | null {
  const root = asObject(value);
  const candidate = root ? asObject(root[SMART_OUTCOME_ENVELOPE_KEY]) : null;
  if (!candidate) return null;

  const subjects = readSubjectMap(candidate.subjects);
  const finalOutcome = candidate.finalOutcome;
  if (
    candidate.schemaVersion !== SMART_OUTCOME_SCHEMA_VERSION
    || candidate.source !== "SMART"
    || candidate.ready !== true
    || typeof candidate.schoolYearId !== "number"
    || typeof candidate.sectionId !== "number"
    || typeof candidate.finalGeneralAverage !== "number"
    || !Number.isFinite(candidate.finalGeneralAverage)
    || !["PROMOTED", "RETAINED", "CONDITIONALLY_PROMOTED"].includes(String(finalOutcome))
    || !(
      candidate.publishedAt === null
      || (
        typeof candidate.publishedAt === "string"
        && candidate.publishedAt.length > 0
        && !Number.isNaN(Date.parse(candidate.publishedAt))
      )
    )
    || typeof candidate.synchronizedAt !== "string"
    || typeof candidate.checksum !== "string"
    || !subjects
  ) {
    return null;
  }

  const envelope: SmartOutcomeEnvelope = {
    schemaVersion: SMART_OUTCOME_SCHEMA_VERSION,
    source: "SMART",
    schoolYearId: candidate.schoolYearId,
    sectionId: candidate.sectionId,
    ready: true,
    finalGeneralAverage: candidate.finalGeneralAverage,
    finalOutcome: finalOutcome as SmartOutcomeEnvelope["finalOutcome"],
    publishedAt: candidate.publishedAt,
    revision: typeof candidate.revision === "string" ? candidate.revision : null,
    synchronizedAt: candidate.synchronizedAt,
    checksum: candidate.checksum,
    subjects,
  };
  const { synchronizedAt: _synchronizedAt, checksum: _checksum, ...source } = envelope;
  return hashSmartSource(source) === envelope.checksum ? envelope : null;
}

export function mergeSmartOutcomeIntoReportedGrades(
  currentValue: unknown,
  envelope: SmartOutcomeEnvelope,
): Prisma.InputJsonObject {
  const current = asObject(currentValue) ?? {};
  const metadata = Object.fromEntries(
    Object.entries(current).filter(([key, value]) => (
      key !== SMART_OUTCOME_ENVELOPE_KEY && !isStoredSubjectGrades(value)
    )),
  );
  return {
    ...metadata,
    [SMART_OUTCOME_ENVELOPE_KEY]: envelope as unknown as Prisma.InputJsonObject,
  };
}

export function clearSmartOutcomeFromReportedGrades(
  currentValue: unknown,
): Prisma.InputJsonObject | typeof Prisma.DbNull {
  const current = asObject(currentValue);
  if (!current) return Prisma.DbNull;
  const metadata = Object.fromEntries(
    Object.entries(current).filter(([key, value]) => (
      key !== SMART_OUTCOME_ENVELOPE_KEY && !isStoredSubjectGrades(value)
    )),
  );
  return Object.keys(metadata).length > 0
    ? metadata as Prisma.InputJsonObject
    : Prisma.DbNull;
}

export function getStoredSmartSubjects(
  value: unknown,
): Record<string, StoredSmartSubjectGrades> | null {
  return readSmartOutcomeEnvelope(value)?.subjects ?? readSubjectMap(value);
}

export function matchesStoredSmartOutcome(input: {
  value: unknown;
  schoolYearId: number;
  sectionId: number;
  finalAverage: number | null;
  eosyStatus: string | null;
}): boolean {
  const envelope = readSmartOutcomeEnvelope(input.value);
  if (!envelope || input.finalAverage === null || input.eosyStatus === null) {
    return false;
  }
  return envelope.schoolYearId === input.schoolYearId
    && envelope.sectionId === input.sectionId
    && Math.abs(envelope.finalGeneralAverage - input.finalAverage) <= 0.01
    && envelope.finalOutcome === input.eosyStatus;
}
