import { z } from "zod";
import { RoleEnum, SexEnum } from "../constants/index.js";

export const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  sex: SexEnum.optional().nullable(),
  employeeId: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  mobileNumber: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(8),
  role: RoleEnum,
  mustChangePassword: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial();

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8),
  mustChangePassword: z.boolean().default(true),
});
