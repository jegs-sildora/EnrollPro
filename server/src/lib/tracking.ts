import { ApplicantType } from "../generated/prisma/index.js";

/**
 * Maps applicant type to tracking number prefix
 */
export function getTrackingPrefix(applicantType: ApplicantType): string {
  return "REG";
}

/**
 * Extracts the start year from a school year label (e.g., "2024-2025" -> "2024")
 */
export function extractStartYear(yearLabel: string): string {
  if (!yearLabel) return new Date().getFullYear().toString();
  return yearLabel.split("-")[0].trim();
}

/**
 * Standardizes tracking number generation
 * Format: [PREFIX]-[SCHOOLYEAR]-[0000ID]
 */
export function generateTrackingNumber(params: {
  prefix: string;
  schoolYear: string;
  id: number | string;
}): string {
  const { prefix, schoolYear, id } = params;
  const startYear = extractStartYear(schoolYear);
  const paddedId = String(id).padStart(5, "0");
  return `${prefix}-${startYear}-${paddedId}`;
}
