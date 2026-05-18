import { z } from "zod";
import { ApplicantTypeEnum } from "../constants/index.js";

// Base object — no refinements so .partial() works on updateSectionSchema
const sectionBaseSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  sortOrder: z.number().int().positive().optional(),
  gradeLevelId: z.number().int().positive(),
  schoolYearId: z.number().int().positive(),
  programType: ApplicantTypeEnum.default("REGULAR"),
  isHomogeneous: z.boolean().default(false),
  isSnake: z.boolean().default(false),
  tleProgramId: z.number().int().positive().nullable().optional(),
  advisingTeacherId: z.number().int().positive().optional().nullable(),
  maxCapacity: z.number().int().positive().default(45),
  sectionType: z.enum(["HOME_ROOM", "TLE_LABORATORY"]).optional(),
});

export const createSectionSchema = sectionBaseSchema.superRefine((data, ctx) => {
  if (data.sectionType === "TLE_LABORATORY" && !data.tleProgramId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tleProgramId"],
      message: "A TLE specialization is required for TLE Laboratory sections.",
    });
  }
});

// .partial() on the base object — safe because there are no refinements on it
export const updateSectionSchema = sectionBaseSchema.partial();

export const sectioningParamsSchema = z.object({
  steQuota: z.number().int().min(1).max(500),
  steSections: z.number().int().min(1).max(20),
  pilotSectionCount: z.number().int().min(0).max(50),
  sectionCapacity: z.number().int().min(1).max(100),
});

export type SectioningParams = z.infer<typeof sectioningParamsSchema>;

export const DEFAULT_SECTIONING_PARAMS: SectioningParams = {
  steQuota: 70,
  steSections: 2,
  pilotSectionCount: 5,
  sectionCapacity: 45,
};

export const batchSectioningSchema = z.object({
  gradeLevelId: z.number().int().positive(),
  schoolYearId: z.number().int().positive(),
  params: sectioningParamsSchema.optional(),
  assignments: z
    .array(
      z.object({
        applicationId: z.number().int().positive(),
        sectionId: z.number().int().positive(),
      }),
    )
    .optional(),
});

export const advisoryHandoverSchema = z.object({
  substituteTeacherId: z
    .number()
    .int()
    .positive("Substitute teacher is required"),
  handoverReason: z.string().min(5, "Reason must be at least 5 characters"),
  handoverDate: z.string().or(z.date()).optional(),
});

export type AdvisoryHandoverInput = z.infer<typeof advisoryHandoverSchema>;
