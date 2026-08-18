import axios from "axios";
import "dotenv/config";
import {
  smartEosySectionResponseSchema,
  type SmartEosyLearnerOutcome,
} from "@enrollpro/shared";
import { prisma } from "../lib/prisma.js";

interface StoredSubjectGrade {
  T1?: number | null;
  T2?: number | null;
  T3?: number | null;
  Final?: number | null;
  remarks?: string | null;
}

interface AuditIssue {
  section: string;
  gradeLevel: string;
  learner: string | null;
  code: string;
  message: string;
}

interface SectionAudit {
  section: string;
  gradeLevel: string;
  localLearners: number;
  smartLearners: number;
  subjects: string[];
  issueCount: number;
}

function maskLrn(lrn: string): string {
  return `********${lrn.slice(-4)}`;
}

function gradeNumber(value: string | null | undefined): number | null {
  const match = value?.match(/(?:GRADE[_\s-]*)?(7|8|9|10)/i);
  return match ? Number(match[1]) : null;
}

function subjectGradeNumber(subjectName: string): number | null {
  const match = subjectName.match(/\b(7|8|9|10)\s*$/);
  return match ? Number(match[1]) : null;
}

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function asStoredGradeMap(value: unknown): Map<string, StoredSubjectGrade> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return new Map();
  }

  const result = new Map<string, StoredSubjectGrade>();
  for (const [subject, grade] of Object.entries(value)) {
    if (typeof grade !== "object" || grade === null || Array.isArray(grade)) {
      continue;
    }
    result.set(normalizedText(subject), grade as StoredSubjectGrade);
  }
  return result;
}

function outcomesFromResponse(response: {
  outcomes?: SmartEosyLearnerOutcome[];
  students?: SmartEosyLearnerOutcome[];
  data?: {
    outcomes?: SmartEosyLearnerOutcome[];
    students?: SmartEosyLearnerOutcome[];
  };
}): SmartEosyLearnerOutcome[] {
  return response.outcomes
    ?? response.students
    ?? response.data?.outcomes
    ?? response.data?.students
    ?? [];
}

function expectedFinalRating(subject: SmartEosyLearnerOutcome["subjectGrades"][number]): number | null {
  const terms = [subject.T1, subject.T2, subject.T3].filter(
    (value): value is number => typeof value === "number",
  );
  if (terms.length === 0) return null;
  return Math.round(terms.reduce((sum, value) => sum + value, 0) / terms.length);
}

function sameGradeValue(left: number | null | undefined, right: number | null | undefined): boolean {
  return (left ?? null) === (right ?? null);
}

