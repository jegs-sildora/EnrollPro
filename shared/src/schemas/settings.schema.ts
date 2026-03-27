import { z } from "zod";

export const updateIdentitySchema = z.object({
  schoolName: z.string().min(1, "School name is required").max(200),
});

export const toggleEnrollmentSchema = z.object({
  enrollmentOpen: z.boolean(),
});

export const selectAccentSchema = z.object({
  hsl: z.string().min(1, "HSL value is required"),
});
