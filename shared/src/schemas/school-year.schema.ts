import { z } from "zod";
import { SchoolYearStatusEnum } from "../constants/index.js";

export const createSchoolYearSchema = z.object({
  yearLabel: z.string().min(1, "Year label is required"),
  classOpeningDate: z.string().or(z.date()),
  classEndDate: z.string().or(z.date()),
  earlyRegOpenDate: z.string().or(z.date()).optional().nullable(),
  earlyRegCloseDate: z.string().or(z.date()).optional().nullable(),
  enrollOpenDate: z.string().or(z.date()).optional().nullable(),
  enrollCloseDate: z.string().or(z.date()).optional().nullable(),
});

export const updateSchoolYearSchema = createSchoolYearSchema.partial();

export const transitionSchoolYearSchema = z.object({
  status: SchoolYearStatusEnum,
});

export const toggleOverrideSchema = z.object({
  isManualOverrideOpen: z.boolean(),
});
