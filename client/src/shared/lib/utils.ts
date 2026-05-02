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
  LATE_ENROLLEE: "Late Enrollee",
};

export const SCP_ACRONYMS: Record<string, string> = {
  SCIENCE_TECHNOLOGY_AND_ENGINEERING: "STE",
  SPECIAL_PROGRAM_IN_THE_ARTS: "SPA",
  SPECIAL_PROGRAM_IN_SPORTS: "SPS",
  SPECIAL_PROGRAM_IN_JOURNALISM: "SPJ",
  SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE: "SPFL",
  SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION: "SPTVE",
  REGULAR: "Regular",
  LATE_ENROLLEE: "Late",
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
 * Formats a stored time string into 12-hour time with AM/PM for UI display.
 * Supports "HH:mm", "HH:mm:ss", and "h:mm AM/PM" variants.
 */
export function formatDisplayTime12Hour(
  time: string | null | undefined,
): string {
  if (!time) return "";

  const trimmed = time.trim();

  const twelveHourMatch = trimmed.match(
    /^([0-9]{1,2}):([0-9]{2})\s*([AaPp][Mm])$/,
  );
  if (twelveHourMatch) {
    const rawHour = Number(twelveHourMatch[1]);
    const minute = twelveHourMatch[2];
    const period = twelveHourMatch[3].toUpperCase();

    if (Number.isNaN(rawHour) || rawHour < 1 || rawHour > 12) return trimmed;
    return `${rawHour}:${minute} ${period}`;
  }

  const twentyFourHourMatch = trimmed.match(
    /^([0-9]{1,2}):([0-9]{2})(?::[0-9]{2})?$/,
  );
  if (!twentyFourHourMatch) return trimmed;

  let hour = Number(twentyFourHourMatch[1]);
  const minute = twentyFourHourMatch[2];

  if (Number.isNaN(hour) || hour < 0 || hour > 23) return trimmed;

  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minute} ${period}`;
}

/**
 * Recursively converts all string values in an object to uppercase and trims them.
 * Useful for ensuring uniform data entry in the database.
 * Skips specific keys that should remain case-sensitive (e.g., base64 strings, emails).
 */
export function toUpperCaseRecursive<T>(obj: T): T {
  const skipKeys = [
    "studentPhoto",
    "contactNumber",
    "password",
    "email",
    "emailAddress",
  ];

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

/**
 * Checks if all mandatory documents for a specific learner type are met based on the checklist.
 */
export function isMandatoryDocumentsMet(
  learnerType: string | null | undefined,
  checklist: Record<string, unknown> | null | undefined,
): boolean {
  if (!checklist || !learnerType) return false;

  const requirements = [
    {
      key: "isPsaBirthCertPresented",
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isSf9Submitted",
      isMandatory: learnerType !== "CONTINUING",
    },
    {
      key: "isConfirmationSlipReceived",
      isMandatory: learnerType === "CONTINUING",
    },
    {
      key: "isUndertakingSigned",
      isMandatory: learnerType === "TRANSFEREE",
    },
  ];

  return requirements
    .filter((r) => r.isMandatory)
    .every((r) => !!checklist[r.key]);
}

/**
 * Maps learner type enum tokens to human-readable DepEd category labels.
 */
export function getLearnerTypeLabel(type: string | null | undefined): string {
  if (!type) return "Regular";
  switch (type) {
    case "NEW_ENROLLEE":
      return "New Enrollee";
    case "TRANSFEREE":
      return "Transferee";
    case "RETURNING":
      return "Balik-Aral";
    case "CONTINUING":
      return "Continuing";
    case "OSCYA":
      return "OSCYA";
    default:
      return type.replaceAll("_", " ");
  }
}

/**
 * Formats a user role enum token by replacing underscores with spaces.
 */
export function formatUserRole(role: string | null | undefined): string {
  if (!role) return "N/A";
  return role.replaceAll("_", " ");
}

/**
 * Standardized utility to get a full image URL from a stored path or base64 string.
 */
export function getImageUrl(photo: string | null | undefined): string | null {
  if (!photo) return null;
  if (photo.startsWith("data:") || photo.startsWith("http")) return photo;

  // Standardize backend origin detection
  let apiUrl = import.meta.env.VITE_API_URL || "";

  if (!apiUrl || apiUrl === "/api") {
    // Fallback for relative proxy or missing env in development
    // Assuming backend is on port 5000 if not specified
    apiUrl = window.location.origin.replace(/:\d+$/, ":5000") + "/api";
  }

  const origin = apiUrl.replace(/\/api$/, "");
  // Ensure we don't double slash
  const cleanPhoto = photo.startsWith("/") ? photo : `/${photo}`;
  return `${origin}${cleanPhoto}`;
}
