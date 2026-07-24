import type { z } from "zod";
import type {
  loginSchema,
  changePasswordSchema,
  userResponseSchema,
  loginResponseSchema,
} from "../schemas/auth.schema.js";
import type {
  applicationSubmitSchema,
  applicationTrackingStateSchema,
  applicationSubmitResponseSchema,
  applicationTrackResponseSchema,
  addressSchema,
  optionalAddressSchema,
  familyMemberSchema,
  previousSchoolSchema,
} from "../schemas/application.schema.js";
import type {
  teacherSchema,
  updateTeacherSchema,
  teacherDesignationSchema,
  teacherSchedulePeriodSchema,
  teacherSchedulePeriodsReplaceSchema,
} from "../schemas/teacher.schema.js";
import type {
  sf7AtlasSyncResponseSchema,
  sf7ImportCommitResponseSchema,
  sf7ImportCommitSchema,
  sf7ImportPreviewResponseSchema,
  sf7ImportPreviewRowSchema,
  sf7SchedulePeriodPreviewSchema,
} from "../schemas/sf7.schema.js";
import type {
  sf1ImportCommitResponseSchema,
  sf1ImportCommitSchema,
  sf1ImportIssueCodeSchema,
  sf1ImportMatchStatusSchema,
  sf1ImportPreviewResponseSchema,
  sf1ImportPreviewRowSchema,
} from "../schemas/sf1.schema.js";
import type {
  updateIdentitySchema,
  selectAccentSchema,
  toggleEnrollmentSchema,
} from "../schemas/settings.schema.js";
import type {
  createSectionSchema,
  updateSectionSchema,
} from "../schemas/section.schema.js";
import type {
  createSchoolYearSchema,
  updateSchoolYearSchema,
  transitionSchoolYearSchema,
  toggleOverrideSchema,
  calendarPolicyStatusSchema,
  schoolYearCalendarPolicySchema,
} from "../schemas/school-year.schema.js";
import type {
  smartEosyLearnerOutcomeSchema,
  smartEosySectionResponseSchema,
  smartLearningAreaResultSchema,
} from "../schemas/smart-eosy.schema.js";
import type {
  healthRecordSchema,
  updateStudentSchema,
} from "../schemas/student.schema.js";
import type {
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
} from "../schemas/admin.schema.js";
import type {
  learnerLookupSchema,
  learnerLoginSchema,
  learnerSetupPasswordSchema,
  learnerAuthResponseSchema,
} from "../schemas/learner.schema.js";

// ─── Auth Types ────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ─── Application Types ─────────────────────────────────
export type Address = z.infer<typeof addressSchema>;
export type OptionalAddress = z.infer<typeof optionalAddressSchema>;
export type FamilyMember = z.infer<typeof familyMemberSchema>;
export type PreviousSchoolInput = z.infer<typeof previousSchoolSchema>;
export type ApplicationSubmitInput = z.infer<typeof applicationSubmitSchema>;
export type ApplicationTrackingState = z.infer<
  typeof applicationTrackingStateSchema
>;
export type ApplicationSubmitResponse = z.infer<
  typeof applicationSubmitResponseSchema
>;
export type ApplicationTrackResponse = z.infer<
  typeof applicationTrackResponseSchema
>;
// ─── Teacher Types ─────────────────────────────────────
export type TeacherInput = z.infer<typeof teacherSchema>;
export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;
export type TeacherDesignationInput = z.infer<typeof teacherDesignationSchema>;
export type TeacherSchedulePeriodInput = z.infer<
  typeof teacherSchedulePeriodSchema
>;
export type TeacherSchedulePeriodsReplaceInput = z.infer<
  typeof teacherSchedulePeriodsReplaceSchema
>;
export type Sf7SchedulePeriodPreview = z.infer<
  typeof sf7SchedulePeriodPreviewSchema
>;
export type Sf7ImportPreviewRow = z.infer<typeof sf7ImportPreviewRowSchema>;
export type Sf7ImportCommitInput = z.infer<typeof sf7ImportCommitSchema>;
export type Sf7ImportPreviewResponse = z.infer<
  typeof sf7ImportPreviewResponseSchema
>;
export type Sf7ImportCommitResponse = z.infer<
  typeof sf7ImportCommitResponseSchema
>;
export type Sf7AtlasSyncResponse = z.infer<typeof sf7AtlasSyncResponseSchema>;
export type Sf1ImportIssueCode = z.infer<typeof sf1ImportIssueCodeSchema>;
export type Sf1ImportMatchStatus = z.infer<typeof sf1ImportMatchStatusSchema>;
export type Sf1ImportPreviewRow = z.infer<typeof sf1ImportPreviewRowSchema>;
export type Sf1ImportPreviewResponse = z.infer<
  typeof sf1ImportPreviewResponseSchema
>;
export type Sf1ImportCommitInput = z.infer<typeof sf1ImportCommitSchema>;
export type Sf1ImportCommitResponse = z.infer<
  typeof sf1ImportCommitResponseSchema
>;

// ─── Settings Types ────────────────────────────────────
export type UpdateIdentityInput = z.infer<typeof updateIdentitySchema>;
export type SelectAccentInput = z.infer<typeof selectAccentSchema>;
export type ToggleEnrollmentInput = z.infer<typeof toggleEnrollmentSchema>;

// ─── Section Types ─────────────────────────────────────
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

// ─── School Year Types ─────────────────────────────────
export type CreateSchoolYearInput = z.infer<typeof createSchoolYearSchema>;
export type UpdateSchoolYearInput = z.infer<typeof updateSchoolYearSchema>;
export type TransitionSchoolYearInput = z.infer<
  typeof transitionSchoolYearSchema
>;
export type ToggleOverrideInput = z.infer<typeof toggleOverrideSchema>;
export type CalendarPolicyStatus = z.infer<typeof calendarPolicyStatusSchema>;
export type SchoolYearCalendarPolicyInput = z.infer<
  typeof schoolYearCalendarPolicySchema
>;
export type SmartLearningAreaResult = z.infer<
  typeof smartLearningAreaResultSchema
>;
export type SmartEosyLearnerOutcome = z.infer<
  typeof smartEosyLearnerOutcomeSchema
>;
export type SmartEosySectionResponse = z.infer<
  typeof smartEosySectionResponseSchema
>;

// ─── Student Types ─────────────────────────────────────
export type HealthRecordInput = z.infer<typeof healthRecordSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ─── Admin Types ───────────────────────────────────────
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

// ─── Learner Types ─────────────────────────────────────
export type LearnerLookupInput = z.infer<typeof learnerLookupSchema>;
export type LearnerLoginInput = z.infer<typeof learnerLoginSchema>;
export type LearnerSetupPasswordInput = z.infer<typeof learnerSetupPasswordSchema>;
export type LearnerAuthResponse = z.infer<typeof learnerAuthResponseSchema>;
