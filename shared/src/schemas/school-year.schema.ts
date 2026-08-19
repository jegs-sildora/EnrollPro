import { z } from "zod";
import { SchoolYearStatusEnum, PortalControlEnum, TermFormatEnum } from "../constants/index.js";

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
});

export const prepareNextSchoolYearSchema = z.object({
  sourceSchoolYearId: z.number().int().positive(),
  yearLabel: z.string().regex(/^\d{4}-\d{4}$/, "Use YYYY-YYYY format"),
  classOpeningDate: z.string().or(z.date()),
  classEndDate: z.string().or(z.date()),
  enrollOpenDate: z.string().or(z.date()),
  enrollCloseDate: z.string().or(z.date()),
  term1Start: z.string().or(z.date()),
  term1End: z.string().or(z.date()),
  term2Start: z.string().or(z.date()),
  term2End: z.string().or(z.date()),
  term3Start: z.string().or(z.date()),
  term3End: z.string().or(z.date()),
  term4Start: z.string().or(z.date()).optional().nullable(),
  term4End: z.string().or(z.date()).optional().nullable(),
  termFormat: TermFormatEnum,
}).superRefine((value, context) => {
  if (value.termFormat === "QUARTERS" && (!value.term4Start || !value.term4End)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Term 4 dates are required for a four-quarter calendar.",
      path: ["term4Start"],
    });
  }
});

export const transitionSchoolYearSchema = z.object({
  status: SchoolYearStatusEnum,
});

export const toggleOverrideSchema = z.object({
  portalControl: PortalControlEnum,
});


