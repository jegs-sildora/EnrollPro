import type { SchoolYear } from "../../generated/prisma/index.js";

/**
 * Normalizes a Date object to a numeric YYYYMMDD token in Manila timezone.
 * Using numeric comparison avoids locale-specific string formatting issues.
 */
function toManilaDateToken(date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(
    parts.find((part) => part.type === "month")?.value ?? "0",
  );
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return year * 10000 + month * 100 + day;
}

export function isEnrollmentOpen(year: SchoolYear): boolean {
  if (
    year.portalControl === "FORCE_OPEN_PHASE_1" ||
    year.portalControl === "FORCE_OPEN_PHASE_2"
  )
    return true;
  if (year.portalControl === "FORCE_CLOSE_ALL") return false;

  const todayToken = toManilaDateToken(new Date());

  const inPhase1 =
    year.earlyRegOpenDate &&
    year.earlyRegCloseDate &&
    todayToken >= toManilaDateToken(year.earlyRegOpenDate) &&
    todayToken <= toManilaDateToken(year.earlyRegCloseDate);

  const inPhase2 =
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    todayToken >= toManilaDateToken(year.enrollOpenDate) &&
    todayToken <= toManilaDateToken(year.enrollCloseDate);

  return Boolean(inPhase1 || inPhase2);
}

export function getEnrollmentPhase(
  year: SchoolYear,
):
  | "EARLY_REGISTRATION"
  | "REGULAR_ENROLLMENT"
  | "CLOSED"
  | "OVERRIDE"
  | "BOSY_LOCKED" {
  if (year.status === "BOSY_LOCKED") return "BOSY_LOCKED";
  if (year.portalControl === "FORCE_OPEN_PHASE_1") return "EARLY_REGISTRATION";
  if (year.portalControl === "FORCE_OPEN_PHASE_2") return "REGULAR_ENROLLMENT";
  if (year.portalControl === "FORCE_CLOSE_ALL") return "CLOSED";

  const todayToken = toManilaDateToken(new Date());

  if (
    year.earlyRegOpenDate &&
    year.earlyRegCloseDate &&
    todayToken >= toManilaDateToken(year.earlyRegOpenDate) &&
    todayToken <= toManilaDateToken(year.earlyRegCloseDate)
  ) {
    return "EARLY_REGISTRATION";
  }

  if (
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    todayToken >= toManilaDateToken(year.enrollOpenDate) &&
    todayToken <= toManilaDateToken(year.enrollCloseDate)
  ) {
    return "REGULAR_ENROLLMENT";
  }

  return "CLOSED";
}
