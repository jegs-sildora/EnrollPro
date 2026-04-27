import { z } from "zod";

export const updateIdentitySchema = z.object({
  schoolName: z.string().min(1, "School name is required").max(200),
  facebookPageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  depedEmail: z
    .string()
    .email("Must be a valid email")
    .optional()
    .or(z.literal("")),
  schoolWebsite: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
});

export const toggleEnrollmentSchema = z.object({
  enrollmentOpen: z.boolean(),
});

export const selectAccentSchema = z.object({
  hsl: z.string().min(1, "HSL value is required"),
});
