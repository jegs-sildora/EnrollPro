import { ApplicantType } from "../generated/prisma/index.js";

/**
 * Maps applicant type to tracking number prefix
 */
export function getTrackingPrefix(applicantType: ApplicantType): string {
  switch (applicantType) {
    case "SCIENCE_TECHNOLOGY_AND_ENGINEERING":
      return "STE";
    case "SPECIAL_PROGRAM_IN_THE_ARTS":
      return "SPA";
    case "SPECIAL_PROGRAM_IN_SPORTS":
      return "SPS";
    case "SPECIAL_PROGRAM_IN_JOURNALISM":
      return "SPJ";
    case "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE":
      return "SPFL";
    case "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION":
      return "SPTVE";
    case "REGULAR":
    case "LATE_ENROLLEE":
    default:
      return "REG";
  }
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
