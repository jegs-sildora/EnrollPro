import { Request, Response, NextFunction } from "express";
import { prisma } from "../../lib/prisma.js";
import { auditLog } from "../audit-logs/audit-logs.service.js";
import { AppError } from "../../lib/AppError.js";
import { normalizeDateToUtcNoon } from "../school-year/school-year.service.js";
import { getRequiredDocuments } from "../enrollment/enrollment-requirement.service.js";
import fs from "fs";
import { saveBase64Image } from "../../lib/fileUploader.js";
import {
  AcademicStatus,
  ApplicantType,
  LearnerType,
  FamilyRelationship,
  ApplicationStatus,
  AdmissionChannel,
  PrimaryContactType,
  Prisma,
} from "../../generated/prisma/index.js";
import {
  createEarlyRegistrationSharedService,
  createInitialTrackingPayload,
} from "../admission/services/early-registration-shared.service.js";
import { createAdmissionControllerDeps } from "../admission/services/admission-controller.deps.js";

const sharedService = createEarlyRegistrationSharedService(
  createAdmissionControllerDeps(),
);

// ── Helpers ──

/** Recursively converts all string values to uppercase and trims them. */
function toUpperCaseRecursive(obj: unknown): unknown {
  const skipKeys = ["contactNumber", "email", "emailAddress", "studentPhoto"];

  if (Array.isArray(obj)) {
    return obj.map((v) => toUpperCaseRecursive(v));
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      if (skipKeys.includes(key)) {
        newObj[key] = (obj as Record<string, unknown>)[key];
      } else {
        newObj[key] = toUpperCaseRecursive(
          (obj as Record<string, unknown>)[key],
        );
      }
    }
    return newObj;
  } else if (typeof obj === "string") {
    return obj.trim().toUpperCase();
  }
  return obj;
}

/** Calculate age from birthdate in Asia/Manila timezone. */
function calculateAge(birthdate: Date): number {
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const monthDiff = now.getMonth() - birthdate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getDate() < birthdate.getDate())
  ) {
    age--;
  }
  return age;
}

const LEARNER_TYPE_VALUES = new Set([
  "NEW_ENROLLEE",
  "TRANSFEREE",
  "RETURNING",
  "CONTINUING",
  "OSCYA",
  "ALS",
]);

const PRIMARY_CONTACT_VALUES = new Set(["FATHER", "MOTHER", "GUARDIAN"]);

const APPLICANT_TYPE_VALUES = new Set([
  "REGULAR",
  "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  "SPECIAL_PROGRAM_IN_THE_ARTS",
  "SPECIAL_PROGRAM_IN_SPORTS",
  "SPECIAL_PROGRAM_IN_JOURNALISM",
  "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
  "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
]);

// ── Lifecycle Transitions ────────────────────────────────────

const EARLY_REG_TRANSITIONS: Record<string, ApplicationStatus[]> = {
  SUBMITTED: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  SUBMITTED_BEERF: [
    "VERIFIED",
    "UNDER_REVIEW",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  VERIFIED: [
    "UNDER_REVIEW",
    "ELIGIBLE",
    "ENROLLED",
    "TEMPORARILY_ENROLLED",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  UNDER_REVIEW: [
    "VERIFIED",
    "FOR_REVISION",
    "ELIGIBLE",
    "EXAM_SCHEDULED",
    "REJECTED",
    "WITHDRAWN",
  ],
  FOR_REVISION: ["UNDER_REVIEW", "WITHDRAWN"],
  ELIGIBLE: ["EXAM_SCHEDULED", "PASSED", "WITHDRAWN"],
  EXAM_SCHEDULED: [
    "PASSED",
    "SUBMITTED_BEERF",
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "INTERVIEW_SCHEDULED",
    "WITHDRAWN",
  ],
  ASSESSMENT_TAKEN: [
    "PASSED",
    "SUBMITTED_BEERF",
    "FAILED_ASSESSMENT",
    "ASSESSMENT_TAKEN",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  PASSED: [
    "READY_FOR_ENROLLMENT",
    "INTERVIEW_SCHEDULED",
    "EXAM_SCHEDULED",
    "WITHDRAWN",
  ],
  INTERVIEW_SCHEDULED: [
    "PASSED",
    "READY_FOR_ENROLLMENT",
    "SUBMITTED_BEERF",
    "WITHDRAWN",
  ],
  READY_FOR_ENROLLMENT: [
    "ENROLLED",
    "TEMPORARILY_ENROLLED",
    "REJECTED",
    "WITHDRAWN",
  ],
  TEMPORARILY_ENROLLED: ["ENROLLED", "WITHDRAWN"],
  ENROLLED: ["WITHDRAWN"],
  FAILED_ASSESSMENT: ["UNDER_REVIEW", "WITHDRAWN", "REJECTED"],
  REJECTED: ["UNDER_REVIEW", "WITHDRAWN"],
  WITHDRAWN: [],
};

function assertEarlyRegTransition(
  current: ApplicationStatus,
  target: ApplicationStatus,
  contextMessage?: string,
): void {
  if (!(EARLY_REG_TRANSITIONS[current]?.includes(target) ?? false)) {
    throw new AppError(
      422,
      contextMessage ?? `Cannot transition from "${current}" to "${target}".`,
    );
  }
}

const LEGACY_APPLICATION_STATUS_UPDATES = [
  `
    UPDATE early_registration_applications
    SET status = CASE status::text
      WHEN 'EARLY_REG_SUBMITTED' THEN 'SUBMITTED_BEERF'::application_status
      WHEN 'SUBMITTED' THEN 'SUBMITTED_BEERF'::application_status
      WHEN 'PENDING_VERIFICATION' THEN 'UNDER_REVIEW'::application_status
      WHEN 'PRE_REGISTERED' THEN 'READY_FOR_ENROLLMENT'::application_status
      WHEN 'READY_FOR_SECTIONING' THEN 'READY_FOR_ENROLLMENT'::application_status
      WHEN 'OFFICIALLY_ENROLLED' THEN 'ENROLLED'::application_status
    END
    WHERE status::text IN (
      'EARLY_REG_SUBMITTED',
      'SUBMITTED',
      'PENDING_VERIFICATION',
      'PRE_REGISTERED',
      'READY_FOR_SECTIONING',
      'OFFICIALLY_ENROLLED'
    )
  `,
  `
    UPDATE enrollment_applications
    SET status = CASE status::text
      WHEN 'EARLY_REG_SUBMITTED' THEN 'SUBMITTED_BEEF'::application_status
      WHEN 'SUBMITTED' THEN 'SUBMITTED_BEEF'::application_status
      WHEN 'PENDING_VERIFICATION' THEN 'UNDER_REVIEW'::application_status
      WHEN 'PRE_REGISTERED' THEN 'READY_FOR_ENROLLMENT'::application_status
      WHEN 'READY_FOR_SECTIONING' THEN 'READY_FOR_ENROLLMENT'::application_status
      WHEN 'OFFICIALLY_ENROLLED' THEN 'ENROLLED'::application_status
    END
    WHERE status::text IN (
      'EARLY_REG_SUBMITTED',
      'SUBMITTED',
      'PENDING_VERIFICATION',
      'PRE_REGISTERED',
      'READY_FOR_SECTIONING',
      'OFFICIALLY_ENROLLED'
    )
  `,
] as const;

let normalizeLegacyStatusPromise: Promise<void> | null = null;

async function ensureLegacyApplicationStatusesNormalized(): Promise<void> {
  if (normalizeLegacyStatusPromise) {
    await normalizeLegacyStatusPromise;
    return;
  }

  // Convert legacy status values once per process so Prisma can read rows safely.
  normalizeLegacyStatusPromise = prisma
    .$transaction(
      LEGACY_APPLICATION_STATUS_UPDATES.map((statement) =>
        prisma.$executeRawUnsafe(statement),
      ),
    )
    .then(() => undefined)
    .catch((error) => {
      normalizeLegacyStatusPromise = null;
      throw error;
    });

  await normalizeLegacyStatusPromise;
}

function isPreviousSchoolIncludeCompatibilityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      const target = String(error.meta?.table ?? error.meta?.column ?? "");
      if (
        /enrollment_previous_schools|enrollment_applications|previousSchool/i.test(
          target,
        )
      ) {
        return true;
      }
    }
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  return /enrollment_previous_schools|previousSchool|EnrollmentPreviousSchool/i.test(
    message,
  );
}

function isEarlyRegistrationListCompatibilityError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (["P2021", "P2022", "P2023"].includes(error.code)) {
      return true;
    }
  }

  const message =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  return /application_status|ApplicationStatus|invalid input value for enum|Error converting field|column.*does not exist|relation.*does not exist/i.test(
    message,
  );
}

type EarlyRegistrationListRawRow = {
  id: number;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  createdAt: Date | string;
  lrn: string | null;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  isPendingLrnCreation: boolean;
  gradeLevelName: string;
};

