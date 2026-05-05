import {
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  DEPED_TEACHER_SPECIALIZATION_GROUPS,
  DEPED_TEACHER_ANCILLARY_ROLE_OPTIONS,
} from "@enrollpro/shared";
import type { Teacher, TeacherFormState } from "./types";

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
    email: "",
    employeeId: "",
    contactNumber: "",
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
  teacher: Pick<Teacher, "firstName" | "lastName" | "middleName">,
): string {
  return `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName.charAt(0)}.` : ""}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
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
  if (designation.isTeachingExempt) tags.push("EXEMPT");

  return tags.length > 0 ? tags.join(" · ") : "None";
}

export function formatAdvisorySectionSummary(teacher: Teacher): string {
  if (!teacher.designation?.advisorySection) {
    return "-";
  }

  const section = teacher.designation.advisorySection;
  return `${section.gradeLevelName ?? "Grade"} - ${section.name}`;
}
