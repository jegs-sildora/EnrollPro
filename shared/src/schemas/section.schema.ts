import { z } from "zod";

export const createSectionSchema = z.object({
  name: z.string().min(1, "Section name is required"),
  gradeLevelId: z.number().int().positive(),
  advisingTeacherId: z.number().int().positive().optional().nullable(),
  maxCapacity: z.number().int().positive().default(40),
});

export const updateSectionSchema = createSectionSchema.partial();
