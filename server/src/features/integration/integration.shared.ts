import type { Request } from "express";
import type { ApplicationStatus, Prisma } from "../../generated/prisma/index.js";
import { prisma } from "../../lib/prisma.js";
import { resolveActiveSchoolYearState } from "../school-year/services/active-school-year.service.js";

export const OFFICIAL_ENROLLMENT_STATUSES = [
  "OFFICIALLY_ENROLLED",
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
  termFormat: string;
  term1Start: Date | null;
  term1End: Date | null;
  term2Start: Date | null;
  term2End: Date | null;
  term3Start: Date | null;
  term3End: Date | null;
  term4Start: Date | null;
  term4End: Date | null;
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

  const activeResolution = await resolveActiveSchoolYearState()
  if (activeResolution.state !== "VALID") {
    return {
      status: 409,
      message:
        activeResolution.state === "INVALID"
          ? activeResolution.message
          : "No active school year has been initialized.",
    }
  }

  const setting = await prisma.schoolSetting.findUnique({
    where: { id: activeResolution.active.settingId },
    select: {
      id: true,
      schoolName: true,
    },
  })
  if (!setting) {
    return { status: 409, message: "The active school settings record is unavailable." }
  }

  const configuredSchoolYearId =
    requestedSchoolYearId ?? activeResolution.active.schoolYearId;

  const schoolYear = await prisma.schoolYear.findUnique({
    where: { id: configuredSchoolYearId },
    select: { 
      id: true, yearLabel: true, termFormat: true,
      term1Start: true, term1End: true,
      term2Start: true, term2End: true,
      term3Start: true, term3End: true,
      term4Start: true, term4End: true,
    },
  });

  if (!schoolYear) {
    return { status: 404, message: "School year not found" };
  }

  return {
    scope: {
      schoolId: setting.id,
      schoolName: setting.schoolName,
      schoolYearId: schoolYear.id,
      schoolYearLabel: schoolYear.yearLabel,
      termFormat: schoolYear.termFormat,
      term1Start: schoolYear.term1Start,
      term1End: schoolYear.term1End,
      term2Start: schoolYear.term2Start,
      term2End: schoolYear.term2End,
      term3Start: schoolYear.term3Start,
      term3End: schoolYear.term3End,
      term4Start: schoolYear.term4Start,
      term4End: schoolYear.term4End,
    },
  };
}
