import { z } from "zod";
import { AssessmentPeriodEnum } from "../constants/index.js";

export const healthRecordSchema = z.object({
  assessmentPeriod: AssessmentPeriodEnum,
  assessmentDate: z.string().or(z.date()),
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  notes: z.string().optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
});
