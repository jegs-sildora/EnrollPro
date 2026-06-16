import { z } from "zod";

export const updateIdentitySchema = z.object({
  schoolName: z.string().min(1, "School name is required").max(200),
  depedSchoolId: z
    .string()
    .regex(/^\d{6}$/, "School ID must be exactly 6 digits")
    .optional()
    .nullable()
    .or(z.literal("")),
  region: z.string().optional().nullable().or(z.literal("")),
  division: z.string().optional().nullable().or(z.literal("")),
  schoolHeadName: z.string().optional().nullable().or(z.literal("")),
  schoolHeadTitle: z.string().optional().nullable().or(z.literal("")),
  facebookPageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  depedEmail: z
    .string()
    .email("Must be a valid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  schoolWebsite: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  globalDefaultPassword: z.string().optional(),
});

export const toggleEnrollmentSchema = z.object({
  enrollmentOpen: z.boolean(),
});

export const selectAccentSchema = z.object({
  hsl: z.string().min(1, "HSL value is required"),
});

export const updateProgramsSchema = z.object({
  steEnabled: z.boolean(),
  spaEnabled: z.boolean(),
  spsEnabled: z.boolean(),
});

export const updateAlgorithmSchema = z.object({
  enableHomogeneousSections: z.boolean(),
  homogeneousSectionCount: z.number().int().min(0),
  heterogeneousRoundRobin: z.boolean(),
});
