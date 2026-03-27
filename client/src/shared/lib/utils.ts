import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MANILA_TIME_ZONE = "Asia/Manila";

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
