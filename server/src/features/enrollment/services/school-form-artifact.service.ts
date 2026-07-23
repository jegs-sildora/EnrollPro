import { createHash } from "node:crypto";
import {
  Prisma,
  type SchoolFormType,
} from "../../../generated/prisma/index.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../lib/AppError.js";

type DatabaseClient = Pick<
  typeof prisma,
  "section" | "enrollmentRecord" | "schoolYear" | "schoolFormArtifact"
>;

interface Sf5LearnerPayload {
  learnerId: number;
  lrn: string | null;
  lastName: string;
  firstName: string;
  middleName: string | null;
  extensionName: string | null;
  sex: string;
  birthdate: string;
  finalAverage: number | null;
  eosyStatus: string | null;
  academicDeficiencyNote: string | null;
  smartOutcome: {
    revision: string;
    publishedAt: string;
    finalOutcome: string;
    learningAreas: Array<{
      code: string;
      name: string;
      finalGrade: number;
      result: string;
    }>;
  } | null;
}

export interface Sf5Payload {
  generatedAt: string;
  section: {
    id: number;
    name: string;
    gradeLevel: { id: number; name: string };
    schoolYear: { id: number; yearLabel: string };
    adviser: { firstName: string; lastName: string } | null;
    isEosyFinalized: boolean;
  };
  totalLearners: number;
  learners: Sf5LearnerPayload[];
}

interface SexTotals {
  male: number;
  female: number;
  total: number;
}

export interface Sf6Payload {
  generatedAt: string;
  schoolYear: { id: number; yearLabel: string };
  rows: Array<{
    gradeId: number;
    gradeName: string;
    initialEnrollment: SexTotals;
    promoted: SexTotals;
    retained: SexTotals;
    dropOut: SexTotals;
    transferOut: SexTotals;
    irregular: SexTotals;
    noStatus: SexTotals;
  }>;
  grandTotal: {
    male: number;
    female: number;
    total: number;
    promoted: number;
    retained: number;
    dropOut: number;
    transferOut: number;
  };
}

export interface SchoolFormArtifactStatus {
  formType: SchoolFormType;
  scopeKey: string;
  recorded: boolean;
  current: boolean;
  artifactId: number | null;
  version: number | null;
  recordedAt: Date | null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)]),
    );
  }
  return value;
}

