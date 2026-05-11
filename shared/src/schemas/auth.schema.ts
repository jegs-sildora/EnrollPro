import { z } from "zod";

export const loginSchema = z.object({
  accountName: z.string().min(1, "Employee ID is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const userResponseSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  employeeId: z.string().nullable(),
  accountName: z.string().nullable(),
  role: z.string(),
  mustChangePassword: z.boolean().optional(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  user: userResponseSchema,
});
