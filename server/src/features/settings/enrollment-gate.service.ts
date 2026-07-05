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

export function isEnrollmentOpen(year: SchoolYear, systemPhase?: string): boolean {
  if (systemPhase === "OFFICIAL_ENROLLMENT") return true;

  const todayToken = toManilaDateToken(new Date());

  const inPhase2 =
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    todayToken >= toManilaDateToken(year.enrollOpenDate) &&
    todayToken <= toManilaDateToken(year.enrollCloseDate);

  return Boolean(inPhase2);
}

/**
 * Returns true when the Official BOSY Enrollment (Phase 2) window is currently
 * active, evaluated independently of phase-priority ordering.
 *
 * Unlike `getEnrollmentPhase`, this check is not suppressed by an overlapping
 * Early Registration window — if the admin has both windows open at once,
 * BOSY enrollment is considered open.
 */
export function isRegularEnrollmentWindowOpen(year: SchoolYear, systemPhase?: string): boolean {
  if (systemPhase === "OFFICIAL_ENROLLMENT") return true;

  const todayToken = toManilaDateToken(new Date());
  return Boolean(
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    todayToken >= toManilaDateToken(year.enrollOpenDate) &&
    todayToken <= toManilaDateToken(year.enrollCloseDate),
  );
}

export function getEnrollmentPhase(
  year: SchoolYear,
  systemPhase?: string
):
  | "REGULAR_ENROLLMENT"
  | "CLOSED" {
  if (systemPhase === "OFFICIAL_ENROLLMENT") return "REGULAR_ENROLLMENT";

  const todayToken = toManilaDateToken(new Date());

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
