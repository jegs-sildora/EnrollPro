import {
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS,
  DEPED_TEACHER_SUBJECT_OPTIONS,
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
} from "@enrollpro/shared";
import type { Teacher, TeacherFormState } from "./types";

export const MAX_TEACHER_PHOTO_BYTES = 5 * 1024 * 1024;

export const DEPED_LEARNING_AREA_OPTIONS = DEPED_TEACHER_SUBJECT_OPTIONS;
export const TEACHER_SUBJECT_OPTIONS = DEPED_TEACHER_SUBJECT_OPTIONS;
export const TEACHER_PLANTILLA_POSITION_OPTIONS =
  DEPED_TEACHER_PLANTILLA_POSITION_OPTIONS;
export const TEACHER_DEPARTMENT_OPTIONS = DEPED_TEACHER_DEPARTMENT_OPTIONS;

export function createEmptyTeacherForm(): TeacherFormState {
  return {
    firstName: "",
    lastName: "",
    middleName: "",
    email: "",
    employeeId: "",
    contactNumber: "",
    designation: "",
    specialization: "",
    department: "",
    plantillaPosition: "",
    subjects: [],
    photo: null,
  };
}

export function normalizeOptionalInput(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function convertImageToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Image conversion failed"));
    };
    reader.onerror = () => reject(new Error("Image conversion failed"));
    reader.readAsDataURL(file);
  });
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
  if (designation.isTic) tags.push("TIC");
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
