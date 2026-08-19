import { z } from "zod";

export const loginSchema = z.object({
  accountName: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const externalCredentialVerificationSchema = loginSchema.extend({
  returnTo: z.string().url("Return URL must be a valid URL").optional(),
});

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const externalPasswordChangeSchema = changePasswordSchema;

export const passwordChangeRequiredResponseSchema = z.object({
  valid: z.literal(false),
  code: z.literal("PASSWORD_CHANGE_REQUIRED"),
  message: z.string(),
  mustChangePassword: z.literal(true),
  passwordChangePath: z.string(),
  passwordChangeUrl: z.string().url(),
  returnTo: z.string().url().nullable(),
});

export type PasswordChangeRequiredResponse = z.infer<
  typeof passwordChangeRequiredResponseSchema
>;

export const userResponseSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  employeeId: z.string().nullable(),
  accountName: z.string().nullable(),
  roles: z.array(z.string()),
  mustChangePassword: z.boolean().optional(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userResponseSchema,
});
