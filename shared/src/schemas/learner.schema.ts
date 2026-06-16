import { z } from "zod";
import { LearnerStatusEnum } from "../constants/index.js";

export const learnerLookupSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
});

export const learnerLoginSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
  password: z.string().min(1, "Password is required"),
});

export const learnerSetupPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const learnerAuthResponseSchema = z.object({
  token: z.string(),
  requiresPasswordReset: z.boolean(),
  learner: z.object({
    id: z.number(),
    lrn: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    middleName: z.string().nullable(),
  }),
});

export const learnerStatusUpdateSchema = z.object({
  status: LearnerStatusEnum,
});
