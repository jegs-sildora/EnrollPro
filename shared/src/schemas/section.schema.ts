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
  advisingTeacherId: z.number().int().positive().optional().nullable(),
  maxCapacity: z.number().int().positive().default(45),
});

export const createSectionSchema = sectionBaseSchema;

// .partial() on the base object — safe because there are no refinements on it
export const updateSectionSchema = sectionBaseSchema.partial();

export const advisoryHandoverSchema = z.object({
  substituteTeacherId: z
    .number()
    .int()
    .positive("Substitute teacher is required"),
  handoverReason: z.string().min(5, "Reason must be at least 5 characters"),
  handoverDate: z.string().or(z.date()).optional(),
});

export type AdvisoryHandoverInput = z.infer<typeof advisoryHandoverSchema>;