async function main(): Promise<void> {
  const baseUrl = process.env.SMART_API_BASE_URL?.trim().replace(/\/$/, "");
  const token = process.env.SMART_API_KEY?.trim();
  if (!baseUrl || !token) {
    throw new Error("SMART_API_BASE_URL and SMART_API_KEY must be configured.");
  }

  const setting = await prisma.schoolSetting.findFirst({
    select: {
      activeSchoolYearId: true,
      activeSchoolYear: { select: { yearLabel: true } },
    },
  });
  if (!setting?.activeSchoolYearId || !setting.activeSchoolYear) {
    throw new Error("No active school year is configured.");
  }

  const sections = await prisma.section.findMany({
    where: { schoolYearId: setting.activeSchoolYearId },
    orderBy: [
      { gradeLevel: { displayOrder: "asc" } },
      { sortOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      name: true,
      gradeLevel: { select: { name: true } },
      enrollmentRecords: {
        where: {
          OR: [
            { eosyStatus: null },
            { eosyStatus: { notIn: ["DROPPED_OUT", "TRANSFERRED_OUT"] } },
          ],
        },
        select: {
          finalAverage: true,
          eosyStatus: true,
          learner: { select: { lrn: true } },
          enrollmentApplication: { select: { reportedGrades: true } },
        },
      },
    },
  });

  const issues: AuditIssue[] = [];
  const sectionAudits: SectionAudit[] = [];

  for (const section of sections) {
    const sectionIssueStart = issues.length;
    const expectedGrade = gradeNumber(section.gradeLevel.name);
    let parsedResponse: ReturnType<typeof smartEosySectionResponseSchema.parse>;
    try {
      const response = await axios.post<unknown>(
        `${baseUrl}/api/integration/sections/${encodeURIComponent(section.name)}/sync-grades`,
        undefined,
        {
          params: { schoolYear: setting.activeSchoolYear.yearLabel },
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10_000,
        },
      );
      parsedResponse = smartEosySectionResponseSchema.parse(response.data);
    } catch (error: unknown) {
      issues.push({
        section: section.name,
        gradeLevel: section.gradeLevel.name,
        learner: null,
        code: "SMART_REQUEST_FAILED",
        message: axios.isAxiosError(error)
          ? `SMART request failed with ${error.response?.status ?? error.code ?? "unknown status"}.`
          : error instanceof Error ? error.message : "SMART request failed.",
      });
      sectionAudits.push({
        section: section.name,
        gradeLevel: section.gradeLevel.name,
        localLearners: section.enrollmentRecords.length,
        smartLearners: 0,
        subjects: [],
        issueCount: issues.length - sectionIssueStart,
      });
      continue;
    }

    if (parsedResponse.schoolYear !== setting.activeSchoolYear.yearLabel) {
      issues.push({
        section: section.name,
        gradeLevel: section.gradeLevel.name,
        learner: null,
        code: "SCHOOL_YEAR_SCOPE_MISMATCH",
        message: `SMART returned ${parsedResponse.schoolYear ?? "no school year"}.`,
      });
    }
    if (!parsedResponse.sectionName || normalizedText(parsedResponse.sectionName) !== normalizedText(section.name)) {
      issues.push({
        section: section.name,
        gradeLevel: section.gradeLevel.name,
        learner: null,
        code: "SECTION_SCOPE_MISMATCH",
        message: `SMART returned section ${parsedResponse.sectionName ?? "without a name"}.`,
      });
    }
    if (gradeNumber(parsedResponse.gradeLevel) !== expectedGrade) {
      issues.push({
        section: section.name,
        gradeLevel: section.gradeLevel.name,
        learner: null,
        code: "GRADE_SCOPE_MISMATCH",
        message: `SMART returned ${parsedResponse.gradeLevel ?? "no grade level"}.`,
      });
    }

    const smartOutcomes = outcomesFromResponse(parsedResponse);
    const localByLrn = new Map(
      section.enrollmentRecords.flatMap((record) => record.learner.lrn
        ? [[record.learner.lrn, record] as const]
        : []),
    );
    const seenLrns = new Set<string>();
    const allSubjects = new Set<string>();

    for (const outcome of smartOutcomes) {
      const learner = maskLrn(outcome.lrn);
      if (seenLrns.has(outcome.lrn)) {
        issues.push({
          section: section.name,
          gradeLevel: section.gradeLevel.name,
          learner,
          code: "DUPLICATE_LRN",
          message: "SMART returned the learner more than once.",
        });
      }
      seenLrns.add(outcome.lrn);

      const local = localByLrn.get(outcome.lrn);
      if (!local) {
        issues.push({
          section: section.name,
          gradeLevel: section.gradeLevel.name,
          learner,
          code: "LRN_NOT_IN_SECTION",
          message: "SMART learner is not in the EnrollPro section roster.",
        });
        continue;
      }

      const stored = asStoredGradeMap(local.enrollmentApplication.reportedGrades);
      const seenCodes = new Set<string>();
      const seenNames = new Set<string>();
      const finalRatings: number[] = [];

      const mismatchedSubjects = outcome.subjectGrades.filter((subject) => {
        const subjectGrade = subjectGradeNumber(subject.subjectName);
        return subjectGrade !== null && subjectGrade !== expectedGrade;
      });
      if (mismatchedSubjects.length > 0) {
        for (const subject of mismatchedSubjects) {
          issues.push({
            section: section.name,
            gradeLevel: section.gradeLevel.name,
            learner,
            code: "SUBJECT_GRADE_MISMATCH",
            message: `${subject.subjectName} does not belong to ${section.gradeLevel.name}.`,
          });
        }
        continue;
      }

      for (const subject of outcome.subjectGrades) {
        allSubjects.add(subject.subjectName);
        const code = normalizedText(subject.subjectCode);
        const name = normalizedText(subject.subjectName);
        if (seenCodes.has(code) || seenNames.has(name)) {
          issues.push({
            section: section.name,
            gradeLevel: section.gradeLevel.name,
            learner,
            code: "DUPLICATE_SUBJECT",
            message: `SMART returned duplicate subject ${subject.subjectName}.`,
          });
        }
        seenCodes.add(code);
        seenNames.add(name);

        const calculatedFinal = expectedFinalRating(subject);
        if (!sameGradeValue(subject.finalRating, calculatedFinal)) {
          issues.push({
            section: section.name,
            gradeLevel: section.gradeLevel.name,
            learner,
            code: "FINAL_RATING_MISMATCH",
            message: `${subject.subjectName} final rating does not match its term grades.`,
          });
        }
        if (typeof subject.finalRating === "number") {
          finalRatings.push(subject.finalRating);
        }

        const cached = stored.get(name);
        if (!cached
          || !sameGradeValue(cached.T1, subject.T1)
          || !sameGradeValue(cached.T2, subject.T2)
          || !sameGradeValue(cached.T3, subject.T3)
          || !sameGradeValue(cached.Final, subject.finalRating)) {
          issues.push({
            section: section.name,
            gradeLevel: section.gradeLevel.name,
            learner,
            code: "LOCAL_GRADE_MISMATCH",
            message: `${subject.subjectName} differs from the stored EnrollPro grade.`,
          });
        }
      }

      for (const cachedSubject of stored.keys()) {
        if (!seenNames.has(cachedSubject)) {
          issues.push({
            section: section.name,
            gradeLevel: section.gradeLevel.name,
            learner,
            code: "STALE_LOCAL_SUBJECT",
            message: `Stored subject ${cachedSubject} is not in the current SMART response.`,
          });
        }
      }

      const calculatedAverage = finalRatings.length > 0
        ? Math.round(finalRatings.reduce((sum, value) => sum + value, 0) / finalRatings.length)
        : null;
      const smartAverage = outcome.finalGeneralAverage ?? outcome.generalAverage ?? null;
      if (!sameGradeValue(smartAverage, calculatedAverage)) {
        issues.push({
          section: section.name,
          gradeLevel: section.gradeLevel.name,
          learner,
          code: "GENERAL_AVERAGE_MISMATCH",
          message: "SMART general average does not match the returned subject final ratings.",
        });
      }
      if (!sameGradeValue(local.finalAverage, smartAverage)) {
        issues.push({
          section: section.name,
          gradeLevel: section.gradeLevel.name,
          learner,
          code: "LOCAL_AVERAGE_MISMATCH",
          message: "Stored EnrollPro average differs from SMART.",
        });
      }
    }

    for (const lrn of localByLrn.keys()) {
      if (!seenLrns.has(lrn)) {
        issues.push({
          section: section.name,
          gradeLevel: section.gradeLevel.name,
          learner: maskLrn(lrn),
          code: "LEARNER_MISSING_FROM_SMART",
          message: "Active EnrollPro learner is missing from the SMART section response.",
        });
      }
    }

    sectionAudits.push({
      section: section.name,
      gradeLevel: section.gradeLevel.name,
      localLearners: section.enrollmentRecords.length,
      smartLearners: smartOutcomes.length,
      subjects: Array.from(allSubjects).sort((left, right) => left.localeCompare(right)),
      issueCount: issues.length - sectionIssueStart,
    });
  }

  const report = {
    schoolYear: setting.activeSchoolYear.yearLabel,
    sectionsChecked: sectionAudits.length,
    learnersChecked: sectionAudits.reduce((total, section) => total + section.smartLearners, 0),
    issueCount: issues.length,
    sections: sectionAudits,
    issues,
  };
  console.log(JSON.stringify(report, null, 2));
  if (issues.length > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "SMART grade audit failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
