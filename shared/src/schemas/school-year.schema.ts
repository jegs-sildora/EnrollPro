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
  yearLabel: z.string().min(1, "Year label is required").optional(),
  classOpeningDate: z.string().or(z.date()),
  classEndDate: z.string().or(z.date()).optional().nullable(),
  cloneStructure: z.boolean().optional().default(true),
  carryOverLearners: z.boolean().optional().default(true),
  pin: z.string().optional(),
});

export const updateRolloverDraftSchema = z.object({
  yearLabel: z.string().min(1, "Year label is required"),
  classOpeningDate: z.string().or(z.date()),
  classEndDate: z.string().or(z.date()).optional().nullable(),
});

export const transitionSchoolYearSchema = z.object({
  status: SchoolYearStatusEnum,
});

export const toggleOverrideSchema = z.object({
  portalControl: PortalControlEnum,
});

export const updateAssessmentConfigSchema = z.object({
  requireReadingAssessmentNew: z.boolean(),
  requireReadingAssessmentContinuing: z.boolean(),
});
