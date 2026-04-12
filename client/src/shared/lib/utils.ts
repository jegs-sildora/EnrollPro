import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MANILA_TIME_ZONE = "Asia/Manila";

export const SCP_LABELS: Record<string, string> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "Science, Technology & Engineering",
  SPECIAL_PROGRAM_IN_THE_ARTS: "Special Program in the Arts",
  SPECIAL_PROGRAM_IN_SPORTS: "Special Program in Sports",
  SPECIAL_PROGRAM_IN_JOURNALISM: "Special Program in Journalism",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "Special Program in Foreign Language",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION:
    "Special Program in Tech-Voc Education",
  REGULAR: "Regular",
};

export const SCP_ACRONYMS: Record<string, string> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
  REGULAR: "Regular",
};

/**
 * Formats a date string or object to a human-readable format in Manila timezone.
 */
export function formatManilaDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
) {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-PH", {
    ...options,
    timeZone: MANILA_TIME_ZONE,
  }).format(d);
}

/**
 * Returns the current date/time adjusted to Manila timezone.
 */
export function getManilaNow(): Date {
  // Return a date object that represents "Now" in Manila
  // Note: Date objects are always UTC internally, but this ensures
  // we're thinking about Manila when we perform operations.
  return new Date();
}

/**
 * Maps SCP enum tokens to their full official DepEd names.
 */
export function formatScpType(scpType: string | null | undefined): string {
  if (!scpType) return "N/A";
  return SCP_LABELS[scpType] || scpType;
}

/**
 * Recursively converts all string values in an object to uppercase and trims them.
 * Useful for ensuring uniform data entry in the database.
 * Skips specific keys that should remain case-sensitive (e.g., base64 strings, emails).
 */
export function toUpperCaseRecursive<T>(obj: T): T {
  const skipKeys = ["studentPhoto", "email", "emailAddress", "password"];

  if (Array.isArray(obj)) {
    return obj.map((v) => toUpperCaseRecursive(v)) as unknown as T;
  } else if (
    obj !== null &&
    typeof obj === "object" &&
    !(obj instanceof Date)
  ) {
    const newObj: Record<string, unknown> = {};
    for (const key in obj) {
      if (skipKeys.includes(key)) {
        newObj[key] = (obj as Record<string, unknown>)[key];
      } else {
        newObj[key] = toUpperCaseRecursive(
          (obj as Record<string, unknown>)[key],
        );
      }
    }
    return newObj as T;
  } else if (typeof obj === "string") {
    return obj.trim().toUpperCase() as unknown as T;
  }
  return obj;
}
