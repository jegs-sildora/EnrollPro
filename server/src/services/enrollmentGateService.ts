import type { SchoolYear } from "@prisma/client";

export function isEnrollmentOpen(year: SchoolYear): boolean {
  if (year.manualOverrideOpen) return true;
  const now = new Date();

  const inPhase1 =
    year.earlyRegOpenDate &&
    year.earlyRegCloseDate &&
    now >= year.earlyRegOpenDate &&
    now <= year.earlyRegCloseDate;

  const inPhase2 =
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    now >= year.enrollOpenDate &&
    now <= year.enrollCloseDate;

  return Boolean(inPhase1 || inPhase2);
}

export function getEnrollmentPhase(
  year: SchoolYear,
): "EARLY_REGISTRATION" | "REGULAR_ENROLLMENT" | "CLOSED" | "OVERRIDE" {
  if (year.manualOverrideOpen) return "OVERRIDE";
  const now = new Date();

  if (
    year.earlyRegOpenDate &&
    year.earlyRegCloseDate &&
    now >= year.earlyRegOpenDate &&
    now <= year.earlyRegCloseDate
  ) {
    return "EARLY_REGISTRATION";
  }

  if (
    year.enrollOpenDate &&
    year.enrollCloseDate &&
    now >= year.enrollOpenDate &&
    now <= year.enrollCloseDate
  ) {
    return "REGULAR_ENROLLMENT";
  }

  return "CLOSED";
}
