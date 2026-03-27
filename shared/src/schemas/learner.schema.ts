import { z } from "zod";

export const learnerLookupSchema = z.object({
  lrn: z.string().min(1),
  birthDate: z.string().min(1),
  pin: z.string().min(1),
});