function toIsoStringSafe(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

async function fetchEarlyRegistrationListRawFallback(params: {
  schoolYearId: number;
  search: string;
  status: string;
  applicantType: string;
  withoutLrn: boolean;
  page: number;
  limit: number;
  gradeLevelIds: number[];
}): Promise<{ data: Array<Record<string, unknown>>; total: number }> {
  const {
    schoolYearId,
    search,
    status,
    applicantType,
    withoutLrn,
    page,
    limit,
    gradeLevelIds,
  } = params;

  const whereClauses: Prisma.Sql[] = [
    Prisma.sql`e.school_year_id = ${schoolYearId}`,
  ];

  const normalizedStatus = status.trim().toUpperCase();
  if (normalizedStatus && normalizedStatus !== "ALL") {
    if (normalizedStatus === "SUBMITTED") {
      whereClauses.push(
        Prisma.sql`e.status::text IN (${Prisma.join([
          "SUBMITTED_BEERF",
          "SUBMITTED_BEEF",
          "SUBMITTED",
          "EARLY_REG_SUBMITTED",
        ])})`,
      );
    } else {
      whereClauses.push(Prisma.sql`e.status::text = ${normalizedStatus}`);
    }
  }

  const normalizedApplicantType = applicantType.trim().toUpperCase();
  if (normalizedApplicantType && normalizedApplicantType !== "ALL") {
    whereClauses.push(
      Prisma.sql`e.applicant_type::text = ${normalizedApplicantType}`,
    );
  }

  if (gradeLevelIds.length > 0) {
    whereClauses.push(
      Prisma.sql`e.grade_level_id IN (${Prisma.join(gradeLevelIds)})`,
    );
  }

  if (withoutLrn) {
    whereClauses.push(Prisma.sql`l.is_pending_lrn_creation = TRUE`);
  }

  if (search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    whereClauses.push(
      Prisma.sql`(
        l.last_name ILIKE ${searchPattern}
        OR l.first_name ILIKE ${searchPattern}
        OR COALESCE(l.lrn, '') ILIKE ${searchPattern}
      )`,
    );
  }

  const whereSql = Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}`;

  const rows = await prisma.$queryRaw<EarlyRegistrationListRawRow[]>(Prisma.sql`
    SELECT
      e.id,
      e.tracking_number AS "trackingNumber",
      e.status::text AS status,
      e.applicant_type::text AS "applicantType",
      e.grade_level_id AS "gradeLevelId",
      e.created_at AS "createdAt",
      l.lrn,
      l.first_name AS "firstName",
      l.last_name AS "lastName",
      l.middle_name AS "middleName",
      l.extension_name AS suffix,
      l.is_pending_lrn_creation AS "isPendingLrnCreation",
      g.name AS "gradeLevelName"
    FROM early_registration_applications e
    INNER JOIN learners l ON l.id = e.learner_id
    INNER JOIN grade_levels g ON g.id = e.grade_level_id
    ${whereSql}
    ORDER BY e.created_at DESC
    OFFSET ${(page - 1) * limit}
    LIMIT ${limit}
  `);

  const countRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>(
    Prisma.sql`
      SELECT COUNT(*) AS total
      FROM early_registration_applications e
      INNER JOIN learners l ON l.id = e.learner_id
      INNER JOIN grade_levels g ON g.id = e.grade_level_id
      ${whereSql}
    `,
  );

  const totalRaw = countRows[0]?.total ?? 0;
  const total =
    typeof totalRaw === "bigint" ? Number(totalRaw) : Number(totalRaw || 0);

  const data = rows.map((row) => {
    const normalizedLrn = String(row.lrn ?? "").trim();

    return {
      id: row.id,
      lrn: normalizedLrn,
      firstName: row.firstName,
      lastName: row.lastName,
      middleName: row.middleName,
      suffix: row.suffix,
      trackingNumber: row.trackingNumber,
      status: row.status,
      applicantType: row.applicantType,
      gradeLevelId: row.gradeLevelId,
      gradeLevel: { name: row.gradeLevelName },
      createdAt: toIsoStringSafe(row.createdAt),
      isPendingLrnCreation: row.isPendingLrnCreation,
      learner: {
        firstName: row.firstName,
        lastName: row.lastName,
        middleName: row.middleName,
        extensionName: row.suffix,
        lrn: normalizedLrn,
        isPendingLrnCreation: row.isPendingLrnCreation,
      },
      assessments: [],
      generalAverage: null,
    };
  });

  return {
    data,
    total,
  };
}

let earlyRegListSupportsPreviousSchoolInclude: boolean | null = null;
let earlyRegListPrismaCompatible: boolean | null = null;
let earlyRegListFallbackModeLogged = false;

function logEarlyRegListFallbackModeWarning(
  message: string,
  error?: unknown,
): void {
  if (earlyRegListFallbackModeLogged) {
    return;
  }

  earlyRegListFallbackModeLogged = true;
  if (error) {
    console.warn(`[index Warning] ${message}`, error);
    return;
  }

  console.warn(`[index Warning] ${message}`);
}

const DOCUMENT_CHECKLIST_MAPPING: Record<string, string> = {
  PSA_BIRTH_CERTIFICATE: "isPsaBirthCertPresented",
  SECONDARY_BIRTH_PROOF: "isPsaBirthCertPresented",
  SF9_REPORT_CARD: "isSf9Submitted",
  SF10_PERMANENT_RECORD: "isSf10Requested",
  GOOD_MORAL_CERTIFICATE: "isGoodMoralPresented",
  MEDICAL_CERTIFICATE: "isMedicalEvalSubmitted",
  MEDICAL_EVALUATION: "isMedicalEvalSubmitted",
  CERTIFICATE_OF_RECOGNITION: "isCertOfRecognitionPresented",
  UNDERTAKING: "isUndertakingSigned",
  AFFIDAVIT_OF_UNDERTAKING: "isUndertakingSigned",
  CONFIRMATION_SLIP: "isConfirmationSlipReceived",
};

const CHECKLIST_BOOLEAN_KEYS = [
  "isPsaBirthCertPresented",
  "isOriginalPsaBcCollected",
  "isSf9Submitted",
  "isSf10Requested",
  "isGoodMoralPresented",
  "isMedicalEvalSubmitted",
  "isCertOfRecognitionPresented",
  "isUndertakingSigned",
  "isConfirmationSlipReceived",
] as const;

type ChecklistBooleanKey = (typeof CHECKLIST_BOOLEAN_KEYS)[number];
type ChecklistPatch = Partial<Record<ChecklistBooleanKey, boolean>>;
type AcademicStatusValue = "PROMOTED" | "RETAINED";

const DEFAULT_ACADEMIC_STATUS: AcademicStatusValue = "PROMOTED";

const CHECKLIST_FIELD_LABELS: Record<ChecklistBooleanKey, string> = {
  isPsaBirthCertPresented: "PSA Birth Certificate",
  isOriginalPsaBcCollected: "Original PSA Copy Collected",
  isSf9Submitted: "SF9 / Report Card",
  isSf10Requested: "SF10 (Permanent Record)",
  isGoodMoralPresented: "Good Moral Certificate",
  isMedicalEvalSubmitted: "Medical Evaluation",
  isCertOfRecognitionPresented: "Certificate of Recognition",
  isUndertakingSigned: "Affidavit of Undertaking",
  isConfirmationSlipReceived: "Confirmation Slip",
};

const DEFAULT_BATCH_VERIFY_COLUMNS: Array<{
  key: ChecklistBooleanKey;
  label: string;
  isMandatory: boolean;
}> = [
  {
    key: "isPsaBirthCertPresented",
    label: CHECKLIST_FIELD_LABELS.isPsaBirthCertPresented,
    isMandatory: true,
  },
  {
    key: "isSf9Submitted",
    label: CHECKLIST_FIELD_LABELS.isSf9Submitted,
    isMandatory: true,
  },
  {
    key: "isConfirmationSlipReceived",
    label: CHECKLIST_FIELD_LABELS.isConfirmationSlipReceived,
    isMandatory: false,
  },
  {
    key: "isUndertakingSigned",
    label: CHECKLIST_FIELD_LABELS.isUndertakingSigned,
    isMandatory: false,
  },
];

interface BatchSuccessItem {
  id: number;
  name: string;
  trackingNumber: string;
}

interface BatchFailureItem extends BatchSuccessItem {
  reason: string;
}

interface ScpDocumentRequirementRuleInput {
  docId: string;
  policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
  phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
  notes?: string | null;
}

interface RankingFormulaComponentInput {
  key: string;
  label: string;
  weight: number;
}

interface ScpConfigLite {
  cutoffScore: number | null;
  rankingFormula: Prisma.JsonValue | null;
  steps: Array<{
    stepOrder: number;
    kind: string;
    label: string;
    isRequired: boolean;
    cutoffScore: number | null;
    scheduledDate: Date | null;
    scheduledTime: string | null;
    venue: string | null;
    notes: string | null;
  }>;
}

function isChecklistBooleanKey(value: string): value is ChecklistBooleanKey {
  return (CHECKLIST_BOOLEAN_KEYS as readonly string[]).includes(value);
}

function toBatchReason(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatBatchName(firstName: string, lastName: string): string {
  return `${lastName}, ${firstName}`;
}

function extractChecklistState(
  source: unknown,
): Record<ChecklistBooleanKey, boolean> {
  const state = {} as Record<ChecklistBooleanKey, boolean>;
  const row =
    source && typeof source === "object"
      ? (source as Record<string, unknown>)
      : null;

  for (const key of CHECKLIST_BOOLEAN_KEYS) {
    state[key] = Boolean(row?.[key]);
  }

  return state;
}

function extractChecklistAcademicStatus(source: unknown): AcademicStatusValue {
  if (!source || typeof source !== "object") {
    return DEFAULT_ACADEMIC_STATUS;
  }

  const raw = String(
    (source as Record<string, unknown>).academicStatus ??
      DEFAULT_ACADEMIC_STATUS,
  )
    .trim()
    .toUpperCase();

  return raw === "RETAINED" ? "RETAINED" : DEFAULT_ACADEMIC_STATUS;
}

function extractChecklistPatch(source: unknown): ChecklistPatch {
  if (!source || typeof source !== "object") return {};
  const row = source as Record<string, unknown>;
  const patch: ChecklistPatch = {};

  for (const [key, value] of Object.entries(row)) {
    if (!isChecklistBooleanKey(key) || typeof value !== "boolean") continue;
    patch[key] = value;
  }

  return patch;
}

function normalizeAcademicStatus(value: unknown): AcademicStatusValue {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return normalized === "RETAINED" ? "RETAINED" : DEFAULT_ACADEMIC_STATUS;
}

function resolveBatchVerifyTarget(
  status: ApplicationStatus,
  applicantType: ApplicantType,
): ApplicationStatus | null {
  if (applicantType === "REGULAR") {
    if (status === "UNDER_REVIEW") return "VERIFIED";
    if (status === "SUBMITTED_BEERF") return "VERIFIED";
    return null;
  }

  if (status === "SUBMITTED_BEERF") return "VERIFIED";
  if (status === "VERIFIED" || status === "UNDER_REVIEW") return "ELIGIBLE";
  return null;
}

function parseScpDocumentRequirementRules(
  value: Prisma.JsonValue | null | undefined,
): ScpDocumentRequirementRuleInput[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: ScpDocumentRequirementRuleInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    const row = entry as Record<string, unknown>;
    const docId = String(row.docId ?? "").trim();
    const policyToken = String(row.policy ?? "")
      .trim()
      .toUpperCase();

    if (!docId) continue;
    if (
      policyToken !== "REQUIRED" &&
      policyToken !== "OPTIONAL" &&
      policyToken !== "HIDDEN"
    ) {
      continue;
    }

    const phaseToken = String(row.phase ?? "")
      .trim()
      .toUpperCase();
    const phase: "EARLY_REGISTRATION" | "ENROLLMENT" | null =
      phaseToken === "EARLY_REGISTRATION" || phaseToken === "ENROLLMENT"
        ? (phaseToken as "EARLY_REGISTRATION" | "ENROLLMENT")
        : null;

    parsed.push({
      docId,
      policy: policyToken as "REQUIRED" | "OPTIONAL" | "HIDDEN",
      phase,
      notes: row.notes == null ? null : String(row.notes),
    });
  }

  return parsed;
}

function mapRequirementsToChecklistColumns(
  requirements: Array<{
    type: string;
    label: string;
    isRequired: boolean;
  }>,
): Array<{ key: ChecklistBooleanKey; label: string; isMandatory: boolean }> {
  const columns = new Map<
    ChecklistBooleanKey,
    { label: string; isMandatory: boolean }
  >();

  for (const requirement of requirements) {
    const mappedKey = DOCUMENT_CHECKLIST_MAPPING[requirement.type];
    if (!mappedKey || !isChecklistBooleanKey(mappedKey)) continue;

    const existing = columns.get(mappedKey);
    columns.set(mappedKey, {
      label: requirement.label || CHECKLIST_FIELD_LABELS[mappedKey],
      isMandatory: Boolean(existing?.isMandatory || requirement.isRequired),
    });
  }

  return Array.from(columns.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    isMandatory: value.isMandatory,
  }));
}

function computeMissingMandatoryRequirements(
  requirements: Array<{
    type: string;
    label: string;
    isRequired: boolean;
  }>,
  checklist: Record<ChecklistBooleanKey, boolean>,
): string[] {
  const missing: string[] = [];

  for (const requirement of requirements) {
    if (!requirement.isRequired) continue;

    const mappedKey = DOCUMENT_CHECKLIST_MAPPING[requirement.type];
    if (!mappedKey || !isChecklistBooleanKey(mappedKey)) continue;

    if (!checklist[mappedKey]) {
      missing.push(requirement.label || CHECKLIST_FIELD_LABELS[mappedKey]);
    }
  }

  return missing;
}

function parseRankingFormulaComponents(
  rankingFormula: Prisma.JsonValue | null | undefined,
): RankingFormulaComponentInput[] {
  if (
    !rankingFormula ||
    typeof rankingFormula !== "object" ||
    Array.isArray(rankingFormula)
  ) {
    return [];
  }

  const componentsRaw = (rankingFormula as Record<string, unknown>).components;
  if (!Array.isArray(componentsRaw)) return [];

  const parsed: RankingFormulaComponentInput[] = [];

  for (const component of componentsRaw) {
    if (
      !component ||
      typeof component !== "object" ||
      Array.isArray(component)
    ) {
      continue;
    }

    const row = component as Record<string, unknown>;
    const key = String(row.key ?? "")
      .trim()
      .toUpperCase();
    const weight = Number(row.weight ?? NaN);

    if (!key || !Number.isFinite(weight) || weight <= 0) continue;

    parsed.push({
      key,
      label: String(row.label ?? key).trim() || key,
      weight,
    });
  }

  return parsed;
}

function resolveWeightedTotalScore(
  explicitTotal: number | null | undefined,
  componentScores: Record<string, number>,
  components: RankingFormulaComponentInput[],
): number | null {
  if (typeof explicitTotal === "number" && Number.isFinite(explicitTotal)) {
    return explicitTotal;
  }

  if (components.length === 0) {
    const firstScore = Object.values(componentScores).find((score) =>
      Number.isFinite(score),
    );
    return typeof firstScore === "number" ? firstScore : null;
  }

  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const useFractionalWeights = totalWeight <= 1.0001;

  let total = 0;
  let hasAtLeastOneScore = false;

  for (const component of components) {
    const rawScore = componentScores[component.key];
    if (!Number.isFinite(rawScore)) continue;

    hasAtLeastOneScore = true;
    const normalizedWeight = useFractionalWeights
      ? component.weight
      : component.weight / 100;

    total += rawScore * normalizedWeight;
  }

  if (!hasAtLeastOneScore) return null;
  return Number(total.toFixed(2));
}

function summarizeComponentScores(
  componentScores: Record<string, number>,
): string {
  const entries = Object.entries(componentScores).filter(([, score]) =>
    Number.isFinite(score),
  );
  if (entries.length === 0) return "";

  return entries
    .map(([key, score]) => `${key}=${Number(score).toFixed(2)}`)
    .join("; ");
}

function resolveAssessmentFailureReason(input: {
  isNoShow: boolean;
  totalScore: number;
  effectiveCutoff: number | null | undefined;
}): string {
  if (input.isNoShow) {
    return "Marked absent during the qualifying assessment.";
  }

  const resolvedScore = Number(input.totalScore).toFixed(2);
  if (
    typeof input.effectiveCutoff === "number" &&
    Number.isFinite(input.effectiveCutoff)
  ) {
    return `Score ${resolvedScore} did not meet the cut-off score ${Number(
      input.effectiveCutoff,
    ).toFixed(2)}.`;
  }

  return `Did not pass the qualifying assessment with score ${resolvedScore}.`;
}

function normalizeBatchScheduledDate(value: string | Date): Date {
  const dateValue = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    throw new AppError(422, "Invalid scheduled date.");
  }
  return normalizeDateToUtcNoon(dateValue);
}

async function getScpConfigCached(
  cache: Map<string, ScpConfigLite | null>,
  schoolYearId: number,
  applicantType: ApplicantType,
): Promise<ScpConfigLite | null> {
  if (applicantType === "REGULAR") return null;

  const cacheKey = `${schoolYearId}:${applicantType}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? null;
  }

  const config = await prisma.scpProgramConfig.findUnique({
    where: {
      uq_scp_program_configs_type: {
        schoolYearId,
        scpType: applicantType,
      },
    },
    include: { steps: { orderBy: { stepOrder: "asc" } } },
  });

  const normalized: ScpConfigLite | null = config
    ? {
        cutoffScore: config.cutoffScore,
        rankingFormula: config.rankingFormula,
        steps: config.steps.map((step) => ({
          stepOrder: step.stepOrder,
          kind: step.kind,
          label: step.label,
          isRequired: step.isRequired,
          cutoffScore: step.cutoffScore,
          scheduledDate: step.scheduledDate,
          scheduledTime: step.scheduledTime,
          venue: step.venue,
          notes: step.notes,
        })),
      }
    : null;

  cache.set(cacheKey, normalized);
  return normalized;
}

const LRN_REGEX = /^\d{12}$/;

type ApplicantTypeValue =
  | "REGULAR"
  | "SCIENCE_TECHNOLOGY_AND_ENGINEERING"
  | "SPECIAL_PROGRAM_IN_THE_ARTS"
  | "SPECIAL_PROGRAM_IN_SPORTS"
  | "SPECIAL_PROGRAM_IN_JOURNALISM"
  | "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
  | "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION";

function normalizeGradeLevelToken(value: unknown): string {
  const raw = String(value ?? "").trim();
  const digitMatch = raw.match(/\d+/);
  return digitMatch?.[0] ?? raw;
}

function toLearnerTypeV2(value: unknown): LearnerType | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!LEARNER_TYPE_VALUES.has(raw)) return null;
  return raw as LearnerType;
}

function canDeclareNoLrn(
  learnerType: LearnerType | null,
  normalizedGradeLevel: string,
): boolean {
  if (!learnerType) return false;
  return (
    learnerType === "TRANSFEREE" ||
    (learnerType === "NEW_ENROLLEE" && normalizedGradeLevel === "7")
  );
}

function isTruthyQuery(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function toPrimaryContactV2(value: unknown): PrimaryContactType | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!PRIMARY_CONTACT_VALUES.has(raw)) return null;
  return raw as PrimaryContactType;
}

function resolveApplicantType(
  isScpApplication: unknown,
  scpType: unknown,
): ApplicantTypeValue {
  if (!isScpApplication) {
    return "REGULAR";
  }

  const rawScpType = String(scpType ?? "")
    .trim()
    .toUpperCase();

  if (rawScpType === "REGULAR" || !APPLICANT_TYPE_VALUES.has(rawScpType)) {
    throw new AppError(400, "Selected SCP track is invalid.");
  }

  return rawScpType as ApplicantTypeValue;
}

// ── Shared store logic for both public and F2F ──

interface StoreOptions {
  channel: AdmissionChannel;
  encodedById?: number | null;
}

function mapCreateRegistrationDuplicateError(error: unknown): AppError | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return null;
  }

  const targetMeta = (error as { meta?: { target?: string[] | string } }).meta
    ?.target;
  const targets = Array.isArray(targetMeta)
    ? targetMeta.map((value) => String(value).toLowerCase())
    : typeof targetMeta === "string"
      ? [targetMeta.toLowerCase()]
      : [];

  const hasTarget = (needle: string) =>
    targets.some((target) => target.includes(needle));

  const isLrnDuplicate = hasTarget("lrn") || hasTarget("uq_learners_lrn");
  if (isLrnDuplicate) {
    return new AppError(409, "A learner with this LRN already exists.");
  }

  const isRegistrantSchoolYearDuplicate =
    hasTarget("uq_early_reg_per_sy") ||
    ((hasTarget("learnerid") || hasTarget("learner_id")) &&
      (hasTarget("schoolyearid") || hasTarget("school_year_id")));

  if (isRegistrantSchoolYearDuplicate) {
    return new AppError(
      409,
      "An early registration for this learner already exists for this School Year.",
    );
  }

  return new AppError(
    409,
    "A duplicate early registration record was detected.",
  );
}

