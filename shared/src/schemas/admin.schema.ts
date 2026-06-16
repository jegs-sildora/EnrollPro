import { z } from "zod";
import { RoleEnum, SexEnum } from "../constants/index.js";

export const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  sex: SexEnum.optional().nullable(),
  employeeId: z
    .string()
    .regex(/^[0-9]{7}$/, "Employee ID must be exactly 7 numeric digits")
    .optional()
    .nullable(),
  designation: z.string().optional().nullable(),
  mobileNumber: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(RoleEnum).min(1, "At least one role is required"),
  mustChangePassword: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema
  .extend({
    isActive: z.boolean().optional(),
    password: z.string().min(8).optional().nullable(),
  })
  .partial();

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8).optional(),
  mustChangePassword: z.boolean().default(true),
});
