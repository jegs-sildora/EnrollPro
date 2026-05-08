import { z } from "zod";
import { LearnerStatusEnum } from "../constants/index.js";

export const learnerLookupSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const learnerStatusUpdateSchema = z.object({
  status: LearnerStatusEnum,
});