async function createRegistration(
  req: Request,
  res: Response,
  next: NextFunction,
  options: StoreOptions,
) {
  try {
    await ensureLegacyApplicationStatusesNormalized();

    // 1. Get active school year
    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!settings?.activeSchoolYear) {
      throw new AppError(
        400,
        "No active School Year is set. Please contact the school registrar.",
      );
    }

    const activeYear = settings.activeSchoolYear;
    const body = toUpperCaseRecursive(req.body) as Record<string, any>;

    const normalizedGradeLevel = normalizeGradeLevelToken(body.gradeLevel);
    const gradeLevelV2 = await prisma.gradeLevel.findFirst({
      where: {
        schoolYearId: activeYear.id,
        OR: [
          { name: { equals: normalizedGradeLevel, mode: "insensitive" } },
          {
            name: {
              equals: `GRADE ${normalizedGradeLevel}`,
              mode: "insensitive",
            },
          },
          { name: { equals: `G${normalizedGradeLevel}`, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!gradeLevelV2) {
      throw new AppError(
        400,
        `Grade Level "${body.gradeLevel}" not found for the active School Year.`,
      );
    }

    const learnerTypeV2 = toLearnerTypeV2(body.learnerType);
    if (!learnerTypeV2) {
      throw new AppError(400, "Invalid learner type.");
    }

    const primaryContactV2 = toPrimaryContactV2(body.primaryContact);
    const applicantType = resolveApplicantType(
      body.isScpApplication,
      body.scpType,
    );

    const rawLrn = String(body.lrn ?? "").trim();
    const hasNoLrnDeclared = body.hasNoLrn === true;
    const canSubmitWithoutLrn = canDeclareNoLrn(
      learnerTypeV2,
      normalizedGradeLevel,
    );

    if (hasNoLrnDeclared && !canSubmitWithoutLrn) {
      throw new AppError(
        422,
        "Only incoming Grade 7 and transferee learners can submit without an LRN.",
      );
    }

    if (hasNoLrnDeclared && rawLrn) {
      throw new AppError(
        422,
        "Clear the LRN field when declaring that the learner has no LRN.",
      );
    }

    const lrn: string | null = hasNoLrnDeclared ? null : rawLrn || null;
    if (!hasNoLrnDeclared && !lrn) {
      throw new AppError(
        422,
        "LRN is required unless you declare that the learner has no LRN.",
      );
    }

    const isPendingLrnCreation = hasNoLrnDeclared && !lrn;

    if (applicantType !== "REGULAR") {
      const offeredScpConfig = await prisma.scpProgramConfig.findFirst({
        where: {
          schoolYearId: activeYear.id,
          scpType: applicantType,
          isOffered: true,
        },
        select: { id: true },
      });

      if (!offeredScpConfig) {
        throw new AppError(
          422,
          "The selected SCP track is not available for the active School Year.",
        );
      }
    }

    // 2. Parse and validate birthdate
    const rawBirthDate = new Date(body.birthdate);
    if (isNaN(rawBirthDate.getTime())) {
      throw new AppError(400, "Enter a valid birthdate in MM/DD/YYYY format.");
    }
    const birthDate = normalizeDateToUtcNoon(rawBirthDate);
    const age = calculateAge(rawBirthDate);

    // 3. Check duplicate LRN in same School Year (both early reg + enrollment app tables)
    if (lrn) {
      const existingEarlyReg = await prisma.learner.findFirst({
        where: {
          lrn,
          earlyRegistrationApplications: {
            some: { schoolYearId: activeYear.id },
          },
        },
        select: { id: true },
      });
      if (existingEarlyReg) {
        throw new AppError(
          409,
          `A registration with LRN ${lrn} already exists for this School Year.`,
        );
      }

      const existingEnrollmentApp =
        await prisma.enrollmentApplication.findFirst({
          where: { learner: { lrn }, schoolYearId: activeYear.id },
          select: { id: true },
        });
      if (existingEnrollmentApp) {
        throw new AppError(
          409,
          `An enrollment application with LRN ${lrn} already exists for this School Year.`,
        );
      }
    }

    // 4. Build guardian data
    const guardianData: {
      relationship: FamilyRelationship;
      lastName: string;
      firstName: string;
      middleName?: string | null;
      contactNumber?: string | null;
      email?: string | null;
      occupation?: string | null;
    }[] = [];

    if (body.father?.lastName && body.father?.firstName) {
      guardianData.push({
        relationship: "FATHER",
        lastName: body.father.lastName,
        firstName: body.father.firstName,
        middleName: body.father.middleName || null,
        contactNumber:
          body.father.contactNumber ||
          (primaryContactV2 === "FATHER" ? body.contactNumber : null),
        email:
          body.father.email ||
          (primaryContactV2 === "FATHER" ? body.email : null),
        occupation: body.father.occupation || null,
      });
    }
    if (body.mother?.maidenName && body.mother?.firstName) {
      guardianData.push({
        relationship: "MOTHER",
        lastName: body.mother.maidenName,
        firstName: body.mother.firstName,
        middleName: body.mother.middleName || null,
        contactNumber:
          body.mother.contactNumber ||
          (primaryContactV2 === "MOTHER" ? body.contactNumber : null),
        email:
          body.mother.email ||
          (primaryContactV2 === "MOTHER" ? body.email : null),
        occupation: body.mother.occupation || null,
      });
    }
    if (body.guardian?.lastName && body.guardian?.firstName) {
      guardianData.push({
        relationship: "GUARDIAN",
        lastName: body.guardian.lastName,
        firstName: body.guardian.firstName,
        middleName: body.guardian.middleName || null,
        contactNumber:
          body.guardian.contactNumber ||
          (primaryContactV2 === "GUARDIAN" ? body.contactNumber : null),
        email:
          body.guardian.email ||
          (primaryContactV2 === "GUARDIAN" ? body.email : null),
        occupation: body.guardian.occupation || null,
      });
    }

    // 4.5 Build address data
    const addressData: Prisma.ApplicationAddressCreateManyInput[] = [];
    if (body.barangay || body.cityMunicipality) {
      addressData.push({
        addressType: "CURRENT",
        houseNoStreet: body.houseNoStreet || null,
        sitio: body.sitio || null,
        barangay: body.barangay || null,
        cityMunicipality: body.cityMunicipality || null,
        province: body.province || null,
      });
    }

    const studentPhotoUrl = await saveBase64Image(body.studentPhoto, "photo");

    // 5. Create/reuse learner + guardians + registration in a transaction
    const learnerPayload = {
      lrn,
      isPendingLrnCreation,
      status: "SUBMITTED_BEERF" as ApplicationStatus,
      psaBirthCertNumber: body.psaBirthCertNumber?.trim().toUpperCase() || null,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      extensionName: body.extensionName || null,
      birthdate: birthDate,
      studentPhoto: studentPhotoUrl,
      sex: body.sex === "MALE" ? ("MALE" as const) : ("FEMALE" as const),
      placeOfBirth: body.placeOfBirth || null,
      religion: body.religion || null,
      isIpCommunity: body.isIpCommunity ?? false,
      ipGroupName: body.isIpCommunity ? body.ipGroupName : null,
      isLearnerWithDisability: body.isLearnerWithDisability ?? false,
      disabilityTypes: body.isLearnerWithDisability
        ? body.disabilityTypes || []
        : [],
      specialNeedsCategory: body.specialNeedsCategory || null,
      hasPwdId: body.hasPwdId ?? false,
      isBalikAral: body.isBalikAral ?? false,
      lastYearEnrolled: body.lastYearEnrolled || null,
      lastGradeLevel: body.lastGradeLevel || null,
    };

    const result = await prisma.$transaction(async (tx) => {
      let learner: { id: number };

      if (lrn) {
        const existingLearner = await tx.learner.findUnique({
          where: { lrn },
          select: { id: true },
        });

        if (existingLearner) {
          learner = await tx.learner.update({
            where: { id: existingLearner.id },
            data: learnerPayload,
            select: { id: true },
          });
        } else {
          learner = await tx.learner.create({
            data: learnerPayload,
            select: { id: true },
          });
        }
      } else {
        learner = await tx.learner.create({
          data: learnerPayload,
          select: { id: true },
        });
      }

      // Temporary tracking number
      const tempTracking = `EREG-${new Date().getFullYear()}-TEMP-${Date.now()}`;

      const application = await tx.earlyRegistrationApplication.create({
        data: {
          learnerId: learner.id,
          schoolYearId: activeYear.id,
          gradeLevelId: gradeLevelV2.id,
          applicantType,
          learnerType: learnerTypeV2,
          status: "SUBMITTED_BEERF",
          channel: options.channel,
          contactNumber: body.contactNumber,
          email: body.email || null,
          primaryContact: primaryContactV2,
          guardianRelationship: body.guardianRelationship || null,
          hasNoMother: body.hasNoMother ?? false,
          hasNoFather: body.hasNoFather ?? false,
          isPrivacyConsentGiven: body.isPrivacyConsentGiven ?? false,
          encodedById: options.encodedById ?? null,
          trackingNumber: tempTracking,
          familyMembers: {
            createMany: { data: guardianData },
          },
          addresses:
            addressData.length > 0
              ? {
                  createMany: { data: addressData },
                }
              : undefined,
          checklist: { create: {} },
        },
        select: { id: true, applicantType: true },
      });

      // Update with final tracking number
      let prefix = "REG";
      if (application.applicantType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING") {
        prefix = "STE";
      } else if (application.applicantType === "SPECIAL_PROGRAM_IN_THE_ARTS") {
        prefix = "SPA";
      } else if (application.applicantType === "SPECIAL_PROGRAM_IN_SPORTS") {
        prefix = "SPS";
      } else if (
        application.applicantType === "SPECIAL_PROGRAM_IN_JOURNALISM"
      ) {
        prefix = "SPJ";
      } else if (
        application.applicantType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE"
      ) {
        prefix = "SPFL";
      } else if (
        application.applicantType ===
        "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION"
      ) {
        prefix = "SPTVE";
      }

      const trackingNumber = `${prefix}-${new Date().getFullYear()}-${String(application.id).padStart(5, "0")}`;
      await tx.earlyRegistrationApplication.update({
        where: { id: application.id },
        data: { trackingNumber },
      });

      return { learner, application, trackingNumber };
    });

    // 6. Audit log (non-blocking)
    auditLog({
      userId: options.encodedById ?? null,
      actionType: "EARLY_REGISTRATION_SUBMITTED",
      description: `Early registration submitted for ${body.lastName}, ${body.firstName} — Grade ${body.gradeLevel} (${options.channel}). Tracking: ${result.trackingNumber}.${lrn ? ` LRN: ${lrn}.` : isPendingLrnCreation ? " Tagged as PENDING LRN CREATION." : ""}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: result.application.id,
      req,
    }).catch(() => {});

    res.status(201).json({
      id: result.application.id,
      trackingNumber: result.trackingNumber,
      learnerId: result.learner.id,
      gradeLevel: body.gradeLevel,
      applicantType,
      ...createInitialTrackingPayload(applicantType),
      learnerName: `${body.lastName}, ${body.firstName}`,
      age,
      message: "Your early registration has been submitted successfully.",
    });
  } catch (err) {
    console.error("[createRegistration Error]", err);
    const mappedDuplicateError = mapCreateRegistrationDuplicateError(err);
    next(mappedDuplicateError ?? err);
  }
}

/** GET /check-lrn/:lrn — Check if LRN already exists for active school year */
export async function checkLrn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const lrn = String(req.params.lrn || "").trim();
    if (!lrn || lrn.length !== 12) {
      throw new AppError(400, "Enter a valid 12-digit LRN.");
    }

    const settings = await prisma.schoolSetting.findFirst({
      include: { activeSchoolYear: true },
    });

    if (!settings?.activeSchoolYear) {
      throw new AppError(
        400,
        "No active School Year is set. Please contact the school registrar.",
      );
    }

    const activeYear = settings.activeSchoolYear;

    // Check early registrations
    const existingEarlyReg = await prisma.learner.findFirst({
      where: {
        lrn,
        earlyRegistrationApplications: {
          some: { schoolYearId: activeYear.id },
        },
      },
      select: { id: true },
    });

    if (existingEarlyReg) {
      return res.json({
        exists: true,
        type: "EARLY_REGISTRATION",
        message: `A registration with LRN ${lrn} already exists for this School Year.`,
      });
    }

    // Check enrollment applications
    const existingEnrollmentApp = await prisma.enrollmentApplication.findFirst({
      where: { learner: { lrn }, schoolYearId: activeYear.id },
      select: { id: true },
    });

    if (existingEnrollmentApp) {
      return res.json({
        exists: true,
        type: "ENROLLMENT",
        message: `An enrollment application with LRN ${lrn} already exists for this School Year.`,
      });
    }

    res.json({ exists: false });
  } catch (err) {
    next(err);
  }
}

// ── Public Handlers ──

/** POST / — Public early registration submission */
export async function store(req: Request, res: Response, next: NextFunction) {
  return createRegistration(req, res, next, { channel: "ONLINE" });
}

/** POST /f2f — Registrar-encoded early registration */
export async function storeF2F(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  return createRegistration(req, res, next, {
    channel: "F2F",
    encodedById: req.user?.userId,
  });
}

/** GET / — List early registrations for active/specified school year */
export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureLegacyApplicationStatusesNormalized();

    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(String(req.query.limit)) || 20),
    );
    const search = (req.query.search as string)?.trim() || "";
    const status = (req.query.status as string) || "";
    const gradeLevel = (req.query.gradeLevel as string) || "";
    const applicantType = (req.query.applicantType as string) || "";
    const withoutLrn = isTruthyQuery(req.query.withoutLrn);

    // Resolve school year
    let schoolYearId: number | undefined;
    if (req.query.schoolYearId) {
      const parsedId = parseInt(String(req.query.schoolYearId));
      if (!Number.isNaN(parsedId) && parsedId > 0) {
        schoolYearId = parsedId;
      }
    }

    if (!schoolYearId) {
      const settings = await prisma.schoolSetting.findFirst();
      schoolYearId = settings?.activeSchoolYearId ?? undefined;
    }

    if (!schoolYearId) {
      throw new AppError(400, "No school year specified or active.");
    }
    const resolvedSchoolYearId = schoolYearId;

    const where: any = {
      schoolYearId: resolvedSchoolYearId,
    };
    const andFilters: any[] = [];

    if (status) {
      const normalizedStatus = status.trim().toUpperCase();
      if (normalizedStatus !== "ALL") {
        if (normalizedStatus === "SUBMITTED") {
          andFilters.push({
            status: { in: ["SUBMITTED_BEERF", "SUBMITTED_BEEF"] },
          });
        } else {
          if (!(normalizedStatus in EARLY_REG_TRANSITIONS)) {
            throw new AppError(
              400,
              `Invalid status filter: ${normalizedStatus}`,
            );
          }
          andFilters.push({ status: normalizedStatus });
        }
      }
    }

    if (applicantType) {
      const normalizedApplicantType = applicantType.trim().toUpperCase();
      if (normalizedApplicantType !== "ALL") {
        if (!APPLICANT_TYPE_VALUES.has(normalizedApplicantType)) {
          throw new AppError(
            400,
            `Invalid applicant type filter: ${normalizedApplicantType}`,
          );
        }
        andFilters.push({ applicantType: normalizedApplicantType });
      }
    }

    if (gradeLevel) {
      const normalizedGradeLevel = normalizeGradeLevelToken(gradeLevel);
      const matchingGradeLevels = await prisma.gradeLevel.findMany({
        where: {
          schoolYearId: resolvedSchoolYearId,
          OR: [
            { name: { equals: normalizedGradeLevel, mode: "insensitive" } },
            {
              name: {
                equals: `GRADE ${normalizedGradeLevel}`,
                mode: "insensitive",
              },
            },
            {
              name: { equals: `G${normalizedGradeLevel}`, mode: "insensitive" },
            },
          ],
        },
        select: { id: true },
      });

      if (matchingGradeLevels.length > 0) {
        andFilters.push({
          gradeLevelId: { in: matchingGradeLevels.map((g) => g.id) },
        });
      }
    }

    if (withoutLrn) {
      andFilters.push({ learner: { isPendingLrnCreation: true } });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    if (search) {
      where.learner = {
        OR: [
          { lastName: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lrn: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const matchingGradeLevelIds =
      gradeLevel && gradeLevel !== "ALL"
        ? (andFilters.find((item) => item?.gradeLevelId?.in?.length)
            ?.gradeLevelId?.in ?? [])
        : [];

    const findManyArgsBase = {
      where: where,
      include: {
        learner: true,
        familyMembers: true,
        addresses: true,
        gradeLevel: { select: { id: true, name: true } },
        schoolYear: { select: { yearLabel: true } },
        encodedBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        assessments: { orderBy: { createdAt: "desc" as const } },
      },
      orderBy: { submittedAt: "desc" as const },
      skip: (page - 1) * limit,
      take: limit,
    };

    let registrations: Awaited<
      ReturnType<typeof prisma.earlyRegistrationApplication.findMany>
    >;
    let total: number;

    const sendRawFallbackResponse = async () => {
      const fallback = await fetchEarlyRegistrationListRawFallback({
        schoolYearId: resolvedSchoolYearId,
        search,
        status,
        applicantType,
        withoutLrn,
        page,
        limit,
        gradeLevelIds: matchingGradeLevelIds,
      });

      res.json({
        data: fallback.data,
        pagination: {
          page,
          limit,
          total: fallback.total,
          totalPages: Math.ceil(fallback.total / limit),
        },
      });
    };

    if (earlyRegListPrismaCompatible === false) {
      await sendRawFallbackResponse();
      return;
    }

    try {
      if (earlyRegListSupportsPreviousSchoolInclude === false) {
        [registrations, total] = await Promise.all([
          prisma.earlyRegistrationApplication.findMany({
            ...findManyArgsBase,
            include: {
              ...findManyArgsBase.include,
              enrollmentApplications: {
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
          }),
          prisma.earlyRegistrationApplication.count({ where: where }),
        ]);
      } else {
        [registrations, total] = await Promise.all([
          prisma.earlyRegistrationApplication.findMany({
            ...findManyArgsBase,
            include: {
              ...findManyArgsBase.include,
              enrollmentApplications: {
                include: { previousSchool: true },
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
          }),
          prisma.earlyRegistrationApplication.count({ where: where }),
        ]);
      }

      earlyRegListPrismaCompatible = true;
      if (earlyRegListSupportsPreviousSchoolInclude == null) {
        earlyRegListSupportsPreviousSchoolInclude = true;
      }
    } catch (error) {
      if (!isPreviousSchoolIncludeCompatibilityError(error)) {
        if (!isEarlyRegistrationListCompatibilityError(error)) {
          throw error;
        }

        earlyRegListPrismaCompatible = false;
        logEarlyRegListFallbackModeWarning(
          "Prisma list query is incompatible with the current database schema. Using raw fallback mode for this process.",
          error,
        );

        await sendRawFallbackResponse();
        return;
      }

      earlyRegListSupportsPreviousSchoolInclude = false;
      console.warn(
        "[index Warning] previousSchool include unavailable, falling back to list without previousSchool relation.",
      );

      try {
        [registrations, total] = await Promise.all([
          prisma.earlyRegistrationApplication.findMany({
            ...findManyArgsBase,
            include: {
              ...findManyArgsBase.include,
              enrollmentApplications: {
                take: 1,
                orderBy: { createdAt: "desc" },
              },
            },
          }),
          prisma.earlyRegistrationApplication.count({ where: where }),
        ]);

        earlyRegListPrismaCompatible = true;
      } catch (secondaryError) {
        if (!isEarlyRegistrationListCompatibilityError(secondaryError)) {
          throw secondaryError;
        }

        earlyRegListPrismaCompatible = false;
        logEarlyRegListFallbackModeWarning(
          "Prisma list query remains incompatible after previousSchool fallback. Using raw fallback mode for this process.",
          secondaryError,
        );

        await sendRawFallbackResponse();
        return;
      }
    }

    const mappedData = registrations.map((reg) => {
      const latestEnrollment = (reg as any).enrollmentApplications?.[0];
      return {
        ...reg,
        generalAverage:
          latestEnrollment?.previousSchool?.generalAverage ?? null,
      };
    });

    res.json({
      data: mappedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[index Error]", err);
    next(err);
  }
}

/** GET /:id/requirements — Resolve dynamic documentary requirements for one applicant */
export async function getRequirements(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const registration = await findEarlyRegOrThrow(id);

    let documentRequirements: Array<{
      docId: string;
      policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
      phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
      notes?: string | null;
    }> | null = null;

    if (registration.applicantType !== "REGULAR") {
      const scpConfig = await prisma.scpProgramConfig.findUnique({
        where: {
          uq_scp_program_configs_type: {
            schoolYearId: registration.schoolYearId,
            scpType: registration.applicantType,
          },
        },
        select: { gradeRequirements: true },
      });

      if (scpConfig?.gradeRequirements) {
        const payload = scpConfig.gradeRequirements as {
          documentRequirements?: Array<{
            docId: string;
            policy: "REQUIRED" | "OPTIONAL" | "HIDDEN";
            phase?: "EARLY_REGISTRATION" | "ENROLLMENT" | null;
            notes?: string | null;
          }>;
        };

        if (Array.isArray(payload.documentRequirements)) {
          documentRequirements = payload.documentRequirements;
        }
      }
    }

    const requirements = getRequiredDocuments({
      learnerType: registration.learnerType,
      gradeLevel: registration.gradeLevel.name,
      applicantType: registration.applicantType,
      isLwd: registration.learner.isLearnerWithDisability,
      isPeptAePasser: false,
      documentRequirements,
    });

    res.json({ requirements });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/checklist — Update requirement checklist for an early registration */
export async function updateChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    await findEarlyRegOrThrow(id);

    const allowedFields = [
      "isPsaBirthCertPresented",
      "isOriginalPsaBcCollected",
      "isSf9Submitted",
      "isSf10Requested",
      "isGoodMoralPresented",
      "isMedicalEvalSubmitted",
      "isCertOfRecognitionPresented",
      "isUndertakingSigned",
      "isConfirmationSlipReceived",
    ] as const;

    const payload = req.body as Record<string, unknown>;
    const filteredData: Partial<
      Record<(typeof allowedFields)[number], boolean>
    > = {};
    for (const key of allowedFields) {
      if (payload[key] !== undefined) {
        filteredData[key] = Boolean(payload[key]);
      }
    }

    const currentChecklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
    });

    const updated = await prisma.applicationChecklist.upsert({
      where: { earlyRegistrationId: id },
      update: { ...filteredData, updatedById: req.user!.userId },
      create: {
        ...filteredData,
        earlyRegistrationId: id,
        updatedById: req.user!.userId,
      },
    });

    const fieldsToLabel: Partial<
      Record<(typeof allowedFields)[number], string>
    > = {
      isPsaBirthCertPresented: "PSA Birth Certificate",
      isSf9Submitted: "SF9 / Report Card",
      isConfirmationSlipReceived: "Confirmation Slip",
      isSf10Requested: "SF10 (Permanent Record)",
      isGoodMoralPresented: "Good Moral Certificate",
      isMedicalEvalSubmitted: "Medical Evaluation",
      isCertOfRecognitionPresented: "Certificate of Recognition",
      isUndertakingSigned: "Affidavit of Undertaking",
    };

    for (const [key, label] of Object.entries(fieldsToLabel)) {
      const typedKey = key as (typeof allowedFields)[number];
      const newValue = filteredData[typedKey];
      const oldValue = currentChecklist ? currentChecklist[typedKey] : false;
      if (newValue !== undefined && newValue !== oldValue) {
        await auditLog({
          userId: req.user!.userId,
          actionType: newValue ? "DOCUMENT_ADDED" : "DOCUMENT_REMOVED",
          description: `${newValue ? "Added" : "Removed"} requirement: ${label} for early registration #${id}`,
          subjectType: "EarlyRegistrationApplication",
          recordId: id,
          req,
        }).catch(() => {});
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Updated requirement checklist for early registration #${id}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** POST /:id/documents — Mark a document as presented for an early registration */
export async function uploadDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const documentType = String(req.body?.documentType ?? "")
      .trim()
      .toUpperCase();

    if (!documentType) {
      throw new AppError(400, "documentType is required");
    }

    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    const checklistField = DOCUMENT_CHECKLIST_MAPPING[documentType];
    if (!checklistField) {
      throw new AppError(400, "Invalid document type for checklist");
    }

    const registration = await findEarlyRegOrThrow(id);

    await prisma.applicationChecklist.upsert({
      where: { earlyRegistrationId: id },
      update: {
        [checklistField]: true,
        updatedById: req.user!.userId,
      },
      create: {
        earlyRegistrationId: id,
        [checklistField]: true,
        updatedById: req.user!.userId,
      },
    });

    try {
      fs.unlinkSync(req.file.path);
    } catch {
      // Non-fatal cleanup best-effort
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_UPDATED",
      description: `Marked ${documentType} as presented for ${registration.learner.firstName} ${registration.learner.lastName} (#${id})`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.status(200).json({ message: "Checklist updated successfully" });
  } catch (err) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup failures
      }
    }
    next(err);
  }
}

/** DELETE /:id/documents — Unmark a document for an early registration */
export async function removeDocument(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const documentType = String(req.body?.documentType ?? "")
      .trim()
      .toUpperCase();

    if (!documentType) {
      throw new AppError(400, "documentType is required");
    }

    const checklistField = DOCUMENT_CHECKLIST_MAPPING[documentType];
    if (!checklistField) {
      throw new AppError(400, "Invalid document type for checklist");
    }

    const registration = await findEarlyRegOrThrow(id);

    await prisma.applicationChecklist.updateMany({
      where: { earlyRegistrationId: id },
      data: {
        [checklistField]: false,
        updatedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "CHECKLIST_REMOVED",
      description: `Unmarked ${documentType} for ${registration.learner.firstName} ${registration.learner.lastName} (#${id})`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json({ message: "Checklist updated successfully" });
  } catch (err) {
    next(err);
  }
}

/** GET /:id — Get a single early registration detail */
export async function show(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    await ensureLegacyApplicationStatusesNormalized();

    const detailed = await sharedService.getDetailedApplicationOrThrow(id, {
      allowEnrollmentFallback: false,
    });
    res.json(detailed);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/verify — Registrar marks a registration as verified */
export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    await ensureLegacyApplicationStatusesNormalized();

    const registration = await prisma.earlyRegistrationApplication.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new AppError(404, "Early registration not found.");
    }

    if (registration.status !== "SUBMITTED_BEERF") {
      throw new AppError(
        422,
        `Cannot verify a registration with status "${registration.status}".`,
      );
    }

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        verifiedById: req.user!.userId,
      },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_VERIFIED",
      description: `Early registration #${id} verified.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function parseExpectedStatusMap(
  input: unknown,
): Map<number, ApplicationStatus> {
  const map = new Map<number, ApplicationStatus>();

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return map;
  }

  for (const [rawId, rawStatus] of Object.entries(
    input as Record<string, unknown>,
  )) {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0 || typeof rawStatus !== "string") {
      continue;
    }

    const normalizedStatus = rawStatus.trim().toUpperCase();
    if (!normalizedStatus) continue;

    if (
      !Object.prototype.hasOwnProperty.call(
        EARLY_REG_TRANSITIONS,
        normalizedStatus,
      )
    ) {
      continue;
    }

    map.set(id, normalizedStatus as ApplicationStatus);
  }

  return map;
}

function assertNoStatusSnapshotConflicts(
  expectedStatuses: Map<number, ApplicationStatus>,
  registrations: Array<{
    id: number;
    status: ApplicationStatus;
    trackingNumber: string;
  }>,
): void {
  if (expectedStatuses.size === 0) return;

  const conflicts = registrations
    .map((registration) => {
      const expected = expectedStatuses.get(registration.id);
      if (!expected || expected === registration.status) return null;

      return {
        id: registration.id,
        trackingNumber: registration.trackingNumber,
        expected,
        actual: registration.status,
      };
    })
    .filter(
      (
        value,
      ): value is {
        id: number;
        trackingNumber: string;
        expected: ApplicationStatus;
        actual: ApplicationStatus;
      } => Boolean(value),
    );

  if (conflicts.length === 0) return;

  const preview = conflicts
    .slice(0, 3)
    .map(
      (conflict) =>
        `#${conflict.trackingNumber}: expected ${conflict.expected}, now ${conflict.actual}`,
    )
    .join("; ");

  throw new AppError(
    409,
    `Batch context is stale. Reload applicants before retrying. ${preview}`,
  );
}

function assertSingleProgramSelection(
  registrations: Array<{ applicantType: ApplicantType }>,
): void {
  const programs = new Set(
    registrations.map((registration) => registration.applicantType),
  );
  if (programs.size > 1) {
    throw new AppError(
      422,
      "Batch action requires applicants to share the same program.",
    );
  }
}

async function findEarlyRegOrThrow(id: number) {
  await ensureLegacyApplicationStatusesNormalized();

  const reg = await prisma.earlyRegistrationApplication.findUnique({
    where: { id },
    include: {
      learner: true,
      gradeLevel: true,
      assessments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!reg) throw new AppError(404, "Early registration application not found");
  return reg;
}

/** PATCH /:id/reject — Reject an early registration */
export async function reject(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const { reason } = req.body;

    assertEarlyRegTransition(
      reg.status,
      "REJECTED",
      `Cannot reject. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_REJECTED",
      description: `Early registration #${id} rejected. Reason: ${reason || "N/A"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/withdraw — Withdraw an early registration */
export async function withdraw(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "WITHDRAWN",
      `Cannot withdraw. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "WITHDRAWN" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_WITHDRAWN",
      description: `Early registration #${id} withdrawn.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/mark-eligible — Mark early registration as eligible for assessment */
export async function markEligible(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "ELIGIBLE",
      `Cannot mark as eligible. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "ELIGIBLE" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_ELIGIBLE",
      description: `Early registration #${id} marked as ELIGIBLE.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/schedule-assessment — Schedule an assessment step */
export async function scheduleAssessment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, scheduledDate, scheduledTime, venue, notes } =
      req.body;
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    const targetStatus: ApplicationStatus =
      kind === "INTERVIEW" ? "INTERVIEW_SCHEDULED" : "EXAM_SCHEDULED";

    assertEarlyRegTransition(
      reg.status,
      targetStatus,
      `Cannot schedule assessment. Current status: "${reg.status}".`,
    );

    // Fetch pipeline step config for defaults
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: reg.schoolYearId,
          scpType: reg.applicantType as any,
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    const stepConfig = scpConfig?.steps.find((s) => s.stepOrder === stepOrder);

    const existingAssessments = scpConfig
      ? await prisma.earlyRegistrationAssessment.findMany({
          where: { applicationId: id },
        })
      : [];

    const requiredNonInterviewSteps = (scpConfig?.steps ?? []).filter(
      (step) => step.isRequired && step.kind !== "INTERVIEW",
    );
    const hasFailedRequiredStep = requiredNonInterviewSteps.some((step) =>
      existingAssessments.some(
        (assessment) =>
          assessment.type === step.kind && assessment.result === "FAILED",
      ),
    );

    if (hasFailedRequiredStep) {
      throw new AppError(
        422,
        "Cannot schedule additional assessments or interviews after a failed cut-off result. Mark the learner as FAILED.",
      );
    }

    // Prerequisite gating
    if (scpConfig && stepOrder > 1) {
      const previousRequired = scpConfig.steps.filter(
        (s) => s.stepOrder < stepOrder && s.isRequired,
      );
      if (previousRequired.length > 0) {
        const unmet = previousRequired.filter(
          (prev) =>
            !existingAssessments.some(
              (a) => a.type === prev.kind && a.result === "PASSED",
            ),
        );
        if (unmet.length > 0) {
          throw new AppError(
            400,
            `Cannot schedule step ${stepOrder}: prerequisite step(s) not passed — ${unmet.map((s) => s.label).join(", ")}.`,
          );
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.earlyRegistrationAssessment.create({
        data: {
          applicationId: id,
          type: kind as any,
          scheduledDate: normalizeDateToUtcNoon(new Date(scheduledDate)),
          scheduledTime: scheduledTime || stepConfig?.scheduledTime || null,
          venue: venue || stepConfig?.venue || null,
          notes: notes || stepConfig?.notes || null,
        },
      });

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: targetStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType:
        kind === "INTERVIEW"
          ? "INTERVIEW_SCHEDULED"
          : "ASSESSMENT_STEP_SCHEDULED",
      description: `Scheduled ${stepConfig?.label || kind} for early reg #${id} on ${scheduledDate}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/record-step-result — Record assessment result */
export async function recordStepResult(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { stepOrder, kind, score, result, notes } = req.body;
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    const normalizedStepOrder = Number(stepOrder);
    if (!Number.isInteger(normalizedStepOrder) || normalizedStepOrder <= 0) {
      throw new AppError(400, "stepOrder must be a positive integer.");
    }

    assertEarlyRegTransition(
      reg.status,
      "ASSESSMENT_TAKEN",
      `Cannot record result. Current status: "${reg.status}".`,
    );

    // Load pipeline config
    const scpConfig = await prisma.scpProgramConfig.findUnique({
      where: {
        uq_scp_program_configs_type: {
          schoolYearId: reg.schoolYearId,
          scpType: reg.applicantType as any,
        },
      },
      include: {
        steps: { where: { isRequired: true }, orderBy: { stepOrder: "asc" } },
      },
    });

    const normalizedKind =
      typeof kind === "string" && kind.trim().length > 0
        ? kind.trim().toUpperCase()
        : null;
    const stepConfig = scpConfig?.steps.find(
      (s) => s.stepOrder === normalizedStepOrder,
    );

    const fallbackAssessment = !normalizedKind
      ? await prisma.earlyRegistrationAssessment.findFirst({
          where: { applicationId: id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    const resolvedKind =
      normalizedKind ?? stepConfig?.kind ?? fallbackAssessment?.type ?? null;

    if (!resolvedKind) {
      throw new AppError(
        400,
        `Unable to determine assessment kind for step ${normalizedStepOrder}.`,
      );
    }

    const assessment = await prisma.earlyRegistrationAssessment.findFirst({
      where: { applicationId: id, type: resolvedKind as any },
      orderBy: { createdAt: "desc" },
    });

    if (!assessment) {
      throw new AppError(
        404,
        `No scheduled assessment found for step ${normalizedStepOrder} (${resolvedKind}). Schedule it first.`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let finalResult = result ?? null;
      if (stepConfig?.cutoffScore != null && score != null) {
        finalResult = score >= stepConfig.cutoffScore ? "PASSED" : "FAILED";
      }

      await tx.earlyRegistrationAssessment.update({
        where: { id: assessment.id },
        data: {
          score: score ?? null,
          result: finalResult,
          notes: notes ?? null,
          conductedAt: new Date(),
        },
      });

      // Check if all required non-interview steps have results
      const allAssessments = await tx.earlyRegistrationAssessment.findMany({
        where: { applicationId: id },
      });

      const requiredSteps = scpConfig?.steps ?? [];
      const requiredNonInterview = requiredSteps.filter(
        (step) => step.kind !== "INTERVIEW",
      );
      const hasFailedRequired = requiredNonInterview.some((step) =>
        allAssessments.some(
          (a) => a.type === step.kind && a.result === "FAILED",
        ),
      );
      const allDone = requiredNonInterview.every((step) =>
        allAssessments.some(
          (a) =>
            a.type === step.kind &&
            (a.conductedAt != null || a.result != null || a.score != null),
        ),
      );

      const newStatus: ApplicationStatus =
        hasFailedRequired || allDone ? "ASSESSMENT_TAKEN" : "EXAM_SCHEDULED";

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: newStatus },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "ASSESSMENT_RESULT_RECORDED",
      description: `Recorded result for early reg #${id} step ${normalizedStepOrder}: score=${score ?? "N/A"}, result=${result ?? "auto"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/pass — Mark early registration as passed */
export async function pass(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "PASSED",
      `Cannot mark as passed. Current status: "${reg.status}".`,
    );

    const updated = await prisma.earlyRegistrationApplication.update({
      where: { id },
      data: { status: "PASSED" },
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_PASSED",
      description: `Early registration #${id} marked PASSED.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/fail — Record failed assessment and reroute to regular intake */
export async function fail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const { examNotes } = (req.body ?? {}) as { examNotes?: string };
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      "SUBMITTED_BEERF",
      `Cannot reroute failed assessment. Current status: "${reg.status}".`,
    );

    const updated = await prisma.$transaction(async (tx) => {
      if (examNotes) {
        const latestAssessment = await tx.earlyRegistrationAssessment.findFirst(
          {
            where: { applicationId: id },
            orderBy: { createdAt: "desc" },
          },
        );
        if (latestAssessment) {
          await tx.earlyRegistrationAssessment.update({
            where: { id: latestAssessment.id },
            data: { notes: examNotes },
          });
        }
      }
      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: {
          status: "SUBMITTED_BEERF",
          applicantType: "REGULAR",
        },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REGISTRATION_FAILED",
      description: `Early registration #${id} failed SCP assessment and rerouted to SUBMITTED as REGULAR. Notes: ${examNotes || "N/A"}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** POST /batch/verify-documents/preview — Fetch checklist grid metadata for selected applicants */
export async function batchVerifyDocumentsPreview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids } = req.body as { ids: number[] };
    const requestedIds = Array.from(new Set(ids));

    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: {
          select: {
            firstName: true,
            lastName: true,
            lrn: true,
            sex: true,
            isPendingLrnCreation: true,
            isLearnerWithDisability: true,
          },
        },
        gradeLevel: { select: { name: true } },
        checklist: true,
        enrollmentApplications: {
          include: { previousSchool: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const byId = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );
    const configCache = new Map<string, ScpConfigLite | null>();
    const columnsMap = new Map<
      ChecklistBooleanKey,
      { label: string; isMandatory: boolean }
    >();

    const applicants: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      status: ApplicationStatus;
      lrn: string;
      sex: string;
      isPendingLrnCreation: boolean;
      academicStatus: AcademicStatusValue;
      checklist: Record<ChecklistBooleanKey, boolean>;
      requiredChecklistKeys: ChecklistBooleanKey[];
      generalAverage: number | null;
    }> = [];

    for (const id of requestedIds) {
      const registration = byId.get(id);
      if (!registration) continue;

      const config = await getScpConfigCached(
        configCache,
        registration.schoolYearId,
        registration.applicantType,
      );

      const requirements = getRequiredDocuments({
        learnerType: registration.learnerType,
        gradeLevel: registration.gradeLevel.name,
        applicantType: registration.applicantType,
        isLwd: Boolean(registration.learner.isLearnerWithDisability),
        isPeptAePasser: false,
        documentRequirements: null,
      });

      const mappedColumns = mapRequirementsToChecklistColumns(requirements);
      const effectiveColumns =
        mappedColumns.length > 0 ? mappedColumns : DEFAULT_BATCH_VERIFY_COLUMNS;

      for (const column of effectiveColumns) {
        const existing = columnsMap.get(column.key);
        columnsMap.set(column.key, {
          label: column.label,
          isMandatory: Boolean(existing?.isMandatory || column.isMandatory),
        });
      }

      applicants.push({
        id: registration.id,
        name: formatBatchName(
          registration.learner.firstName,
          registration.learner.lastName,
        ),
        trackingNumber: registration.trackingNumber,
        status: registration.status,
        lrn: registration.learner.lrn ?? "",
        sex: registration.learner.sex,
        isPendingLrnCreation: registration.learner.isPendingLrnCreation,
        academicStatus: extractChecklistAcademicStatus(registration.checklist),
        checklist: extractChecklistState(registration.checklist),
        requiredChecklistKeys: effectiveColumns
          .filter((column) => column.isMandatory)
          .map((column) => column.key),
        generalAverage:
          registration.enrollmentApplications[0]?.previousSchool
            ?.generalAverage ?? null,
      });
    }

    if (columnsMap.size === 0) {
      for (const column of DEFAULT_BATCH_VERIFY_COLUMNS) {
        columnsMap.set(column.key, {
          label: column.label,
          isMandatory: column.isMandatory,
        });
      }
    }

    const columns = Array.from(columnsMap.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        isMandatory: value.isMandatory,
      }))
      .sort((a, b) => {
        if (a.isMandatory !== b.isMandatory) {
          return a.isMandatory ? -1 : 1;
        }
        return a.label.localeCompare(b.label);
      });

    const missingIds = requestedIds.filter((id) => !byId.has(id));

    res.json({
      columns,
      applicants,
      missingIds,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/verify-documents — Batch checklist update with context-based status progression */
export async function batchVerifyDocuments(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { applicants, expectedStatuses } = req.body as {
      applicants: Array<{
        id: number;
        checklist?: unknown;
        academicStatus?: AcademicStatusValue;
      }>;
      expectedStatuses?: Record<string, string>;
    };

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    const dedupedRows = new Map<
      number,
      { id: number; checklist?: unknown; academicStatus?: AcademicStatusValue }
    >();
    for (const row of applicants) {
      dedupedRows.set(row.id, row);
    }

    const requestedIds = Array.from(dedupedRows.keys());
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: {
          select: {
            firstName: true,
            lastName: true,
            isLearnerWithDisability: true,
          },
        },
        gradeLevel: { select: { name: true } },
        checklist: true,
      },
    });

    assertSingleProgramSelection(registrations);
    assertNoStatusSnapshotConflicts(
      expectedStatusMap,
      registrations.map((registration) => ({
        id: registration.id,
        status: registration.status,
        trackingNumber: registration.trackingNumber,
      })),
    );

    const registrationById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );

    const succeeded: BatchSuccessItem[] = [];
    const failed: BatchFailureItem[] = [];
    const configCache = new Map<string, ScpConfigLite | null>();

    for (const row of dedupedRows.values()) {
      const registration = registrationById.get(row.id);
      if (!registration) {
        failed.push({
          id: row.id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
        continue;
      }

      const name = formatBatchName(
        registration.learner.firstName,
        registration.learner.lastName,
      );

      const targetStatus = resolveBatchVerifyTarget(
        registration.status,
        registration.applicantType,
      );
      if (!targetStatus) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason:
            "Batch verify is not supported for this status and program combination.",
        });
        continue;
      }

      const academicStatus = normalizeAcademicStatus(
        row.academicStatus ??
          extractChecklistAcademicStatus(registration.checklist),
      );

      if (academicStatus === "RETAINED") {
        try {
          assertEarlyRegTransition(
            registration.status,
            "REJECTED",
            `Cannot flag retained learner while status is "${registration.status}".`,
          );

          const checklistPatch = extractChecklistPatch(row.checklist);

          await prisma.$transaction(async (tx) => {
            await tx.applicationChecklist.upsert({
              where: { earlyRegistrationId: registration.id },
              create: {
                earlyRegistrationId: registration.id,
                updatedById: req.user!.userId,
                academicStatus: "RETAINED",
                ...extractChecklistState(registration.checklist),
                ...checklistPatch,
              },
              update: {
                updatedById: req.user!.userId,
                academicStatus: "RETAINED",
                ...checklistPatch,
              },
            });

            await tx.earlyRegistrationApplication.update({
              where: { id: registration.id },
              data: {
                status: "REJECTED",
              },
            });
          });

          succeeded.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
          });

          await auditLog({
            userId: req.user!.userId,
            actionType: "EARLY_REG_RETAINED_FLAGGED",
            description: `Early registration #${registration.id} flagged as RETAINED from SF9 review and moved to REJECTED for advising follow-up.`,
            subjectType: "EarlyRegistrationApplication",
            recordId: registration.id,
            req,
          }).catch(() => {});
        } catch (error) {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason: toBatchReason(error, "Failed to flag retained learner."),
          });
        }

        continue;
      }

      try {
        assertEarlyRegTransition(
          registration.status,
          targetStatus,
          `Cannot batch verify while status is "${registration.status}".`,
        );
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Transition not allowed."),
        });
        continue;
      }

      const checklistPatch = extractChecklistPatch(row.checklist);
      const mergedChecklist = {
        ...extractChecklistState(registration.checklist),
        ...checklistPatch,
      };

      const requiresMandatoryDocs =
        targetStatus === "ELIGIBLE" ||
        (registration.applicantType === "REGULAR" &&
          targetStatus === "VERIFIED");

      if (requiresMandatoryDocs) {
        await getScpConfigCached(
          configCache,
          registration.schoolYearId,
          registration.applicantType,
        );

        const requirements = getRequiredDocuments({
          learnerType: registration.learnerType,
          gradeLevel: registration.gradeLevel.name,
          applicantType: registration.applicantType,
          isLwd: Boolean(registration.learner.isLearnerWithDisability),
          isPeptAePasser: false,
          documentRequirements: null,
        });

        const missingMandatory = computeMissingMandatoryRequirements(
          requirements,
          mergedChecklist,
        );

        if (missingMandatory.length > 0) {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason: `Cannot mark eligible; missing required documents: ${missingMandatory.join(", ")}.`,
          });
          continue;
        }
      }

      try {
        const transitionData =
          targetStatus === "VERIFIED"
            ? {
                status: targetStatus,
                verifiedAt: new Date(),
                verifiedBy: { connect: { id: req.user!.userId } },
              }
            : { status: targetStatus };

        await prisma.$transaction(async (tx) => {
          await tx.applicationChecklist.upsert({
            where: { earlyRegistrationId: registration.id },
            create: {
              earlyRegistrationId: registration.id,
              updatedById: req.user!.userId,
              academicStatus,
              ...mergedChecklist,
            },
            update: {
              updatedById: req.user!.userId,
              academicStatus,
              ...checklistPatch,
            },
          });

          await tx.earlyRegistrationApplication.update({
            where: { id: registration.id },
            data: transitionData,
          });
        });

        succeeded.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
        });
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Failed to update checklist."),
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_VERIFY_DOCUMENTS",
      description: `Batch verify documents: ${succeeded.length} succeeded, ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: applicants.length,
      succeeded,
      failed,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/assign-regular-section — Assign verified regular applicants to a section and finalize enrollment status. */
export async function batchAssignRegularSection(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids, sectionId, expectedStatuses } = req.body as {
      ids: number[];
      sectionId: number;
      expectedStatuses?: Record<string, string>;
    };

    const requestedIds = Array.from(new Set(ids));
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    const outcome = await prisma.$transaction(async (tx) => {
      const [section] = await tx.$queryRaw<
        {
          id: number;
          maxCapacity: number;
          gradeLevelId: number;
          programType: ApplicantType;
        }[]
      >`
        SELECT
          id,
          "max_capacity" as "maxCapacity",
          "grade_level_id" as "gradeLevelId",
          "program_type" as "programType"
        FROM "sections"
        WHERE id = ${sectionId}
        FOR UPDATE
      `;

      if (!section) {
        throw new AppError(404, "Section not found.");
      }

      if (section.programType !== "REGULAR") {
        throw new AppError(
          422,
          "Selected section is reserved for SCP and cannot be used for Regular batch assignment.",
        );
      }

      if (requestedIds.length > 0) {
        await tx.$queryRaw`
          SELECT id
          FROM "early_registration_applications"
          WHERE id IN (${Prisma.join(requestedIds)})
          FOR UPDATE
        `;
      }

      const registrations = await tx.earlyRegistrationApplication.findMany({
        where: { id: { in: requestedIds } },
        include: {
          learner: {
            select: {
              firstName: true,
              lastName: true,
              lrn: true,
              sex: true,
              isPendingLrnCreation: true,
              isLearnerWithDisability: true,
            },
          },
          gradeLevel: { select: { name: true } },
          checklist: true,
          enrollmentApplications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              enrollmentRecord: {
                select: {
                  id: true,
                  sectionId: true,
                },
              },
            },
          },
        },
      });

      assertNoStatusSnapshotConflicts(
        expectedStatusMap,
        registrations.map((registration) => ({
          id: registration.id,
          status: registration.status,
          trackingNumber: registration.trackingNumber,
        })),
      );

      const gradeLevelIds = new Set(
        registrations.map((registration) => registration.gradeLevelId),
      );
      if (gradeLevelIds.size > 1) {
        throw new AppError(
          422,
          "Batch section assignment requires applicants from a single grade level.",
        );
      }

      const onlyGradeLevelId = registrations[0]?.gradeLevelId ?? null;
      if (
        onlyGradeLevelId !== null &&
        section.gradeLevelId !== onlyGradeLevelId
      ) {
        throw new AppError(
          422,
          "Selected section does not match the applicants' grade level.",
        );
      }

      const registrationById = new Map(
        registrations.map((registration) => [registration.id, registration]),
      );

      const succeeded: Array<
        BatchSuccessItem & { status: ApplicationStatus; sectionId: number }
      > = [];
      const failed: BatchFailureItem[] = [];
      const candidates: Array<{
        registration: (typeof registrations)[number];
        targetStatus: ApplicationStatus;
      }> = [];

      for (const id of requestedIds) {
        const registration = registrationById.get(id);
        if (!registration) {
          failed.push({
            id,
            name: "Unknown",
            trackingNumber: "N/A",
            reason: "Application not found.",
          });
          continue;
        }

        const name = formatBatchName(
          registration.learner.firstName,
          registration.learner.lastName,
        );

        if (registration.applicantType !== "REGULAR") {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason:
              "Only Regular (BEC) applicants can be processed in this batch action.",
          });
          continue;
        }

        if (registration.status !== "VERIFIED") {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason:
              'Only applicants in "VERIFIED" status can be assigned to a regular section.',
          });
          continue;
        }

        const latestEnrollmentApp = registration.enrollmentApplications[0];
        if (latestEnrollmentApp?.enrollmentRecord) {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason:
              "Applicant is already assigned to a section and cannot be re-assigned in this batch.",
          });
          continue;
        }

        const academicStatus = extractChecklistAcademicStatus(
          registration.checklist,
        );
        if (academicStatus === "RETAINED") {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason:
              "Retained learners cannot proceed to section assignment and must be advised separately.",
          });
          continue;
        }

        const requirements = getRequiredDocuments({
          learnerType: registration.learnerType,
          gradeLevel: registration.gradeLevel.name,
          applicantType: registration.applicantType,
          isLwd: Boolean(registration.learner.isLearnerWithDisability),
          isPeptAePasser: false,
          documentRequirements: null,
        });

        const missingMandatory = computeMissingMandatoryRequirements(
          requirements,
          extractChecklistState(registration.checklist),
        );

        if (missingMandatory.length > 0) {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason: `Missing required documents: ${missingMandatory.join(", ")}.`,
          });
          continue;
        }

        const requiresTemporaryEnrollment =
          registration.learner.isPendingLrnCreation === true ||
          !registration.learner.lrn;
        const targetStatus: ApplicationStatus = requiresTemporaryEnrollment
          ? "TEMPORARILY_ENROLLED"
          : "ENROLLED";

        try {
          assertEarlyRegTransition(
            registration.status,
            targetStatus,
            `Cannot transition application #${registration.id} from "${registration.status}" to "${targetStatus}".`,
          );
        } catch (error) {
          failed.push({
            id: registration.id,
            name,
            trackingNumber: registration.trackingNumber,
            reason: toBatchReason(error, "Transition not allowed."),
          });
          continue;
        }

        candidates.push({
          registration,
          targetStatus,
        });
      }

      const currentEnrollmentCount = await tx.enrollmentRecord.count({
        where: { sectionId },
      });

      const availableSlots = Math.max(
        0,
        section.maxCapacity - currentEnrollmentCount,
      );
      const requestedSlots = candidates.length;

      if (requestedSlots > availableSlots) {
        throw new AppError(
          422,
          `Section is full. Available slots: ${availableSlots}. Requested assignments: ${requestedSlots}.`,
        );
      }

      for (const { registration, targetStatus } of candidates) {
        const name = formatBatchName(
          registration.learner.firstName,
          registration.learner.lastName,
        );

        const existingEnrollmentApp = registration.enrollmentApplications[0];

        const enrollmentApplication = existingEnrollmentApp
          ? await tx.enrollmentApplication.update({
              where: { id: existingEnrollmentApp.id },
              data: {
                status: targetStatus,
                isTemporarilyEnrolled: targetStatus === "TEMPORARILY_ENROLLED",
              },
            })
          : await tx.enrollmentApplication.create({
              data: {
                learnerId: registration.learnerId,
                earlyRegistrationId: registration.id,
                schoolYearId: registration.schoolYearId,
                gradeLevelId: registration.gradeLevelId,
                applicantType: registration.applicantType,
                learnerType: registration.learnerType,
                status: targetStatus,
                admissionChannel: registration.channel,
                isPrivacyConsentGiven: registration.isPrivacyConsentGiven,
                encodedById: req.user!.userId,
                isTemporarilyEnrolled: targetStatus === "TEMPORARILY_ENROLLED",
              },
            });

        const checklistState = extractChecklistState(registration.checklist);
        const checklistAcademicStatus = extractChecklistAcademicStatus(
          registration.checklist,
        );

        await tx.applicationChecklist.upsert({
          where: { earlyRegistrationId: registration.id },
          create: {
            earlyRegistrationId: registration.id,
            enrollmentId: enrollmentApplication.id,
            updatedById: req.user!.userId,
            academicStatus: checklistAcademicStatus,
            ...checklistState,
          },
          update: {
            enrollmentId: enrollmentApplication.id,
            updatedById: req.user!.userId,
            academicStatus: checklistAcademicStatus,
          },
        });

        await tx.enrollmentRecord.upsert({
          where: {
            enrollmentApplicationId: enrollmentApplication.id,
          },
          create: {
            enrollmentApplicationId: enrollmentApplication.id,
            sectionId,
            schoolYearId: registration.schoolYearId,
            enrolledById: req.user!.userId,
          },
          update: {
            sectionId,
            schoolYearId: registration.schoolYearId,
            enrolledById: req.user!.userId,
          },
        });

        await tx.earlyRegistrationApplication.update({
          where: { id: registration.id },
          data: { status: targetStatus },
        });

        if (targetStatus === "ENROLLED") {
          await tx.learner.update({
            where: { id: registration.learnerId },
            data: { isPendingLrnCreation: false },
          });
        }

        succeeded.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          status: targetStatus,
          sectionId,
        });
      }

      return { succeeded, failed };
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_ASSIGN_REGULAR_SECTION",
      description: `Batch assigned regular section #${sectionId}: ${outcome.succeeded.length} succeeded, ${outcome.failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: requestedIds.length,
      sectionId,
      succeeded: outcome.succeeded,
      failed: outcome.failed,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/schedule-step — Batch schedule exam or interview with required email queueing */
export async function batchScheduleStep(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      ids,
      expectedStatuses,
      mode,
      scheduledDate,
      scheduledTime,
      venue,
      notes,
      sendEmail,
    } = req.body as {
      ids: number[];
      expectedStatuses?: Record<string, string>;
      mode: "EXAM" | "INTERVIEW";
      scheduledDate: string | Date;
      scheduledTime: string;
      venue: string;
      notes?: string | null;
      sendEmail?: boolean;
    };

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    const requestedIds = Array.from(new Set(ids));
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: { select: { firstName: true, lastName: true } },
        assessments: { orderBy: { createdAt: "desc" } },
      },
    });

    assertSingleProgramSelection(registrations);
    assertNoStatusSnapshotConflicts(
      expectedStatusMap,
      registrations.map((registration) => ({
        id: registration.id,
        status: registration.status,
        trackingNumber: registration.trackingNumber,
      })),
    );

    const registrationById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );

    const succeeded: BatchSuccessItem[] = [];
    const failed: BatchFailureItem[] = [];
    const configCache = new Map<string, ScpConfigLite | null>();

    for (const id of requestedIds) {
      const registration = registrationById.get(id);
      if (!registration) {
        failed.push({
          id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
        continue;
      }

      const name = formatBatchName(
        registration.learner.firstName,
        registration.learner.lastName,
      );

      const targetStatus: ApplicationStatus =
        mode === "INTERVIEW" ? "INTERVIEW_SCHEDULED" : "EXAM_SCHEDULED";

      try {
        assertEarlyRegTransition(
          registration.status,
          targetStatus,
          `Cannot schedule while status is "${registration.status}".`,
        );
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Transition not allowed."),
        });
        continue;
      }

      try {
        const config = await getScpConfigCached(
          configCache,
          registration.schoolYearId,
          registration.applicantType,
        );

        const steps = config?.steps ?? [];
        const requiredNonInterviewSteps = steps.filter(
          (step) => step.isRequired && step.kind !== "INTERVIEW",
        );

        const hasFailedRequiredStep = requiredNonInterviewSteps.some((step) =>
          registration.assessments.some(
            (assessment) =>
              assessment.type === step.kind && assessment.result === "FAILED",
          ),
        );

        if (hasFailedRequiredStep) {
          throw new AppError(
            422,
            "Cannot schedule after a failed required assessment.",
          );
        }

        const selectedStep =
          mode === "INTERVIEW"
            ? (steps.find((step) => step.kind === "INTERVIEW") ?? null)
            : (steps.find(
                (step) => step.isRequired && step.kind !== "INTERVIEW",
              ) ??
              steps.find((step) => step.kind !== "INTERVIEW") ??
              null);

        if (mode === "INTERVIEW") {
          const interviewOrder =
            selectedStep?.stepOrder ?? Number.MAX_SAFE_INTEGER;
          const previousRequired = steps.filter(
            (step) =>
              step.isRequired &&
              step.kind !== "INTERVIEW" &&
              step.stepOrder < interviewOrder,
          );

          const unmet = previousRequired.filter(
            (step) =>
              !registration.assessments.some(
                (assessment) =>
                  assessment.type === step.kind &&
                  assessment.result === "PASSED",
              ),
          );

          if (unmet.length > 0) {
            throw new AppError(
              422,
              `Cannot schedule interview; unmet prerequisite step(s): ${unmet
                .map((step) => step.label)
                .join(", ")}.`,
            );
          }
        } else if (selectedStep && selectedStep.stepOrder > 1) {
          const previousRequired = steps.filter(
            (step) =>
              step.isRequired && step.stepOrder < selectedStep.stepOrder,
          );

          const unmet = previousRequired.filter(
            (step) =>
              !registration.assessments.some(
                (assessment) =>
                  assessment.type === step.kind &&
                  assessment.result === "PASSED",
              ),
          );

          if (unmet.length > 0) {
            throw new AppError(
              422,
              `Cannot schedule this exam step; prerequisite(s) not passed: ${unmet
                .map((step) => step.label)
                .join(", ")}.`,
            );
          }
        }

        const assessmentKind =
          mode === "INTERVIEW"
            ? "INTERVIEW"
            : (selectedStep?.kind ?? "QUALIFYING_EXAMINATION");

        const isScpApplicant = registration.applicantType !== "REGULAR";

        let resolvedScheduledDate: Date;
        let resolvedScheduledTime: string | null;
        let resolvedVenue: string | null;
        let resolvedNotes: string | null;

        if (isScpApplicant) {
          if (!selectedStep) {
            throw new AppError(
              422,
              `No ${mode.toLowerCase()} step was found in the SCP curriculum configuration. Update Settings -> Curriculum Tab.`,
            );
          }

          if (
            !selectedStep.scheduledDate ||
            !selectedStep.scheduledTime?.trim() ||
            !selectedStep.venue?.trim()
          ) {
            throw new AppError(
              422,
              `SCP ${mode.toLowerCase()} defaults are incomplete in scp_program_steps. Update Settings -> Curriculum Tab.`,
            );
          }

          resolvedScheduledDate = normalizeDateToUtcNoon(
            new Date(selectedStep.scheduledDate),
          );
          resolvedScheduledTime = selectedStep.scheduledTime.trim();
          resolvedVenue = selectedStep.venue.trim();
          resolvedNotes = selectedStep.notes?.trim() || null;
        } else {
          resolvedScheduledDate = normalizeBatchScheduledDate(scheduledDate);
          resolvedScheduledTime = scheduledTime.trim() || null;
          resolvedVenue = venue.trim() || null;
          resolvedNotes = notes?.trim() || null;
        }

        await prisma.$transaction(async (tx) => {
          await tx.earlyRegistrationAssessment.create({
            data: {
              applicationId: registration.id,
              type: assessmentKind as any,
              scheduledDate: resolvedScheduledDate,
              scheduledTime: resolvedScheduledTime,
              venue: resolvedVenue,
              notes: resolvedNotes,
            },
          });

          await tx.earlyRegistrationApplication.update({
            where: { id: registration.id },
            data: { status: targetStatus },
          });
        });

        if (sendEmail !== false) {
          await sharedService.queueEmail(
            registration.id,
            registration.email ?? null,
            mode === "INTERVIEW"
              ? "Interview schedule update"
              : "Assessment schedule update",
            "EXAM_SCHEDULED",
          );
        }

        succeeded.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
        });
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Failed to schedule step."),
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_SCHEDULE_STEP",
      description: `Batch ${mode.toLowerCase()} scheduling: ${succeeded.length} succeeded, ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: ids.length,
      succeeded,
      failed,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/save-scores — Batch record assessment scores and resolve pass/fail status */