export function hashPayload(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function toDateOnly(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function withoutGeneratedAt<T extends { generatedAt: string }>(
  payload: T,
): Omit<T, "generatedAt"> {
  const { generatedAt: _generatedAt, ...source } = payload;
  return source;
}

export function getSchoolFormSourceHash<T extends { generatedAt: string }>(
  payload: T,
): string {
  return hashPayload(withoutGeneratedAt(payload));
}

export async function buildSf5Payload(
  sectionId: number,
  client: DatabaseClient = prisma,
): Promise<Sf5Payload> {
  const section = await client.section.findUnique({
    where: { id: sectionId },
    include: {
      gradeLevel: { select: { id: true, name: true } },
      schoolYear: { select: { id: true, yearLabel: true } },
      advisers: {
        where: { status: "ACTIVE" },
        orderBy: [{ effectiveFrom: "desc" }, { id: "desc" }],
        include: {
          teacher: { select: { firstName: true, lastName: true } },
        },
        take: 1,
      },
    },
  });

  if (!section) {
    throw new AppError(404, "Section not found.");
  }

  const records = await client.enrollmentRecord.findMany({
    where: { sectionId },
    orderBy: [
      { learner: { lastName: "asc" } },
      { learner: { firstName: "asc" } },
    ],
    include: {
      learner: {
        select: {
          lrn: true,
          firstName: true,
          lastName: true,
          middleName: true,
          extensionName: true,
          sex: true,
          birthdate: true,
        },
      },
      smartAcademicOutcome: {
        include: {
          learningAreaResults: {
            orderBy: [{ learningAreaCode: "asc" }],
          },
        },
      },
    },
  });

  const adviser = section.advisers[0]?.teacher ?? null;

  return {
    generatedAt: new Date().toISOString(),
    section: {
      id: section.id,
      name: section.name,
      gradeLevel: section.gradeLevel,
      schoolYear: section.schoolYear,
      adviser,
      isEosyFinalized: section.isEosyFinalized,
    },
    totalLearners: records.length,
    learners: records.map((record) => ({
      learnerId: record.learnerId,
      lrn: record.learner.lrn,
      lastName: record.learner.lastName,
      firstName: record.learner.firstName,
      middleName: record.learner.middleName,
      extensionName: record.learner.extensionName,
      sex: record.learner.sex,
      birthdate: toDateOnly(record.learner.birthdate),
      finalAverage: record.finalAverage,
      eosyStatus: record.eosyStatus,
      academicDeficiencyNote: record.academicDeficiencyNote,
      smartOutcome: record.smartAcademicOutcome
        ? {
            revision: record.smartAcademicOutcome.smartRevision,
            publishedAt:
              record.smartAcademicOutcome.publishedAt.toISOString(),
            finalOutcome: record.smartAcademicOutcome.finalOutcome,
            learningAreas:
              record.smartAcademicOutcome.learningAreaResults.map((result) => ({
                code: result.learningAreaCode,
                name: result.learningAreaName,
                finalGrade: result.finalGrade,
                result: result.result,
              })),
          }
        : null,
    })),
  };
}

export async function buildSf6Payload(
  schoolYearId: number,
  client: DatabaseClient = prisma,
): Promise<Sf6Payload> {
  const schoolYear = await client.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true, yearLabel: true },
  });
  if (!schoolYear) {
    throw new AppError(404, "School year not found.");
  }

  const records = await client.enrollmentRecord.findMany({
    where: { schoolYearId },
    include: {
      learner: { select: { sex: true } },
      section: {
        include: {
          gradeLevel: {
            select: { id: true, name: true, displayOrder: true },
          },
        },
      },
    },
  });

  interface MutableGradeRow {
    gradeId: number;
    gradeName: string;
    displayOrder: number;
    male: number;
    female: number;
    promoted: { male: number; female: number };
    retained: { male: number; female: number };
    dropOut: { male: number; female: number };
    transferOut: { male: number; female: number };
    irregular: { male: number; female: number };
    noStatus: { male: number; female: number };
  }

  const gradeRows = new Map<number, MutableGradeRow>();
  for (const record of records) {
    const gradeLevel = record.section.gradeLevel;
    const row = gradeRows.get(gradeLevel.id) ?? {
      gradeId: gradeLevel.id,
      gradeName: gradeLevel.name,
      displayOrder: gradeLevel.displayOrder,
      male: 0,
      female: 0,
      promoted: { male: 0, female: 0 },
      retained: { male: 0, female: 0 },
      dropOut: { male: 0, female: 0 },
      transferOut: { male: 0, female: 0 },
      irregular: { male: 0, female: 0 },
      noStatus: { male: 0, female: 0 },
    };
    gradeRows.set(gradeLevel.id, row);

    const sexKey = record.learner.sex === "MALE" ? "male" : "female";
    row[sexKey] += 1;
    switch (record.eosyStatus) {
      case "PROMOTED":
        row.promoted[sexKey] += 1;
        break;
      case "RETAINED":
        row.retained[sexKey] += 1;
        break;
      case "DROPPED_OUT":
        row.dropOut[sexKey] += 1;
        break;
      case "TRANSFERRED_OUT":
        row.transferOut[sexKey] += 1;
        break;
      case "CONDITIONALLY_PROMOTED":
        row.irregular[sexKey] += 1;
        break;
      default:
        row.noStatus[sexKey] += 1;
    }
  }

  const withTotal = (value: { male: number; female: number }): SexTotals => ({
    ...value,
    total: value.male + value.female,
  });

  const rows = Array.from(gradeRows.values())
    .sort(
      (left, right) =>
        left.displayOrder - right.displayOrder ||
        left.gradeName.localeCompare(right.gradeName),
    )
    .map((row) => ({
      gradeId: row.gradeId,
      gradeName: row.gradeName,
      initialEnrollment: withTotal({
        male: row.male,
        female: row.female,
      }),
      promoted: withTotal(row.promoted),
      retained: withTotal(row.retained),
      dropOut: withTotal(row.dropOut),
      transferOut: withTotal(row.transferOut),
      irregular: withTotal(row.irregular),
      noStatus: withTotal(row.noStatus),
    }));

  const grandTotal = rows.reduce(
    (total, row) => ({
      male: total.male + row.initialEnrollment.male,
      female: total.female + row.initialEnrollment.female,
      total: total.total + row.initialEnrollment.total,
      promoted: total.promoted + row.promoted.total,
      retained: total.retained + row.retained.total,
      dropOut: total.dropOut + row.dropOut.total,
      transferOut: total.transferOut + row.transferOut.total,
    }),
    {
      male: 0,
      female: 0,
      total: 0,
      promoted: 0,
      retained: 0,
      dropOut: 0,
      transferOut: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    schoolYear,
    rows,
    grandTotal,
  };
}

