import type { Teacher } from "./types";

type AdvisorySectionSummary = NonNullable<
  NonNullable<Teacher["designation"]>["advisorySection"]
>;

export function formatTeacherName(
  teacher: Pick<Teacher, "firstName" | "lastName" | "middleName" | "suffix">,
): string {
  const nameSuffix = teacher.suffix ? ` ${teacher.suffix}` : "";
  return `${teacher.lastName}${nameSuffix}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

export function formatAdvisorySectionSummary(
  section: AdvisorySectionSummary | null | undefined,
): string {
  if (!section) {
    return "-";
  }

  return `${section.gradeLevelName ?? "Grade"} — ${section.name}`;
}