export async function batchSaveScores(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { rows, expectedStatuses } = req.body as {
      rows: Array<{
        id: number;
        componentScores?: Record<string, number>;
        totalScore?: number;
        absentNoShow?: boolean;
        remarks?: string | null;
      }>;
      expectedStatuses?: Record<string, string>;
    };

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    const dedupedRows = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      dedupedRows.set(row.id, row);
    }

    const requestedIds = Array.from(dedupedRows.keys());
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: { select: { firstName: true, lastName: true } },
        assessments: { orderBy: { createdAt: "desc" } },
      },
    });

    assertSingleProgramSelection(registrations);
    assertNoStatusSnapshotConflicts(
      expectedStatusMap,
      registrations.map((registration) => ({
        id: registration.id,
        status: registration.status,
        trackingNumber: registration.trackingNumber,
      })),
    );

    const registrationById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );

    const succeeded: BatchSuccessItem[] = [];
    const failed: BatchFailureItem[] = [];
    const configCache = new Map<string, ScpConfigLite | null>();

    for (const row of dedupedRows.values()) {
      const registration = registrationById.get(row.id);
      if (!registration) {
        failed.push({
          id: row.id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
        continue;
      }

      const name = formatBatchName(
        registration.learner.firstName,
        registration.learner.lastName,
      );

      if (
        registration.status !== "ASSESSMENT_TAKEN" &&
        registration.status !== "EXAM_SCHEDULED"
      ) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason:
            'Batch score saving is only supported for "EXAM_SCHEDULED" or "ASSESSMENT_TAKEN" status.',
        });
        continue;
      }

      try {
        const config = await getScpConfigCached(
          configCache,
          registration.schoolYearId,
          registration.applicantType,
        );

        const isNoShow = Boolean(row.absentNoShow);

        const componentScoresRaw = row.componentScores ?? {};
        const normalizedComponentScores = Object.entries(
          componentScoresRaw,
        ).reduce<Record<string, number>>((acc, [key, value]) => {
          const normalizedKey = key.trim().toUpperCase();
          const score = Number(value);
          if (!normalizedKey || !Number.isFinite(score)) return acc;
          if (score < 0 || score > 100) {
            throw new AppError(
              422,
              `Score for ${normalizedKey} must be between 0 and 100.`,
            );
          }

          acc[normalizedKey] = Number(score.toFixed(2));
          return acc;
        }, {});

        const rankingComponents = parseRankingFormulaComponents(
          config?.rankingFormula,
        );

        const totalScore = isNoShow
          ? 0
          : resolveWeightedTotalScore(
              row.totalScore,
              normalizedComponentScores,
              rankingComponents,
            );

        if (totalScore == null || !Number.isFinite(totalScore)) {
          throw new AppError(
            422,
            "Unable to resolve a valid total score for this applicant.",
          );
        }

        const latestAssessment = registration.assessments.find(
          (assessment) => assessment.type !== "INTERVIEW",
        );

        if (!latestAssessment) {
          throw new AppError(
            422,
            "No non-interview assessment record found. Schedule and record assessments first.",
          );
        }

        const matchedStep = config?.steps.find(
          (step) => step.kind === latestAssessment.type,
        );

        const effectiveCutoff = matchedStep?.cutoffScore ?? config?.cutoffScore;
        const isPassed = isNoShow
          ? false
          : effectiveCutoff == null
            ? totalScore >= 75
            : totalScore >= effectiveCutoff;
        const targetStatus: ApplicationStatus = isPassed
          ? "PASSED"
          : "SUBMITTED_BEERF";
        const failureReason = isPassed
          ? null
          : resolveAssessmentFailureReason({
              isNoShow,
              totalScore,
              effectiveCutoff,
            });

        assertEarlyRegTransition(
          registration.status,
          targetStatus,
          `Cannot resolve assessment outcome while status is "${registration.status}".`,
        );

        const componentSummary = summarizeComponentScores(
          normalizedComponentScores,
        );
        const notes = [
          row.remarks?.trim(),
          failureReason
            ? `Assessment result: FAILED. ${failureReason} Automatically rerouted to REGULAR enrollment track.`
            : null,
          componentSummary,
        ]
          .filter((segment): segment is string => Boolean(segment))
          .join(" | ");

        await prisma.$transaction(async (tx) => {
          await tx.earlyRegistrationAssessment.update({
            where: { id: latestAssessment.id },
            data: {
              score: Number(totalScore.toFixed(2)),
              result: isPassed ? "PASSED" : "FAILED",
              notes: notes || null,
              conductedAt: new Date(),
            },
          });

          await tx.earlyRegistrationApplication.update({
            where: { id: registration.id },
            data: {
              status: targetStatus,
              ...(targetStatus === "SUBMITTED_BEERF"
                ? { applicantType: "REGULAR" }
                : {}),
            },
          });
        });

        if (!isPassed && failureReason) {
          await sharedService.queueEmail(
            registration.id,
            registration.email ?? null,
            `Assessment Result - ${registration.trackingNumber}: ${failureReason} Automatically rerouted to REGULAR enrollment track.`,
            "ASSESSMENT_FAILED",
          );
        }

        succeeded.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
        });
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Failed to save scores."),
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_SAVE_SCORES",
      description: `Batch save scores: ${succeeded.length} succeeded, ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: rows.length,
      succeeded,
      failed,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/finalize-interview — Batch resolve interview outcomes */
export async function batchFinalizeInterview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { rows, expectedStatuses } = req.body as {
      rows: Array<{
        id: number;
        decision: "PASS" | "REJECT";
        rejectOutcome?: "SUBMITTED_BEERF" | "REJECTED";
        interviewScore?: number | null;
        remarks?: string | null;
      }>;
      expectedStatuses?: Record<string, string>;
    };

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    const dedupedRows = new Map<number, (typeof rows)[number]>();
    for (const row of rows) {
      dedupedRows.set(row.id, row);
    }

    const requestedIds = Array.from(dedupedRows.keys());
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: { select: { firstName: true, lastName: true } },
        assessments: { orderBy: { createdAt: "desc" } },
      },
    });

    assertSingleProgramSelection(registrations);
    assertNoStatusSnapshotConflicts(
      expectedStatusMap,
      registrations.map((registration) => ({
        id: registration.id,
        status: registration.status,
        trackingNumber: registration.trackingNumber,
      })),
    );

    const registrationById = new Map(
      registrations.map((registration) => [registration.id, registration]),
    );

    const succeeded: BatchSuccessItem[] = [];
    const failed: BatchFailureItem[] = [];

    for (const row of dedupedRows.values()) {
      const registration = registrationById.get(row.id);
      if (!registration) {
        failed.push({
          id: row.id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
        continue;
      }

      const name = formatBatchName(
        registration.learner.firstName,
        registration.learner.lastName,
      );

      const targetStatus: ApplicationStatus =
        row.decision === "PASS"
          ? "READY_FOR_ENROLLMENT"
          : (row.rejectOutcome ?? "SUBMITTED_BEERF");

      try {
        assertEarlyRegTransition(
          registration.status,
          targetStatus,
          `Cannot finalize interview while status is "${registration.status}".`,
        );

        const latestInterview = registration.assessments.find(
          (assessment) => assessment.type === "INTERVIEW",
        );

        await prisma.$transaction(async (tx) => {
          if (latestInterview) {
            await tx.earlyRegistrationAssessment.update({
              where: { id: latestInterview.id },
              data: {
                score:
                  typeof row.interviewScore === "number"
                    ? row.interviewScore
                    : null,
                result: row.decision === "PASS" ? "PASSED" : "FAILED",
                notes: row.remarks?.trim() || null,
                conductedAt: new Date(),
              },
            });
          } else {
            await tx.earlyRegistrationAssessment.create({
              data: {
                applicationId: registration.id,
                type: "INTERVIEW",
                score:
                  typeof row.interviewScore === "number"
                    ? row.interviewScore
                    : null,
                result: row.decision === "PASS" ? "PASSED" : "FAILED",
                notes: row.remarks?.trim() || null,
                conductedAt: new Date(),
              },
            });
          }

          await tx.earlyRegistrationApplication.update({
            where: { id: registration.id },
            data: {
              status: targetStatus,
              ...(targetStatus === "SUBMITTED_BEERF"
                ? { applicantType: "REGULAR" }
                : {}),
            },
          });
        });

        succeeded.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
        });
      } catch (error) {
        failed.push({
          id: registration.id,
          name,
          trackingNumber: registration.trackingNumber,
          reason: toBatchReason(error, "Failed to finalize interview."),
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_FINALIZE_INTERVIEW",
      description: `Batch finalize interview: ${succeeded.length} succeeded, ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: rows.length,
      succeeded,
      failed,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch-process — Batch status transitions for early registrations */
