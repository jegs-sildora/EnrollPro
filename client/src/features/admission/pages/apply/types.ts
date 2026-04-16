import { z } from "zod";

export const EnrollmentFormSchema = z
  .object({
    // Phase 0: Data Privacy
    isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Data Privacy Notice.",
    }),

    // Internal Reference
    earlyRegistrationId: z.number().optional().nullable(),

    // Section 1: Tracking Numbers
    schoolYear: z.string().min(1, "School year is required"),
    lrn: z
      .string()
      .regex(/^\d{12}$/, "LRN must be exactly 12 numeric digits")
      .optional()
      .or(z.literal("")),
    hasNoLrn: z.boolean().default(false),
    psaBirthCertNumber: z.string().optional(),

    // Section 2: Grade Level & Program
    gradeLevel: z.enum(["7"]),
    isScpApplication: z.boolean().default(false),
    scpType: z
      .enum([
        "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
        "SPECIAL_PROGRAM_IN_THE_ARTS",
        "SPECIAL_PROGRAM_IN_SPORTS",
        "SPECIAL_PROGRAM_IN_JOURNALISM",
        "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE",
        "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
      ])
      .optional(),

    // Section 3: Personal Information
    studentPhoto: z.string().optional(),
    lastName: z.string().min(1, "Last name is required"),
    firstName: z.string().min(1, "First name is required"),
    middleName: z.string().optional(),
    extensionName: z.string().optional(),
    birthdate: z.date(),
    age: z.number().min(0),
    sex: z.enum(["Male", "Female"]),
    placeOfBirth: z.string().min(1, "Place of birth is required"),
    religion: z.string().optional(),

    // Section 4: Special Classifications
    isIpCommunity: z.boolean().default(false),
    ipGroupName: z.string().optional(),
    is4PsBeneficiary: z.boolean().default(false),
    householdId4Ps: z.string().optional(),
    isBalikAral: z.boolean().default(false),
    lastYearEnrolled: z.string().optional(),
    lastGradeLevel: z.string().optional(),
    isLearnerWithDisability: z.boolean().default(false),
    specialNeedsCategory: z.enum(["a1", "a2"]).optional(),
    disabilityTypes: z.array(z.string()).default([]),
    hasPwdId: z.boolean().default(false),
    snedPlacement: z
      .enum(["Inclusive Education", "Special Education Center"])
      .optional(),

    // Section 5: Address Information
    currentAddress: z.object({
      houseNo: z.string().optional(),
      street: z.string().optional(),
      barangay: z.string().min(1, "Barangay is required"),
      cityMunicipality: z.string().min(1, "City/Municipality is required"),
      province: z.string().min(1, "Province is required"),
      country: z.string().default("Philippines"),
      zipCode: z.string().optional(),
    }),
    isPermanentSameAsCurrent: z.boolean().default(true),
    permanentAddress: z
      .object({
        houseNo: z.string().optional(),
        street: z.string().optional(),
        barangay: z.string().optional(),
        cityMunicipality: z.string().optional(),
        province: z.string().optional(),
        country: z.string().default("Philippines"),
        zipCode: z.string().optional(),
      })
      .optional(),

    // Section 6: Parent / Guardian Information
    mother: z.object({
      lastName: z.string().min(1, "Mother's last name is required"),
      firstName: z.string().min(1, "Mother's first name is required"),
      middleName: z.string().optional().nullable(),
      contactNumber: z.string().optional().nullable(),
      maidenName: z.string().optional().nullable(),
    }),
    father: z.object({
      lastName: z.string().min(1, "Father's last name is required"),
      firstName: z.string().min(1, "Father's first name is required"),
      middleName: z.string().optional().nullable(),
      contactNumber: z.string().optional().nullable(),
    }),
    guardian: z
      .object({
        lastName: z.string().optional().nullable(),
        firstName: z.string().optional().nullable(),
        middleName: z.string().optional().nullable(),
        contactNumber: z.string().optional().nullable(),
        relationship: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    email: z
      .string()
      .email("Invalid email address")
      .min(1, "Email address is required"),

    // Section 7: Previous School Information
    lastSchoolName: z.string().min(1, "Last school name is required"),
    lastSchoolId: z.string().optional(),
    lastGradeCompleted: z.string().min(1, "Last grade completed is required"),
    schoolYearLastAttended: z
      .string()
      .min(1, "School year last attended is required"),
    lastSchoolAddress: z.string().optional(),
    lastSchoolType: z.enum(["Public", "Private", "International", "ALS"]),
    generalAverage: z
      .number()
      .min(70, "Invalid average")
      .max(100, "Invalid average")
      .optional()
      .nullable(),

    // Section 8: SCP Specifics
    artField: z.string().optional(),
    sportsList: z.array(z.string()).default([]),
    foreignLanguage: z.string().optional(),

    // Section 9.2: Learner Type
    learnerType: z.enum([
      "NEW_ENROLLEE",
      "TRANSFEREE",
      "RETURNING",
      "CONTINUING",
      "OSCYA",
      "ALS",
    ]),
    learningModalities: z.array(z.string()).default([]),

    // Section 10: Certification
    isCertifiedTrue: z.boolean().refine((val) => val === true, {
      message: "You must certify that the information is true.",
    }),
    parentGuardianSignature: z.string().min(1, "Full Name is required"),
    dateAccomplished: z.date().default(new Date()),
  })
  .superRefine((data, ctx) => {
    const lrnValue = data.lrn?.trim() ?? "";
    const canDeclareNoLrn =
      data.learnerType === "TRANSFEREE" ||
      (data.learnerType === "NEW_ENROLLEE" && data.gradeLevel === "7");

    if (data.hasNoLrn && !canDeclareNoLrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Only incoming Grade 7 and transferee learners can declare no LRN.",
        path: ["hasNoLrn"],
      });
    }

    if (data.hasNoLrn && lrnValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Clear the LRN field when declaring no LRN.",
        path: ["lrn"],
      });
    }

    if (!data.hasNoLrn && !lrnValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "LRN is required unless no-LRN is declared.",
        path: ["lrn"],
      });
    }

    if (data.isScpApplication) {
      if (data.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && !data.artField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Art field is required for SPA applicants",
          path: ["artField"],
        });
      }
      if (
        data.scpType === "SPECIAL_PROGRAM_IN_SPORTS" &&
        (!data.sportsList || data.sportsList.length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one sport is required for SPS applicants",
          path: ["sportsList"],
        });
      }
    }
  });

