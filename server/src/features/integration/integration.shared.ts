import type { Request } from "express";
import type { ApplicationStatus, Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";

export const OFFICIAL_ENROLLMENT_STATUSES = [
  "OFFICIALLY_ENROLLED",
  "ENROLLED",
  "SECTIONED",
] satisfies ApplicationStatus[];

type JsonRecord = Record<string, Prisma.JsonValue>;

export function isJsonRecord(value: Prisma.JsonValue | null): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSnapshotString(
  snapshot: Prisma.JsonValue | null,
  key: string,
): string | null {
  if (!isJsonRecord(snapshot)) return null;
  const value = snapshot[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

export function readSnapshotNumber(
  snapshot: Prisma.JsonValue | null,
  key: string,
): number | null {
  if (!isJsonRecord(snapshot)) return null;
  const value = snapshot[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export type SchoolYearScope = {
  schoolId: number | null;
  schoolName: string | null;
  schoolYearId: number;
  schoolYearLabel: string;
};

export function parsePositiveInt(value: unknown): number | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined || normalized === null || normalized === "") {
    return null;
  }

  const parsed = Number.parseInt(String(normalized), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function parseOptionalText(value: unknown): string | null {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (typeof normalized !== "string") {
    return null;
  }

  const trimmed = normalized.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function buildTeacherName(teacher: {
  firstName: string;
  lastName: string;
  middleName: string | null;
}): string {
  return `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

export async function resolveSchoolYearScope(
  req: Request,
): Promise<{ scope: SchoolYearScope } | { status: number; message: string }> {
  const requestedSchoolYearId = parsePositiveInt(req.query.schoolYearId);
  if (req.query.schoolYearId !== undefined && requestedSchoolYearId === null) {
    return { status: 400, message: "schoolYearId must be a positive integer" };
  }

  const setting = await prisma.schoolSetting.findFirst({
    select: {
      id: true,
      schoolName: true,
      activeSchoolYearId: true,
    },
  });

  const configuredSchoolYearId =
    requestedSchoolYearId ?? setting?.activeSchoolYearId ?? null;

  const schoolYear = configuredSchoolYearId
    ? await prisma.schoolYear.findUnique({
        where: { id: configuredSchoolYearId },
        select: { id: true, yearLabel: true },
      })
    : await prisma.schoolYear.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true, yearLabel: true },
        orderBy: { id: "asc" },
      });

  if (!schoolYear) {
    if (configuredSchoolYearId) {
      return { status: 404, message: "School year not found" };
    }

    return {
      status: 400,
      message:
        "No schoolYearId provided and no active school year could be resolved",
    };
  }

  return {
    scope: {
      schoolId: setting?.id ?? null,
      schoolName: setting?.schoolName ?? null,
      schoolYearId: schoolYear.id,
      schoolYearLabel: schoolYear.yearLabel,
    },
  };
}