async function getPayloadForForm(
  formType: SchoolFormType,
  schoolYearId: number,
  sectionId: number | null,
  client: DatabaseClient,
): Promise<Sf5Payload | Sf6Payload> {
  if (formType === "SF5") {
    if (!sectionId) {
      throw new AppError(400, "A section is required when recording SF5.");
    }
    const payload = await buildSf5Payload(sectionId, client);
    if (payload.section.schoolYear.id !== schoolYearId) {
      throw new AppError(
        400,
        "The selected section does not belong to this school year.",
      );
    }
    return payload;
  }
  return buildSf6Payload(schoolYearId, client);
}

export async function recordSchoolFormArtifact(input: {
  formType: SchoolFormType;
  schoolYearId: number;
  sectionId?: number | null;
  recordedById: number;
}): Promise<{
  artifactId: number;
  version: number;
  sourceHash: string;
  payloadHash: string;
  recordedAt: Date;
}> {
  return prisma.$transaction(
    async (tx) => {
      const sectionId = input.sectionId ?? null;
      const scopeKey =
        input.formType === "SF5" ? `SF5:SECTION:${sectionId}` : "SF6:SCHOOL";
      const payload = await getPayloadForForm(
        input.formType,
        input.schoolYearId,
        sectionId,
        tx,
      );
      const sourceHash = getSchoolFormSourceHash(payload);
      const payloadHash = hashPayload(payload);
      const latest = await tx.schoolFormArtifact.findFirst({
        where: {
          schoolYearId: input.schoolYearId,
          scopeKey,
        },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const artifact = await tx.schoolFormArtifact.create({
        data: {
          schoolYearId: input.schoolYearId,
          sectionId,
          formType: input.formType,
          scopeKey,
          version: (latest?.version ?? 0) + 1,
          sourceHash,
          payload: payload as unknown as Prisma.InputJsonValue,
          payloadHash,
          recordedById: input.recordedById,
        },
        select: {
          id: true,
          version: true,
          sourceHash: true,
          payloadHash: true,
          recordedAt: true,
        },
      });
      return {
        artifactId: artifact.id,
        version: artifact.version,
        sourceHash: artifact.sourceHash,
        payloadHash: artifact.payloadHash,
        recordedAt: artifact.recordedAt,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function getSchoolFormArtifactStatus(
  formType: SchoolFormType,
  schoolYearId: number,
  sectionId: number | null,
  client: DatabaseClient = prisma,
): Promise<SchoolFormArtifactStatus> {
  const scopeKey =
    formType === "SF5" ? `SF5:SECTION:${sectionId}` : "SF6:SCHOOL";
  const payload = await getPayloadForForm(
    formType,
    schoolYearId,
    sectionId,
    client,
  );
  const sourceHash = getSchoolFormSourceHash(payload);
  const artifact = await client.schoolFormArtifact.findFirst({
    where: { schoolYearId, scopeKey },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      sourceHash: true,
      recordedAt: true,
    },
  });

  return {
    formType,
    scopeKey,
    recorded: Boolean(artifact),
    current: artifact?.sourceHash === sourceHash,
    artifactId: artifact?.id ?? null,
    version: artifact?.version ?? null,
    recordedAt: artifact?.recordedAt ?? null,
  };
}
