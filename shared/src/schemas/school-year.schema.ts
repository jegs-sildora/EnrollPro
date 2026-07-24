import { z } from "zod";
import { SchoolYearStatusEnum, PortalControlEnum, TermFormatEnum } from "../constants/index.js";

const schoolYearLabelSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, "School year must use the format YYYY-YYYY")
  .refine((value) => {
    const [start, end] = value.split("-").map(Number);
    return end === start + 1;
  }, "School year must cover consecutive years");

const dateInputSchema = z.string().or(z.date());

export const calendarPolicyStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "APPLIED",
]);

export const schoolYearCalendarPolicySchema = z.object({
  yearLabel: schoolYearLabelSchema,
  depedIssuance: z.string().trim().min(3, "DepEd issuance is required"),
  sourceUrl: z.string().url().optional().nullable().or(z.literal("")),
  classOpeningDate: dateInputSchema,
  classEndDate: dateInputSchema,
  enrollOpenDate: dateInputSchema.optional().nullable(),
  enrollCloseDate: dateInputSchema.optional().nullable(),
  termFormat: TermFormatEnum,
  term1Start: dateInputSchema,
  term1End: dateInputSchema,
  term2Start: dateInputSchema,
  term2End: dateInputSchema,
  term3Start: dateInputSchema,
  term3End: dateInputSchema,
  term4Start: dateInputSchema.optional().nullable(),
  term4End: dateInputSchema.optional().nullable(),
});

export const updateCalendarPolicySchema =
  schoolYearCalendarPolicySchema.partial();

export const createSchoolYearSchema = z.object({
  yearLabel: z.string().min(1, "Year label is required"),
  classOpeningDate: z.string().or(z.date()),
  classEndDate: z.string().or(z.date()),
  enrollOpenDate: z.string().or(z.date()).optional().nullable(),
  enrollCloseDate: z.string().or(z.date()).optional().nullable(),
  term1Start: z.string().or(z.date()).optional().nullable(),
  term1End: z.string().or(z.date()).optional().nullable(),
  term2Start: z.string().or(z.date()).optional().nullable(),
  term2End: z.string().or(z.date()).optional().nullable(),
  term3Start: z.string().or(z.date()).optional().nullable(),
  term3End: z.string().or(z.date()).optional().nullable(),
  term4Start: z.string().or(z.date()).optional().nullable(),
  term4End: z.string().or(z.date()).optional().nullable(),
  termFormat: TermFormatEnum.optional(),
  cloneFromId: z.number().int().positive().optional().nullable(),
});

export const updateSchoolYearSchema = createSchoolYearSchema.partial();

export const rolloverSchoolYearSchema = z.object({
  sourceSchoolYearId: z.number().int().positive(),
  calendarPolicyId: z.number().int().positive(),
  pin: z.string().regex(/^\d{6}$/, "A valid 6-digit administrator PIN is required"),
});

export const transitionSchoolYearSchema = z.object({
  status: SchoolYearStatusEnum,
});

export const toggleOverrideSchema = z.object({
  portalControl: PortalControlEnum,
});


