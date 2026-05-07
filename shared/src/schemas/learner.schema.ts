import { z } from "zod";
import { LearnerStatusEnum, Sf10RequestStatusEnum } from "../constants/index.js";

export const learnerLookupSchema = z.object({
  lrn: z.string().regex(/^\d{12}$/, "LRN must be exactly 12 digits"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be in YYYY-MM-DD format"),
  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});

export const sf10RequestCreateSchema = z.object({
  requestingSchoolName: z.string().min(2, "School name is required"),
  requestingSchoolDepedId: z.string().optional().nullable(),
  requestDate: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export const sf10RequestUpdateSchema = z.object({
  status: Sf10RequestStatusEnum,
  sentDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const learnerStatusUpdateSchema = z.object({
  status: LearnerStatusEnum,
});
