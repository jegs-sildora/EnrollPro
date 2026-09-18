import { z } from "zod";
import { DEPED_TEACHER_PLANTILLA_POSITION_VALUES } from "../constants/index.js";

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
  schoolHeadTitle: z
    .enum(DEPED_TEACHER_PLANTILLA_POSITION_VALUES)
    .optional()
    .nullable()
    .or(z.literal("")),
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
  steCapacity: z.number().int().min(1, "STE Capacity must be at least 1").nullable().optional(),
  spaEnabled: z.boolean(),
  spaCapacity: z.number().int().min(1, "SPA Capacity must be at least 1").nullable().optional(),
  spsEnabled: z.boolean(),
  spsCapacity: z.number().int().min(1, "SPS Capacity must be at least 1").nullable().optional(),
}).refine(data => !data.steEnabled || (data.steEnabled && data.steCapacity != null && data.steCapacity >= 1), {
  message: "STE Capacity is required when STE is enabled",
  path: ["steCapacity"]
}).refine(data => !data.spaEnabled || (data.spaEnabled && data.spaCapacity != null && data.spaCapacity >= 1), {
  message: "SPA Capacity is required when SPA is enabled",
  path: ["spaCapacity"]
}).refine(data => !data.spsEnabled || (data.spsEnabled && data.spsCapacity != null && data.spsCapacity >= 1), {
  message: "SPS Capacity is required when SPS is enabled",
  path: ["spsCapacity"]
});

export const updateAlgorithmSchema = z.object({
  enableHomogeneousSections: z.boolean(),
  homogeneousSectionCount: z.number().int().min(0),
  heterogeneousRoundRobin: z.boolean(),
});
