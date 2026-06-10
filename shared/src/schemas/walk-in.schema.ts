import { z } from "zod";

export const directEncodeWalkInSchema = z.object({
  lrn: z.string().length(12, "LRN must be exactly 12 digits").optional().or(z.literal("")),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  middleName: z.string().optional(),
  birthdate: z.string().min(1, "Birthdate is required"),
  sex: z.enum(["MALE", "FEMALE"]),
  gradeLevelId: z.coerce.number().min(1, "Grade Level is required"),
  assignedProgram: z.string().optional().nullable(),
  previousSchoolName: z.string().optional().nullable(),
  previousGenAve: z.coerce.number().optional().nullable(),
  guardianName: z.string().min(1, "Guardian Name is required"),
  guardianContact: z.string().regex(/^\d{11}$/, "Contact number must be exactly 11 digits"),
  hasSf9: z.boolean().default(false),
  hasPsa: z.boolean().default(false),
});

export type DirectEncodeWalkInPayload = z.infer<typeof directEncodeWalkInSchema>;
