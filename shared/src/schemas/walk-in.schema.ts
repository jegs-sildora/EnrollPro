import { z } from "zod";

export const directEncodeWalkInSchema = z.object({
  learnerType: z.enum(["NEW_ENROLLEE", "TRANSFEREE", "RETURNING"]),
  lrn: z.string().optional(),
  firstName: z.string().min(1, "First Name is required"),
  lastName: z.string().min(1, "Last Name is required"),
  middleName: z.string().optional(),
  birthdate: z.string().min(1, "Birthdate is required"),
  sex: z.enum(["MALE", "FEMALE"]),
  gradeLevelId: z.coerce.number().min(1, "Grade Level is required"),
  assignedProgram: z.string().min(1, "Curriculum Type is required"),
  previousSchoolName: z.string().min(1, "School Name is required"),
  previousGenAve: z.preprocess(
    (value) => {
      if (value == null || value === "") return undefined;
      if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
      if (typeof value === "string") {
        const parsed = Number(value.trim().replace(",", "."));
        return Number.isFinite(parsed) ? parsed : Number.NaN;
      }
      return value;
    },
    z
      .number()
      .refine((v) => Number.isFinite(v), "Final Gen Ave must be a valid number")
      .min(75, "Final Gen Ave must be at least 75")
      .max(99.99, "Final Gen Ave must be at most 99.99")
      .refine((v) => {
        const dec = v.toString().split(".")[1];
        return !dec || dec.length <= 2;
      }, "Final Gen Ave must have at most 2 decimal places")
      .optional()
      .nullable(),
  ),
  transferCertificateNo: z.string().optional(),
  guardianFirstName: z.string().min(1, "Guardian First Name is required"),
  guardianMiddleName: z.string().optional(),
  guardianLastName: z.string().min(1, "Guardian Last Name is required"),
  guardianRelationship: z.enum(["MOTHER", "FATHER", "GUARDIAN"]),
  guardianContact: z.string().regex(/^\d{11}$/, "Contact number must be exactly 11 digits"),
  hasSf9: z.boolean().default(false),
  hasPsa: z.boolean().default(false),
  originatingSchoolId: z.string().min(1, "Originating School ID is required"),
  sf9EligibilityStatus: z.enum([
    "PROMOTED",
    "CONDITIONALLY_PROMOTED",
    "RETAINED"
  ]),
})
.superRefine((obj, ctx) => {
  const { learnerType, lrn } = obj;
  if (learnerType === "TRANSFEREE") {
    if (!lrn || lrn.length !== 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LRN must be exactly 12 digits",
        path: ["lrn"]
      });
    }
  } else {
    if (lrn && lrn.length !== 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LRN must be exactly 12 digits",
        path: ["lrn"]
      });
    }
  }
});

export type DirectEncodeWalkInPayload = z.infer<typeof directEncodeWalkInSchema>;