export type EnrollmentFormData = z.infer<typeof EnrollmentFormSchema>;

export const DISABILITY_TYPES_A1 = [
  "Attention Deficit Hyperactivity Disorder",
  "Autism Spectrum Disorder",
  "Cerebral Palsy",
  "Emotional-Behavior Disorder",
  "Hearing Impairment",
];

export const DISABILITY_TYPES_A2 = [
  "Difficulty in Applying Knowledge",
  "Difficulty in Communicating",
  "Intellectual Disability",
  "Learning Disability",
  "Multiple Disabilities",
  "Orthopedic/Physical Handicap",
  "Speech/Language Disorder",
  "Special Health Problem/Chronic Disease",
  "Visual Impairment",
  "Difficulty in Displaying Interpersonal Behavior (Emotional and Behavioral)",
  "Difficulty in Hearing",
  "Difficulty in Mobility (Walking, Climbing and Grasping)",
  "Difficulty in Performing Adaptive Skills (Self-Care)",
  "Difficulty in Remembering, Concentrating, Paying Attention and Understanding",
  "Difficulty in Seeing",
];

export const DISABILITY_TYPES = [
  ...DISABILITY_TYPES_A1,
  ...DISABILITY_TYPES_A2,
];

export const SPA_ART_FIELDS = [
  "Visual Arts",
  "Music (Vocal)",
  "Music (Instrumental)",
  "Theatre Arts",
  "Dance Arts",
  "Media Arts",
  "Creative Writing (English)",
  "Creative Writing (Filipino)",
];

export const LEARNING_MODALITIES = [
  "Blended (Combination)",
  "Educational Television",
  "Homeschooling",
  "Modular (Digital)",
  "Modular (Print)",
  "Online",
  "Radio-Based Instruction",
];

export const SPS_SPORTS = [
  "Basketball",
  "Volleyball",
  "Football",
  "Badminton",
  "Table Tennis",
  "Swimming",
  "Arnis",
  "Taekwondo",
  "Athletics",
  "Chess",
  "Other",
];

export const SPFL_LANGUAGES = [
  "Japanese (Nihongo)",
  "Spanish",
  "French",
  "German",
  "Chinese (Mandarin)",
  "Korean",
];

// Aliases for backward compatibility
export const EarlyRegistrationSchema = EnrollmentFormSchema;
export type EarlyRegistrationFormData = EnrollmentFormData;
