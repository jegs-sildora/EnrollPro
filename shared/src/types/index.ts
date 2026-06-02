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
  approveSchema,
  rejectSchema,
  addressSchema,
  optionalAddressSchema,
  familyMemberSchema,
  previousSchoolSchema,
  updateChecklistSchema,
  requestRevisionSchema,
} from "../schemas/application.schema.js";
import type {
  teacherSchema,
  updateTeacherSchema,
  teacherDesignationSchema,
} from "../schemas/teacher.schema.js";
import type {
  updateIdentitySchema,
  selectAccentSchema,
  toggleEnrollmentSchema,
} from "../schemas/settings.schema.js";
import type {
  createSectionSchema,
  updateSectionSchema,
} from "../schemas/section.schema.js";
export type { SectioningParams } from "../schemas/section.schema.js";
import type {
  createSchoolYearSchema,
  updateSchoolYearSchema,
  updateRolloverDraftSchema,
  transitionSchoolYearSchema,
  toggleOverrideSchema,
} from "../schemas/school-year.schema.js";
import type {
  healthRecordSchema,
  updateStudentSchema,
} from "../schemas/student.schema.js";
import type {
  createUserSchema,
  updateUserSchema,
  adminResetPasswordSchema,
} from "../schemas/admin.schema.js";
import type { learnerLookupSchema } from "../schemas/learner.schema.js";


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
export type ApproveInput = z.infer<typeof approveSchema>;
export type RejectInput = z.infer<typeof rejectSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type RequestRevisionInput = z.infer<typeof requestRevisionSchema>;
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
export type UpdateRolloverDraftInput = z.infer<
  typeof updateRolloverDraftSchema
>;
export type TransitionSchoolYearInput = z.infer<
  typeof transitionSchoolYearSchema
>;
export type ToggleOverrideInput = z.infer<typeof toggleOverrideSchema>;

// ─── Student Types ─────────────────────────────────────
export type HealthRecordInput = z.infer<typeof healthRecordSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ─── Admin Types ───────────────────────────────────────
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;

// ─── Learner Types ─────────────────────────────────────
export type LearnerLookupInput = z.infer<typeof learnerLookupSchema>;


