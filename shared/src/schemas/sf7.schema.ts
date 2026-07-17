import { z } from "zod";
import {
  TEACHER_FUNDING_SOURCE_VALUES,
  TEACHER_NATURE_OF_APPOINTMENT_VALUES,
  TEACHER_SCHEDULE_DAY_VALUES,
} from "../constants/index.js";

export const sf7SchedulePeriodPreviewSchema = z.object({
  dayOfWeek: z.enum(TEACHER_SCHEDULE_DAY_VALUES),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  subjectLabel: z.string().nullable(),
  sectionLabel: z.string().nullable(),
  minutes: z.number().int().nonnegative(),
});

export const sf7ImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  teacherId: z.number().int().positive().nullable(),
  matchStatus: z.enum(["MATCHED", "MISSING_EMPLOYEE_ID", "NO_MATCH"]),
  employeeId: z.string().nullable(),
  fullName: z.string().nullable(),
  sex: z.enum(["MALE", "FEMALE"]).nullable(),
  fundingSource: z.enum(TEACHER_FUNDING_SOURCE_VALUES).nullable(),
  plantillaPosition: z.string().nullable(),
  natureOfAppointment: z.enum(TEACHER_NATURE_OF_APPOINTMENT_VALUES).nullable(),
  undergraduateDegree: z.string().nullable(),
  postgraduateDegree: z.string().nullable(),
  majorSpecialization: z.string().nullable(),
  minorSpecialization: z.string().nullable(),
  assignmentText: z.string().nullable(),
  administrativeRemarks: z.string().nullable(),
  indigenousCommunity: z.string().nullable(),
  schedulePeriods: z.array(sf7SchedulePeriodPreviewSchema),
  importedWeeklyMinutes: z.number().int().nonnegative().nullable(),
  calculatedWeeklyMinutes: z.number().int().nonnegative(),
  issues: z.array(z.string()),
});

export const sf7ImportCommitSchema = z.object({
  rows: z.array(sf7ImportPreviewRowSchema).min(1),
});

export const sf7ImportPreviewResponseSchema = z.object({
  rows: z.array(sf7ImportPreviewRowSchema),
  summary: z.object({
    totalRows: z.number().int().nonnegative(),
    matchedRows: z.number().int().nonnegative(),
    missingEmployeeIdRows: z.number().int().nonnegative(),
    noMatchRows: z.number().int().nonnegative(),
    issueCount: z.number().int().nonnegative(),
  }),
});

export const sf7ImportCommitResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  updatedTeacherIds: z.array(z.number().int().positive()),
  skippedRows: z.array(
    z.object({
      rowNumber: z.number().int().positive(),
      employeeId: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});

export const sf7AtlasSyncResponseSchema = z.object({
  schoolYearId: z.number().int().positive(),
  syncedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      teacherId: z.number().int().positive(),
      employeeId: z.string().nullable(),
      teacherName: z.string(),
      status: z.enum(["SYNCED", "SKIPPED", "FAILED"]),
      periodCount: z.number().int().nonnegative(),
      totalWeeklyMinutes: z.number().int().nonnegative(),
      reason: z.string().nullable(),
    }),
  ),
});
