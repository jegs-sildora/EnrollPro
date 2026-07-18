import { z } from "zod";
import { ApplicantTypeEnum, SexEnum } from "../constants/index.js";

export const sf1ImportIssueCodeSchema = z.enum([
  "INVALID_LRN",
  "DUPLICATE_IN_FILE",
  "MISSING_NAME",
  "MISSING_BIRTHDATE",
  "MISSING_SEX",
  "CROSS_SECTION_CONFLICT",
  "ALREADY_IN_SECTION",
]);

export const sf1ImportMatchStatusSchema = z.enum([
  "VALID_NEW_LEARNER",
  "VALID_EXISTING_LEARNER",
  "BLOCKED",
]);

export const sf1ImportPreviewRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  genderGroup: SexEnum.nullable(),
  lrn: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  middleName: z.string().nullable(),
  extensionName: z.string().nullable(),
  sex: SexEnum.nullable(),
  birthdate: z.string().nullable(),
  motherTongue: z.string().nullable(),
  ipGroupName: z.string().nullable(),
  religion: z.string().nullable(),
  houseNoStreet: z.string().nullable(),
  barangay: z.string().nullable(),
  cityMunicipality: z.string().nullable(),
  province: z.string().nullable(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  guardianName: z.string().nullable(),
  guardianRelationship: z.string().nullable(),
  contactNumber: z.string().nullable(),
  matchStatus: sf1ImportMatchStatusSchema,
  existingLearnerId: z.number().int().positive().nullable(),
  existingSectionName: z.string().nullable(),
  issues: z.array(sf1ImportIssueCodeSchema),
  issueMessages: z.array(z.string()),
});

export const sf1ImportPreviewResponseSchema = z.object({
  section: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    gradeLevelId: z.number().int().positive(),
    gradeLevelName: z.string(),
    schoolYearId: z.number().int().positive(),
    programType: ApplicantTypeEnum,
    maxCapacity: z.number().int().positive(),
  }),
  summary: z.object({
    totalRows: z.number().int().nonnegative(),
    validRows: z.number().int().nonnegative(),
    newLearners: z.number().int().nonnegative(),
    existingLearners: z.number().int().nonnegative(),
    duplicateLrnRows: z.number().int().nonnegative(),
    crossSectionConflicts: z.number().int().nonnegative(),
    blockedRows: z.number().int().nonnegative(),
  }),
  rows: z.array(sf1ImportPreviewRowSchema),
});

export const sf1ImportCommitSchema = z.object({
  rows: z.array(sf1ImportPreviewRowSchema).min(1),
});

export const sf1ImportCommitResponseSchema = z.object({
  committedCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  createdLearnerCount: z.number().int().nonnegative(),
  reusedLearnerCount: z.number().int().nonnegative(),
  learnerIds: z.array(z.number().int().positive()),
  skippedRows: z.array(
    z.object({
      rowNumber: z.number().int().positive(),
      lrn: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});
