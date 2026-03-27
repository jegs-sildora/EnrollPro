import { z } from 'zod';

export const teacherSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  employeeId: z.string().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  subjects: z.array(z.string()).optional().default([]),
});

export const updateTeacherSchema = teacherSchema.partial();
