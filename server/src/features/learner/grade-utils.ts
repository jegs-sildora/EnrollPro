import { getStoredSmartSubjects } from "../integration/smart-outcome-envelope.js";

export interface StoredSubjectGrades {
  Q1?: number | null;
  Q2?: number | null;
  Q3?: number | null;
  Q4?: number | null;
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  term1?: number | null;
  term2?: number | null;
  term3?: number | null;
  Final?: number | null;
  remarks?: string | null;
}

export function isStoredSubjectGrades(value: unknown): value is StoredSubjectGrades {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getExpectedGradeNumber(gradeLevelName: string | null | undefined): number | null {
  const match = gradeLevelName?.match(/(?:GRADE[\s_-]*)?(10|[7-9])(?:\D|$)/i);
  return match ? Number(match[1]) : null;
}

export function hasReportedGrade(grades: StoredSubjectGrades): boolean {
  return [
    grades.Q1,
    grades.Q2,
    grades.Q3,
    grades.Q4,
    grades.T1,
    grades.T2,
    grades.T3,
    grades.term1,
    grades.term2,
    grades.term3,
    grades.Final,
  ].some((value) => typeof value === "number");
}

export function subjectBelongsToGrade(subjectName: string, expectedGrade: number | null): boolean {
  if (expectedGrade === null) return true;
  const match = subjectName.match(/\b(7|8|9|10)\s*$/);
  return match === null || Number(match[1]) === expectedGrade;
}

export function parseStoredGrades(
  value: unknown,
  gradeLevelName?: string | null,
): Record<string, StoredSubjectGrades> | null {
  const storedSubjects = getStoredSmartSubjects(value);
  if (!storedSubjects) return null;

  const expectedGrade = getExpectedGradeNumber(gradeLevelName);
  const entries = Object.entries(storedSubjects).filter(([subjectName, grades]) => (
    isStoredSubjectGrades(grades)
    && hasReportedGrade(grades)
    && subjectBelongsToGrade(subjectName, expectedGrade)
  ));
  return entries.length > 0
    ? Object.fromEntries(entries) as Record<string, StoredSubjectGrades>
    : null;
}

export function getHistoricalReportedGrades(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return "reportedGrades" in value
    ? (value as { reportedGrades?: unknown }).reportedGrades ?? null
    : null;
}
