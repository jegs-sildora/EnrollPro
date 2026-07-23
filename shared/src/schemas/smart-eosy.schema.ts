import { z } from "zod";
import { AcademicStatusEnum } from "../constants/index.js";

export const smartLearningAreaResultSchema = z.object({
  code: z.string().trim().min(1, "Learning area code is required"),
  name: z.string().trim().min(1, "Learning area name is required"),
  finalGrade: z.number().min(0).max(100),
  result: z.enum(["PASSED", "FAILED", "INCOMPLETE"]),
});

export const smartEosyLearnerOutcomeSchema = z
  .object({
    lrn: z
      .string()
      .regex(/^\d{12}$/, "SMART must provide a valid 12-digit LRN"),
    finalGeneralAverage: z.number().min(0).max(100),
    finalOutcome: AcademicStatusEnum,
    learningAreas: z.array(smartLearningAreaResultSchema).min(
      1,
      "SMART must provide at least one final learning-area result",
    ),
    publishedAt: z.string().datetime({ offset: true }),
    revision: z.string().trim().min(1, "SMART revision is required"),
  })
  .superRefine((value, context) => {
    if (
      value.finalOutcome === "CONDITIONALLY_PROMOTED" &&
      value.learningAreas.every((area) => area.result === "PASSED")
    ) {
      context.addIssue({
        code: "custom",
        path: ["learningAreas"],
        message:
          "A conditionally promoted learner must include the failed or incomplete learning area.",
      });
    }
  });

export const smartEosySectionResponseSchema = z.object({
  data: z.object({
    students: z.array(smartEosyLearnerOutcomeSchema),
  }),
});
