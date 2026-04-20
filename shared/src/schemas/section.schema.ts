import { z } from "zod";
import { ApplicantTypeEnum } from "../constants/index.js";

export const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  displayName: z.string().trim().min(1).max(100).optional().nullable(),
  sortOrder: z.number().int().positive().optional(),
  gradeLevelId: z.number().int().positive(),
  programType: ApplicantTypeEnum.default("REGULAR"),
  advisingTeacherId: z.number().int().positive().optional().nullable(),
  maxCapacity: z.number().int().positive().default(40),
});

export const updateSectionSchema = createSectionSchema.partial();
