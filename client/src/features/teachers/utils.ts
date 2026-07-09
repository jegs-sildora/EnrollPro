import {
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  DEPED_TEACHER_SPECIALIZATION_GROUPS,
  DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS,
} from "@enrollpro/shared";
import type { Teacher, TeacherFormState } from "./types";

type AdvisorySectionSummary = NonNullable<
  NonNullable<Teacher["designation"]>["advisorySection"]
>;

export const TEACHER_SPECIALIZATION_GROUPS =
  DEPED_TEACHER_SPECIALIZATION_GROUPS;
export const TEACHER_PLANTILLA_POSITION_OPTIONS =
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS;
export const TEACHER_DEPARTMENT_OPTIONS = DEPED_TEACHER_DEPARTMENT_OPTIONS;
export const TEACHER_ANCILLARY_ROLE_OPTIONS =
  DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS;

export function createEmptyTeacherForm(): TeacherFormState {
  return {
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    employeeId: "",
    contactNumber: "",
    sex: "FEMALE",
    specialization: "",
    department: "",
    plantillaPosition: "",
  };
}

export function normalizeOptionalInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function formatTeacherName(
  teacher: Pick<Teacher, "firstName" | "lastName" | "middleName" | "suffix">,
): string {
  const nameSuffix = teacher.suffix ? ` ${teacher.suffix}` : "";
  return `${teacher.lastName}${nameSuffix}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

export function formatDisplayName(
  teacher: Pick<Teacher, "firstName" | "lastName" | "suffix">,
): string {
  const titleCase = (value: string) =>
    value
      .toLocaleLowerCase()
      .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase());

  const lastName = titleCase(teacher.lastName);
  const firstName = titleCase(teacher.firstName);
  const suffix = teacher.suffix ? ` ${teacher.suffix.toLocaleUpperCase()}` : "";

  return `${lastName}${suffix}, ${firstName}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", { timeZone: 'Asia/Manila', 
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDesignationSummary(teacher: Teacher): string {
  const designation = teacher.designation;
  if (!designation) {
    return "-";
  }

  const tags: string[] = [];
  if (designation.isClassAdviser) tags.push("ADVISER");
  if (designation.ancillaryRoles && designation.ancillaryRoles.length > 0) {
    tags.push(...designation.ancillaryRoles);
  }

  return tags.length > 0 ? tags.join(" · ") : "None";
}

export function formatAdvisorySectionSummary(
  section: AdvisorySectionSummary | null | undefined,
): string {
  if (!section) {
    return "-";
  }

  return `${section.gradeLevelName ?? "Grade"} — ${section.name}`;
}