export async function batchProcess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids, targetStatus } = req.body as {
      ids: number[];
      targetStatus: ApplicationStatus;
    };

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const applications = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: ids } },
      include: { learner: true },
    });

    const succeeded: { id: number; name: string; trackingNumber: string }[] =
      [];
    const failed: {
      id: number;
      name: string;
      trackingNumber: string;
      reason: string;
    }[] = [];

    for (const app of applications) {
      const name = `${app.learner.lastName}, ${app.learner.firstName}`;
      const allowed = EARLY_REG_TRANSITIONS[app.status] ?? [];
      if (!allowed.includes(targetStatus)) {
        failed.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
          reason: `Cannot move from "${app.status}" to "${targetStatus}".`,
        });
        continue;
      }

      try {
        await prisma.earlyRegistrationApplication.update({
          where: { id: app.id },
          data: {
            status: targetStatus,
            ...(targetStatus === "SUBMITTED_BEERF" ||
            app.status === "FAILED_ASSESSMENT"
              ? { applicantType: "REGULAR" }
              : {}),
          },
        });
        succeeded.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
        });
      } catch {
        failed.push({
          id: app.id,
          name,
          trackingNumber: app.trackingNumber,
          reason: "Database update error.",
        });
      }
    }

    // Mark IDs not found as failed
    const foundIds = new Set(applications.map((a) => a.id));
    for (const id of ids) {
      if (!foundIds.has(id)) {
        failed.push({
          id,
          name: "Unknown",
          trackingNumber: "N/A",
          reason: "Application not found.",
        });
      }
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_PROCESS",
      description: `Batch processed ${succeeded.length} early registrations to ${targetStatus}. ${failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({ succeeded, failed });
  } catch (err) {
    next(err);
  }
}

/** GET /:id/detailed — Get early registration with full assessment/pipeline data */
export async function showDetailed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const detailed = await sharedService.getDetailedApplicationOrThrow(id, {
      includeAuditLogs: true,
      allowEnrollmentFallback: false,
    });
    res.json(detailed);
  } catch (err) {
    next(err);
  }
}

// ═══════════════════════════════════════════════════════════
// APPROVE (Pre-register) – promotes early-reg to enrollment
// ═══════════════════════════════════════════════════════════

export async function approve(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const { sectionId } = req.body;
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.READY_FOR_ENROLLMENT,
      `Cannot approve an early registration with status "${reg.status}". Only PASSED or INTERVIEW_SCHEDULED applications can be approved.`,
    );

    const result = await prisma.$transaction(async (tx) => {
      // Check section capacity
      const [section] = await tx.$queryRaw<
        { id: number; maxCapacity: number }[]
      >`SELECT id, "max_capacity" as "maxCapacity" FROM "sections" WHERE id = ${sectionId} FOR UPDATE`;

      if (!section) throw new AppError(404, "Section not found");

      const enrolledCount = await tx.enrollmentRecord.count({
        where: { sectionId },
      });
      if (enrolledCount >= section.maxCapacity) {
        throw new AppError(422, "This section has reached maximum capacity");
      }

      // Create EnrollmentApplication linked to early-reg
      const enrollmentApp = await tx.enrollmentApplication.create({
        data: {
          learnerId: reg.learnerId,
          earlyRegistrationId: reg.id,
          schoolYearId: reg.schoolYearId,
          gradeLevelId: reg.gradeLevelId,
          applicantType: reg.applicantType,
          learnerType: reg.learnerType,
          status: "READY_FOR_ENROLLMENT",
          admissionChannel: reg.channel,
          isPrivacyConsentGiven: reg.isPrivacyConsentGiven,
          encodedById: req.user!.userId,
        },
      });

      // Link existing checklist to the new enrollment application
      const existingChecklist = await tx.applicationChecklist.findUnique({
        where: { earlyRegistrationId: reg.id },
      });

      if (existingChecklist) {
        await tx.applicationChecklist.update({
          where: { id: existingChecklist.id },
          data: { enrollmentId: enrollmentApp.id },
        });
      } else {
        // Create new checklist linked to both
        await tx.applicationChecklist.create({
          data: {
            enrollmentId: enrollmentApp.id,
            earlyRegistrationId: reg.id,
          },
        });
      }

      // Create enrollment record
      const enrollment = await tx.enrollmentRecord.create({
        data: {
          enrollmentApplicationId: enrollmentApp.id,
          sectionId,
          schoolYearId: reg.schoolYearId,
          enrolledById: req.user!.userId,
        },
      });

      // Update early-reg status
      await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "READY_FOR_ENROLLMENT" },
      });

      return enrollment;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "APPLICATION_APPROVED",
      description: `Approved early registration #${id} for ${reg.learner.firstName} ${reg.learner.lastName} and pre-registered to section ${sectionId}`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/temporarily-enroll */
export async function temporarilyEnroll(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const learnerPendingLrn =
      (reg.learner as { isPendingLrnCreation?: boolean })
        .isPendingLrnCreation === true;

    const checklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
      select: { isPsaBirthCertPresented: true },
    });

    if (learnerPendingLrn && !checklist?.isPsaBirthCertPresented) {
      throw new AppError(
        422,
        "PSA Birth Certificate is required before temporary enrollment for learners without LRN.",
      );
    }

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.TEMPORARILY_ENROLLED,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const earlyRegUpdated = await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "TEMPORARILY_ENROLLED" },
      });

      const enrollmentApp = await tx.enrollmentApplication.findFirst({
        where: { earlyRegistrationId: id },
        orderBy: { createdAt: "desc" },
      });

      if (enrollmentApp) {
        await tx.enrollmentApplication.update({
          where: { id: enrollmentApp.id },
          data: {
            status: "TEMPORARILY_ENROLLED",
            isTemporarilyEnrolled: true,
          },
        });
      }

      return earlyRegUpdated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} marked as temporarily enrolled`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/enroll */
export async function enroll(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const learnerPendingLrn =
      (reg.learner as { isPendingLrnCreation?: boolean })
        .isPendingLrnCreation === true;

    assertEarlyRegTransition(reg.status, ApplicationStatus.ENROLLED);

    if (learnerPendingLrn) {
      throw new AppError(
        422,
        "Cannot finalize enrollment while learner is tagged as pending LRN creation.",
      );
    }

    const checklist = await prisma.applicationChecklist.findUnique({
      where: { earlyRegistrationId: id },
    });

    if (!checklist) {
      throw new AppError(
        422,
        "Requirement checklist not found for this applicant.",
      );
    }

    const requirements = getRequiredDocuments({
      learnerType: reg.learnerType,
      gradeLevel: reg.gradeLevel.name,
      applicantType: reg.applicantType,
      isLwd: reg.learner.isLearnerWithDisability,
      isPeptAePasser: false,
    });

    const missingMandatory: string[] = [];
    for (const requirement of requirements) {
      if (!requirement.isRequired) continue;

      let isMet = false;
      switch (requirement.type) {
        case "BEEF":
          isMet = true;
          break;
        case "CONFIRMATION_SLIP":
          isMet = checklist.isConfirmationSlipReceived;
          break;
        case "PSA_BIRTH_CERTIFICATE":
          isMet = checklist.isPsaBirthCertPresented;
          break;
        case "SF9_REPORT_CARD":
        case "ACADEMIC_RECORD":
          isMet = checklist.isSf9Submitted;
          break;
        case "GOOD_MORAL_CERTIFICATE":
          isMet = checklist.isGoodMoralPresented;
          break;
        case "MEDICAL_CERTIFICATE":
        case "MEDICAL_EVALUATION":
          isMet = checklist.isMedicalEvalSubmitted;
          break;
        case "CERTIFICATE_OF_RECOGNITION":
          isMet = checklist.isCertOfRecognitionPresented;
          break;
        case "AFFIDAVIT_OF_UNDERTAKING":
          isMet = checklist.isUndertakingSigned;
          break;
        default:
          isMet = true;
      }

      if (!isMet) {
        missingMandatory.push(requirement.label);
      }
    }

    if (missingMandatory.length > 0) {
      throw new AppError(
        422,
        `Cannot finalize enrollment; missing requirements: ${missingMandatory.join(", ")}`,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const earlyRegUpdated = await tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "ENROLLED" },
      });

      const enrollmentApp = await tx.enrollmentApplication.findFirst({
        where: { earlyRegistrationId: id },
        orderBy: { createdAt: "desc" },
      });

      if (enrollmentApp) {
        await tx.enrollmentApplication.update({
          where: { id: enrollmentApp.id },
          data: {
            status: "ENROLLED",
            isTemporarilyEnrolled: false,
          },
        });
      }

      await tx.learner.update({
        where: { id: reg.learnerId },
        data: { isPendingLrnCreation: false },
      });

      return earlyRegUpdated;
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} finalized as ENROLLED`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/assign-lrn */
export async function assignLrn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);
    const lrn = String(req.body?.lrn ?? "").trim();

    if (!LRN_REGEX.test(lrn)) {
      throw new AppError(422, "LRN must be exactly 12 digits.");
    }

    try {
      await prisma.learner.update({
        where: { id: reg.learnerId },
        data: {
          lrn,
          isPendingLrnCreation: false,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(409, "LRN already exists.");
      }
      throw error;
    }

    await auditLog({
      userId: req.user!.userId,
      actionType: "LEARNER_LRN_ASSIGNED",
      description: `Assigned LRN ${lrn} to learner #${reg.learnerId} from early registration #${id}`,
      subjectType: "Learner",
      recordId: reg.learnerId,
      req,
    }).catch(() => {});

    res.json({
      message: "LRN assigned successfully.",
      learnerId: reg.learnerId,
      lrn,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /:id/mark-interview-passed */
export async function markInterviewPassed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(String(req.params.id));
    const reg = await findEarlyRegOrThrow(id);

    assertEarlyRegTransition(
      reg.status,
      ApplicationStatus.READY_FOR_ENROLLMENT,
      `Cannot mark interview passed. Current status: "${reg.status}".`,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const latestInterviewAssessment =
        await tx.earlyRegistrationAssessment.findFirst({
          where: { applicationId: id, type: "INTERVIEW" },
          orderBy: { createdAt: "desc" },
        });

      if (latestInterviewAssessment) {
        await tx.earlyRegistrationAssessment.update({
          where: { id: latestInterviewAssessment.id },
          data: {
            result: "PASSED",
            conductedAt: new Date(),
          },
        });
      } else {
        await tx.earlyRegistrationAssessment.create({
          data: {
            applicationId: id,
            type: "INTERVIEW",
            result: "PASSED",
            conductedAt: new Date(),
          },
        });
      }

      return tx.earlyRegistrationApplication.update({
        where: { id },
        data: { status: "READY_FOR_ENROLLMENT" },
      });
    });

    await auditLog({
      userId: req.user!.userId,
      actionType: "STATUS_CHANGE",
      description: `Early registration #${id} marked ready for enrollment (READY_FOR_ENROLLMENT) after interview pass`,
      subjectType: "EarlyRegistrationApplication",
      recordId: id,
      req,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

/** POST /batch/assign-regular-section/preview — Generate automated sectioning plan for BEC applicants */
export async function batchAssignRegularSectionsPreview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { ids, expectedStatuses } = req.body as {
      ids: number[];
      expectedStatuses?: Record<string, string>;
    };

    const requestedIds = Array.from(new Set(ids));
    if (requestedIds.length === 0) {
      throw new AppError(400, "No application IDs provided.");
    }

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);

    // 1. Fetch applicants with their data
    const registrations = await prisma.earlyRegistrationApplication.findMany({
      where: { id: { in: requestedIds } },
      include: {
        learner: {
          select: {
            firstName: true,
            lastName: true,
            lrn: true,
            sex: true,
            isPendingLrnCreation: true,
            isLearnerWithDisability: true,
          },
        },
        gradeLevel: { select: { id: true, name: true } },
        checklist: true,
        enrollmentApplications: {
          include: { previousSchool: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (registrations.length === 0) {
      throw new AppError(404, "No applications found.");
    }

    assertNoStatusSnapshotConflicts(
      expectedStatusMap,
      registrations.map((r) => ({
        id: r.id,
        status: r.status,
        trackingNumber: r.trackingNumber,
      })),
    );

    // 2. Validate single grade level
    const gradeLevelIds = new Set(registrations.map((r) => r.gradeLevelId));
    if (gradeLevelIds.size > 1) {
      throw new AppError(
        422,
        "Automated sectioning requires applicants from a single grade level.",
      );
    }
    const gradeLevelId = registrations[0].gradeLevelId;

    // 3. Filter eligible vs blocked
    const eligible: Array<{
      registration: (typeof registrations)[number];
      generalAverage: number | null;
    }> = [];
    const blocked: Array<{
      id: number;
      name: string;
      trackingNumber: string;
      reason: string;
    }> = [];

    for (const reg of registrations) {
      const name = formatBatchName(reg.learner.firstName, reg.learner.lastName);
      const generalAverage =
        reg.enrollmentApplications[0]?.previousSchool?.generalAverage ?? null;

      if (reg.applicantType !== "REGULAR") {
        blocked.push({
          id: reg.id,
          name,
          trackingNumber: reg.trackingNumber,
          reason: "Not a Regular (BEC) applicant.",
        });
        continue;
      }

      if (reg.status !== "VERIFIED") {
        blocked.push({
          id: reg.id,
          name,
          trackingNumber: reg.trackingNumber,
          reason: `Invalid status: ${reg.status}. Must be VERIFIED.`,
        });
        continue;
      }

      const academicStatus = extractChecklistAcademicStatus(reg.checklist);
      if (academicStatus === "RETAINED") {
        blocked.push({
          id: reg.id,
          name,
          trackingNumber: reg.trackingNumber,
          reason: "Learner flagged as RETAINED.",
        });
        continue;
      }

      const requirements = getRequiredDocuments({
        learnerType: reg.learnerType,
        gradeLevel: reg.gradeLevel.name,
        applicantType: reg.applicantType,
        isLwd: Boolean(reg.learner.isLearnerWithDisability),
        isPeptAePasser: false,
        documentRequirements: null,
      });

      const missingMandatory = computeMissingMandatoryRequirements(
        requirements,
        extractChecklistState(reg.checklist),
      );

      if (missingMandatory.length > 0) {
        blocked.push({
          id: reg.id,
          name,
          trackingNumber: reg.trackingNumber,
          reason: `Missing documents: ${missingMandatory.join(", ")}.`,
        });
        continue;
      }

      eligible.push({ registration: reg, generalAverage });
    }

    // 4. Sort eligible by General Average (desc)
    eligible.sort((a, b) => (b.generalAverage ?? 0) - (a.generalAverage ?? 0));

    // 5. Fetch available Regular sections
    const rawSections = await prisma.section.findMany({
      where: {
        gradeLevelId,
        programType: "REGULAR",
      },
      include: {
        _count: {
          select: { enrollmentRecords: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    const homogeneousSections = rawSections.filter(
      (s) => s.isHomogeneous && !s.isSnake,
    );
    const snakeSections = rawSections.filter((s) => s.isSnake);

    const sectionStates: Record<
      number,
      {
        section: (typeof rawSections)[number];
        available: number;
        planned: number;
      }
    > = {};
    for (const s of rawSections) {
      sectionStates[s.id] = {
        section: s,
        available: Math.max(0, s.maxCapacity - s._count.enrollmentRecords),
        planned: 0,
      };
    }

    const assignments: any[] = [];
    const unassigned: any[] = [];

    // 6. Distribution Logic
    let pool = [...eligible];

    // Phase A: Homogeneous (Top Performers First)
    for (const hSec of homogeneousSections) {
      const state = sectionStates[hSec.id];
      while (state.planned < state.available && pool.length > 0) {
        const item = pool.shift()!;
        state.planned++;
        assignments.push({
          id: item.registration.id,
          name: formatBatchName(
            item.registration.learner.firstName,
            item.registration.learner.lastName,
          ),
          trackingNumber: item.registration.trackingNumber,
          targetStatus:
            item.registration.learner.isPendingLrnCreation ||
            !item.registration.learner.lrn
              ? "TEMPORARILY_ENROLLED"
              : "ENROLLED",
          generalAverage: item.generalAverage,
          sectionId: hSec.id,
          sectionName: hSec.name,
          sectionDisplayName: hSec.displayName || hSec.name,
          lane: "HOMOGENEOUS",
        });
      }
    }

    // Phase B: Snake Distribution
    if (snakeSections.length > 0 && pool.length > 0) {
      let forward = true;
      while (pool.length > 0) {
        let assignedInPass = false;

        const range = Array.from({ length: snakeSections.length }, (_, i) =>
          forward ? i : snakeSections.length - 1 - i,
        );

        for (const idx of range) {
          if (pool.length === 0) break;
          const sec = snakeSections[idx];
          const state = sectionStates[sec.id];

          if (state.planned < state.available) {
            const item = pool.shift()!;
            state.planned++;
            assignedInPass = true;
            assignments.push({
              id: item.registration.id,
              name: formatBatchName(
                item.registration.learner.firstName,
                item.registration.learner.lastName,
              ),
              trackingNumber: item.registration.trackingNumber,
              targetStatus:
                item.registration.learner.isPendingLrnCreation ||
                !item.registration.learner.lrn
                  ? "TEMPORARILY_ENROLLED"
                  : "ENROLLED",
              generalAverage: item.generalAverage,
              sectionId: sec.id,
              sectionName: sec.name,
              sectionDisplayName: sec.displayName || sec.name,
              lane: "SNAKE",
            });
          }
        }

        if (!assignedInPass) break;
        forward = !forward;
      }
    }

    // Phase C: Remaining pool
    for (const item of pool) {
      unassigned.push({
        id: item.registration.id,
        name: formatBatchName(
          item.registration.learner.firstName,
          item.registration.learner.lastName,
        ),
        trackingNumber: item.registration.trackingNumber,
        generalAverage: item.generalAverage,
        reason: "No available slots in the configured sectioning lanes.",
      });
    }

    res.json({
      processed: requestedIds.length,
      gradeLevelId,
      gradeLevelName: registrations[0].gradeLevel.name,
      summary: {
        eligibleCount: eligible.length,
        assignedCount: assignments.length,
        blockedCount: blocked.length,
        unassignedCount: unassigned.length,
        homogeneousSectionCount: homogeneousSections.length,
        snakeSectionCount: snakeSections.length,
      },
      sections: rawSections.map((s) => ({
        sectionId: s.id,
        sectionName: s.name,
        sectionDisplayName: s.displayName || s.name,
        sortOrder: s.sortOrder,
        lane: s.isSnake ? "SNAKE" : "HOMOGENEOUS",
        maxCapacity: s.maxCapacity,
        enrolledCount: s._count.enrollmentRecords,
        availableSlots: sectionStates[s.id].available,
        plannedCount: sectionStates[s.id].planned,
        remainingSlots:
          sectionStates[s.id].available - sectionStates[s.id].planned,
      })),
      assignments,
      blocked,
      unassigned,
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /batch/assign-regular-section/commit — Apply the automated sectioning plan */
export async function batchAssignRegularSectionsCommit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { assignments, expectedStatuses } = req.body as {
      assignments: Array<{
        id: number;
        sectionId: number;
        targetStatus: ApplicationStatus;
      }>;
      expectedStatuses?: Record<string, string>;
    };

    if (!Array.isArray(assignments) || assignments.length === 0) {
      throw new AppError(400, "No assignments provided.");
    }

    const expectedStatusMap = parseExpectedStatusMap(expectedStatuses);
    const requestedIds = assignments.map((a) => a.id);

    const outcome = await prisma.$transaction(
      async (tx) => {
        const sectionIds = Array.from(
          new Set(assignments.map((a) => a.sectionId)),
        );
        if (sectionIds.length > 0) {
          await tx.$queryRaw`
            SELECT id FROM "sections" WHERE id IN (${Prisma.join(sectionIds)}) FOR UPDATE
          `;
        }

        await tx.$queryRaw`
          SELECT id FROM "early_registration_applications" WHERE id IN (${Prisma.join(requestedIds)}) FOR UPDATE
        `;

        const registrations = await tx.earlyRegistrationApplication.findMany({
          where: { id: { in: requestedIds } },
          include: {
            learner: true,
            gradeLevel: true,
            checklist: true,
            enrollmentApplications: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });

        assertNoStatusSnapshotConflicts(
          expectedStatusMap,
          registrations.map((r) => ({
            id: r.id,
            status: r.status,
            trackingNumber: r.trackingNumber,
          })),
        );

        const regById = new Map(registrations.map((r) => [r.id, r]));
        const succeeded: any[] = [];
        const failed: any[] = [];

        for (const plan of assignments) {
          const reg = regById.get(plan.id);
          if (!reg) continue;

          const name = formatBatchName(
            reg.learner.firstName,
            reg.learner.lastName,
          );

          try {
            const enrolledCount = await tx.enrollmentRecord.count({
              where: { sectionId: plan.sectionId },
            });
            const section = await tx.section.findUnique({
              where: { id: plan.sectionId },
              select: { maxCapacity: true },
            });

            if (!section || enrolledCount >= section.maxCapacity) {
              failed.push({
                id: reg.id,
                name,
                trackingNumber: reg.trackingNumber,
                reason: "Section reached capacity during processing.",
              });
              continue;
            }

            const existingEnrollmentApp = reg.enrollmentApplications[0];

            const enrollmentApplication = existingEnrollmentApp
              ? await tx.enrollmentApplication.update({
                  where: { id: existingEnrollmentApp.id },
                  data: {
                    status: plan.targetStatus,
                    isTemporarilyEnrolled:
                      plan.targetStatus === "TEMPORARILY_ENROLLED",
                  },
                })
              : await tx.enrollmentApplication.create({
                  data: {
                    learnerId: reg.learnerId,
                    earlyRegistrationId: reg.id,
                    schoolYearId: reg.schoolYearId,
                    gradeLevelId: reg.gradeLevelId,
                    applicantType: reg.applicantType,
                    learnerType: reg.learnerType,
                    status: plan.targetStatus,
                    admissionChannel: reg.channel,
                    isPrivacyConsentGiven: reg.isPrivacyConsentGiven,
                    encodedById: req.user!.userId,
                    isTemporarilyEnrolled:
                      plan.targetStatus === "TEMPORARILY_ENROLLED",
                  },
                });

            const checklistState = extractChecklistState(reg.checklist);
            const checklistAcademicStatus = extractChecklistAcademicStatus(
              reg.checklist,
            );

            await tx.applicationChecklist.upsert({
              where: { earlyRegistrationId: reg.id },
              create: {
                earlyRegistrationId: reg.id,
                enrollmentId: enrollmentApplication.id,
                updatedById: req.user!.userId,
                academicStatus: checklistAcademicStatus,
                ...checklistState,
              },
              update: {
                enrollmentId: enrollmentApplication.id,
                updatedById: req.user!.userId,
                academicStatus: checklistAcademicStatus,
              },
            });

            await tx.enrollmentRecord.upsert({
              where: { enrollmentApplicationId: enrollmentApplication.id },
              create: {
                enrollmentApplicationId: enrollmentApplication.id,
                sectionId: plan.sectionId,
                schoolYearId: reg.schoolYearId,
                enrolledById: req.user!.userId,
              },
              update: {
                sectionId: plan.sectionId,
                schoolYearId: reg.schoolYearId,
                enrolledById: req.user!.userId,
              },
            });

            await tx.earlyRegistrationApplication.update({
              where: { id: reg.id },
              data: { status: plan.targetStatus },
            });

            if (plan.targetStatus === "ENROLLED") {
              await tx.learner.update({
                where: { id: reg.learnerId },
                data: { isPendingLrnCreation: false },
              });
            }

            succeeded.push({
              id: reg.id,
              name,
              trackingNumber: reg.trackingNumber,
              status: plan.targetStatus,
              sectionId: plan.sectionId,
            });
          } catch (error) {
            failed.push({
              id: reg.id,
              name,
              trackingNumber: reg.trackingNumber,
              reason: toBatchReason(error, "Failed to commit assignment."),
            });
          }
        }

        return { succeeded, failed };
      },
      { timeout: 30000 },
    );

    await auditLog({
      userId: req.user!.userId,
      actionType: "EARLY_REG_BATCH_ASSIGN_REGULAR_SECTION_COMMIT",
      description: `Committed automated sectioning plan: ${outcome.succeeded.length} succeeded, ${outcome.failed.length} failed.`,
      subjectType: "EarlyRegistrationApplication",
      recordId: null,
      req,
    }).catch(() => {});

    res.json({
      processed: assignments.length,
      succeeded: outcome.succeeded,
      failed: outcome.failed,
    });
  } catch (err) {
    next(err);
  }
}
