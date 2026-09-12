import { z } from "zod";

const schoolYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, "School year must use YYYY-YYYY format");

export const smartBackSubjectSchema = z
  .object({
    subjectCode: z.string().trim().min(1),
    subjectName: z.string().trim().min(1),
    gradeLevel: z.enum(["GRADE_7", "GRADE_8", "GRADE_9", "GRADE_10"]),
    originalGrade: z.number().min(0).lt(75),
    remedialMark: z.number().int().min(60).max(100).nullable(),
    recomputedGrade: z.number().min(0).max(100).nullable(),
    outcome: z.enum(["PASSED", "FAILED_TUTORIAL"]).nullable(),
    status: z.enum(["PENDING", "COMPLETED"]),
    conductedFrom: z.string().datetime().nullable(),
    conductedTo: z.string().datetime().nullable(),
  })
  .superRefine((subject, context) => {
    if (
      subject.status === "PENDING"
      && (subject.remedialMark !== null
        || subject.recomputedGrade !== null
        || subject.outcome !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Pending back subjects cannot contain finalized remedial results",
      });
    }

    if (
      subject.status === "COMPLETED"
      && (subject.remedialMark === null
        || subject.recomputedGrade === null
        || subject.outcome === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Completed back subjects require all remedial results",
      });
    }
  });

export const smartBackSubjectLearnerSchema = z
  .object({
    lrn: z.string().regex(/^\d{12}$/),
    studentName: z.string().trim().min(1),
    firstName: z.string().trim().min(1),
    middleName: z.string(),
    lastName: z.string().trim().min(1),
    sex: z.string(),
    schoolYear: schoolYearSchema,
    gradeLevel: z.enum(["GRADE_7", "GRADE_8", "GRADE_9", "GRADE_10"]),
    section: z.string(),
    promotionStatus: z.enum([
      "Promoted",
      "Conditionally Promoted",
      "Retained",
    ]),
    resolved: z.boolean(),
    overallOutcome: z.enum(["PASSED", "FAILED_TUTORIAL"]).nullable(),
    backSubjects: z.array(smartBackSubjectSchema).min(1).max(2),
  })
  .superRefine((learner, context) => {
    const subjectCodes = learner.backSubjects.map((subject) => subject.subjectCode);
    if (new Set(subjectCodes).size !== subjectCodes.length) {
      context.addIssue({
        code: "custom",
        path: ["backSubjects"],
        message: "Back-subject codes must be unique",
      });
    }

    const allPassed = learner.backSubjects.every(
      (subject) => subject.status === "COMPLETED" && subject.outcome === "PASSED",
    );
    const hasPending = learner.backSubjects.some(
      (subject) => subject.status === "PENDING",
    );
    const hasFailed = learner.backSubjects.some(
      (subject) => subject.outcome === "FAILED_TUTORIAL",
    );

    if (learner.resolved !== allPassed) {
      context.addIssue({
        code: "custom",
        path: ["resolved"],
        message: "Resolved state does not match the back-subject outcomes",
      });
    }
    if (hasPending && learner.overallOutcome !== null) {
      context.addIssue({
        code: "custom",
        path: ["overallOutcome"],
        message: "Pending records cannot have an overall outcome",
      });
    }
    if (!hasPending && hasFailed && learner.overallOutcome !== "FAILED_TUTORIAL") {
      context.addIssue({
        code: "custom",
        path: ["overallOutcome"],
        message: "Failed remedial records require FAILED_TUTORIAL",
      });
    }
    if (allPassed && learner.overallOutcome !== "PASSED") {
      context.addIssue({
        code: "custom",
        path: ["overallOutcome"],
        message: "Resolved remedial records require PASSED",
      });
    }
  });

export const smartBackSubjectsResponseSchema = z.object({
  success: z.literal(true),
  schoolYear: schoolYearSchema,
  failedSchoolYear: schoolYearSchema.optional(),
  generatedAt: z.string().datetime().optional(),
  count: z.number().int().min(0),
  meta: z.object({
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(500),
    totalPages: z.number().int().min(0),
  }),
  learners: z.array(smartBackSubjectLearnerSchema),
});

export type SmartBackSubject = z.infer<typeof smartBackSubjectSchema>;
export type SmartBackSubjectLearner = z.infer<
  typeof smartBackSubjectLearnerSchema
>;
export type SmartBackSubjectsResponse = z.infer<
  typeof smartBackSubjectsResponseSchema
>;

export interface LearnerBackSubjectSummary {
  lrn: string;
  schoolYear: string;
  resolved: boolean;
  overallOutcome: "PASSED" | "FAILED_TUTORIAL" | null;
  backSubjects: SmartBackSubject[];
}

export interface LearnerBackSubjectsResponse {
  source: "SMART";
  schoolYear: string;
  failedSchoolYear: string;
  generatedAt: string;
  fetchedAt: string;
  learner: LearnerBackSubjectSummary | null;
}
