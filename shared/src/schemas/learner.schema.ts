import { z } from "zod";

export const learnerLookupSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be in YYYY-MM-DD format"),
  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});
