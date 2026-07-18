import { z } from "zod";

const optionalSecondaryContactText = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return value;
}, z.string().optional().nullable());



const optionalSf9GeneralAverage = z.preprocess(
  (value) => {
    if (value == null || value === "") {
      return undefined;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") {
        return undefined;
      }

      const parsed = Number(trimmed.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return value;
  },
  z
    .number()
    .optional()
    .refine((value) => {
      if (value === undefined || value === null) return true;
      return value >= 0 && value <= 100;
    }, "General Average must be between 0 and 100.")
    .refine((value) => {
      if (value === undefined || value === null) return true;
      const stringValue = value.toString();
      const decimalPart = stringValue.split(".")[1];
      return !decimalPart || decimalPart.length <= 2;
    }, "General Average must not exceed two decimal places."),
);

export const EnrollmentFormSchema = z
  .object({
    // Phase 0: Data Privacy
    isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
      message: "Acceptance of the Data Privacy Notice is required to proceed.",
    }),

    // Internal Reference
    earlyRegistrationId: z.number({ message: "Invalid reference format." }).optional().nullable(),

    // Section 1: Tracking Numbers
    schoolYear: z.string({ message: "Please select a valid academic year." }).min(1, "Academic year selection is required."),
    lrn: z
      .string()
      .regex(
        /^\d{12}$/,
        "Learner Reference Number must be exactly 12 numeric digits.",
      )
      .optional()
      .or(z.literal("")),
    hasNoLrn: z.boolean().default(false),
    psaBirthCertNumber: z.string().optional(),

    // Section 2: Grade Level & Program
    gradeLevel: z.enum(["7", "8", "9", "10"], { message: "Please select a valid grade level." }),
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
    lastName: z.string().min(1, "Learner's last name is required."),
    firstName: z.string().min(1, "Learner's first name is required."),
    middleName: z.string().optional(),
    extensionName: z.string().optional(),
    birthdate: z.date({ message: "Please provide a valid birthdate." }),
    age: z.number({ message: "Please enter a valid numeric age." }).min(0, "Age must be at least 0"),
    sex: z.enum(["Male", "Female"], { message: "Please select a valid gender." }),
    placeOfBirth: z
      .string()
      .min(1, "Place of birth as indicated in birth certificate is required."),
    motherTongue: z.string().optional(),
    religion: z.string().optional(),
    intakeHeightCm: z
      .number({ message: "Please enter a valid numeric height." })
      .min(30, "Height must be at least 30 cm")
      .max(250, "Height must not exceed 250 cm"),
    intakeWeightKg: z
      .number({ message: "Please enter a valid numeric weight." })
      .min(10, "Weight must be at least 10 kg")
      .max(200, "Weight must not exceed 200 kg"),

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
      region: z.string({ message: "Please select a valid region." }).min(1, "Current region is required."),
      province: z.string({ message: "Please select a valid province." }).min(1, "Current province is required."),
      cityMunicipality: z
        .string({ message: "Please select a valid city/municipality." })
        .min(1, "Current city/municipality is required."),
      barangay: z.string({ message: "Please select a valid barangay." }).min(1, "Current barangay is required."),
      country: z.string().default("Philippines"),
      zipCode: z.string().optional(),
    }),
    isPermanentSameAsCurrent: z.boolean().default(true),
    permanentAddress: z
      .object({
        houseNo: z.string().optional(),
        street: z.string().optional(),
        region: z.string().optional(),
        province: z.string().optional(),
        cityMunicipality: z.string().optional(),
        barangay: z.string().optional(),
        country: z.string().default("Philippines"),
        zipCode: z.string().optional(),
      })
      .optional(),

    // Section 6: Parent / Guardian Information
    hasNoMother: z.boolean().default(false),
    hasNoFather: z.boolean().default(false),
    mother: z.object({
      lastName: z.string().min(1, "Mother's maiden last name is required."),
      firstName: z.string().min(1, "Mother's first name is required."),
      middleName: z.string().optional().nullable(),
      contactNumber: optionalSecondaryContactText,
      maidenName: z.string().optional().nullable(),
    }),
    father: z.object({
      lastName: z.string().min(1, "Father's last name is required."),
      firstName: z.string().min(1, "Father's first name is required."),
      middleName: z.string().optional().nullable(),
      contactNumber: optionalSecondaryContactText,
    }),
    guardian: z
      .object({
        lastName: z.string().optional().nullable(),
        firstName: z.string().optional().nullable(),
        middleName: z.string().optional().nullable(),
        contactNumber: optionalSecondaryContactText,
        relationship: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    primaryContact: z.enum(["MOTHER", "FATHER", "GUARDIAN"], { message: "Please select a valid primary contact." }),
    contactNumber: z
      .string()
      .regex(/^09\d{2}-\d{3}-\d{4}$/, "Please use the format 09XX-XXX-XXXX."),
    guardianRelationship: z.string().optional().nullable(),

    // Section 7: Previous School Information
    lastSchoolName: z
      .string()
      .min(1, "Name of the last school attended is required."),
    lastSchoolId: z.string().optional(),
    lastGradeCompleted: z
      .string({ message: "Please select a valid grade level." })
      .min(1, "Last grade level completed is required."),
    schoolYearLastAttended: z
      .string({ message: "Please provide a valid school year." })
      .min(1, "School year of last attendance is required."),
    lastSchoolAddress: z.string().optional(),
    lastSchoolType: z.enum(["Public", "Private", "International", "ALS"], { message: "Please select a valid school type." }),
    generalAverage: optionalSf9GeneralAverage,
    hasSf9Deficiency: z.boolean().default(false),
    natScore: z.number({ message: "Please enter a valid numeric NAT score." }).optional().nullable(),

    // Section 8: SCP Specifics
    artField: z.string().optional(),
    sportsList: z.array(z.string()).default([]),
    foreignLanguage: z.string().optional(),
    hasScpFallbackConsent: z.boolean().default(false),

    // Section 9.2: Learner Type
    learnerType: z.enum(["NEW_ENROLLEE", "TRANSFEREE", "RETURNING"], { message: "Please select a valid learner type." }),
    learningModalities: z.array(z.string()).default([]),

    // Section 10: Certification
    isCertifiedTrue: z.boolean().refine((val) => val === true, {
      message:
        "Verification and certification of the provided information is required.",
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.hasSf9Deficiency && (data.generalAverage === undefined || data.generalAverage === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Final General Average (SF9) is required unless a temporary enrollment (D.O. 017) is declared.",
        path: ["generalAverage"],
      });
    }

    if (data.hasSf9Deficiency && data.generalAverage !== undefined && data.generalAverage !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "General Average must be empty if you are temporarily enrolling without an SF9.",
        path: ["generalAverage"],
      });
    }

    const lrnValue = data.lrn?.trim() ?? "";
    const canDeclareNoLrn =
      data.learnerType === "TRANSFEREE" ||
      (data.learnerType === "NEW_ENROLLEE" && data.gradeLevel === "7");

    if (data.hasNoLrn && !canDeclareNoLrn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "LRN exemption is only applicable to incoming Grade 7 and transferee learners.",
        path: ["hasNoLrn"],
      });
    }

    if (data.hasNoLrn && lrnValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The LRN field must be empty when declaring a No-LRN status.",
        path: ["lrn"],
      });
    }

    if (!data.hasNoLrn && !lrnValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A valid LRN is required unless a No-LRN declaration is made.",
        path: ["lrn"],
      });
    }

    const isScpEligible =
      data.learnerType === "NEW_ENROLLEE" && data.gradeLevel === "7";

    if (data.isScpApplication && !isScpEligible) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Special Curricular Program (SCP) eligibility is restricted to New Enrollees for Grade 7.",
        path: ["isScpApplication"],
      });
    }

    if (data.isScpApplication) {
      if (!data.scpType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "A Special Curricular Program (SCP) track selection is required.",
          path: ["scpType"],
        });
      }

      if (!data.hasScpFallbackConsent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "You must acknowledge the SCP assessment and placement terms.",
          path: ["hasScpFallbackConsent"],
        });
      }

      if (data.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && !data.artField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Preferred Art Field selection is required for SPA applicants.",
          path: ["artField"],
        });
      }
      if (
        data.scpType === "SPECIAL_PROGRAM_IN_SPORTS" &&
        (!data.sportsList || data.sportsList.length === 0)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "At least one primary sport must be selected for SPS applicants.",
          path: ["sportsList"],
        });
      }

      if (!data.earlyRegistrationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "SCP admission requires a verified Early Registration record to proceed.",
          path: ["earlyRegistrationId"],
        });
      }
    }

    const isMotherAvailable = !data.hasNoMother;
    const isFatherAvailable = !data.hasNoFather;

    if (!isMotherAvailable && !isFatherAvailable) {
      if (!data.guardian?.lastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Guardian's last name is required when parental information is unavailable.",
          path: ["guardian", "lastName"],
        });
      }

      if (!data.guardian?.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Guardian's first name is required when parental information is unavailable.",
          path: ["guardian", "firstName"],
        });
      }

      if (
        !data.guardianRelationship?.trim() &&
        !data.guardian?.relationship?.trim()
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Relationship to guardian is required when parental information is unavailable.",
          path: ["guardianRelationship"],
        });
      }
    }

    if (data.primaryContact === "MOTHER" && !isMotherAvailable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Primary contact selection is invalid due to missing maternal data.",
        path: ["primaryContact"],
      });
    }

    if (data.primaryContact === "FATHER" && !isFatherAvailable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Primary contact selection is invalid due to missing paternal data.",
        path: ["primaryContact"],
      });
    }

    if (
      data.primaryContact === "GUARDIAN" &&
      (!data.guardian?.firstName?.trim() || !data.guardian?.lastName?.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please provide complete guardian details before designating as the primary contact.",
        path: ["primaryContact"],
      });
    }

    if (data.isLearnerWithDisability) {
      if (!data.specialNeedsCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select either a1 or a2 for Special Needs Category.",
          path: ["specialNeedsCategory"],
        });
      } else {
        const types = data.disabilityTypes || [];
        if (types.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select at least one condition.",
            path: ["disabilityTypes"],
          });
        } else {
          // Check for sub-options
          const hasSpecialHealth = types.includes("Special Health Problem/Chronic Disease");
          const hasVisualImpairment = types.includes("Visual Impairment");
          
          let mainSelections = types.filter(
            t => !SPECIAL_HEALTH_SUB_OPTIONS.includes(t) && !VISUAL_IMPAIRMENT_SUB_OPTIONS.includes(t)
          );

          if (mainSelections.length > 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Please check only 1 main condition, either from a1 or a2.",
              path: ["disabilityTypes"],
            });
          }

          if (hasSpecialHealth) {
            const hasSubOption = types.some(t => SPECIAL_HEALTH_SUB_OPTIONS.includes(t));
            if (!hasSubOption) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select a specific type for Special Health Problem/Chronic Disease.",
                path: ["disabilityTypes"],
              });
            }
          }

          if (hasVisualImpairment) {
            const hasSubOption = types.some(t => VISUAL_IMPAIRMENT_SUB_OPTIONS.includes(t));
            if (!hasSubOption) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select a specific type for Visual Impairment.",
                path: ["disabilityTypes"],
              });
            }
          }
        }
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
  "Intellectual Disability",
  "Learning Disability",
  "Multiple Disabilities",
  "Orthopedic/Physical Handicap",
  "Speech/Language Disorder",
  "Special Health Problem/Chronic Disease",
  "Visual Impairment",
];

export const SPECIAL_HEALTH_SUB_OPTIONS = ["Cancer", "Non-Cancer"];
export const VISUAL_IMPAIRMENT_SUB_OPTIONS = ["Blind", "Low Vision"];

export const DISABILITY_TYPES_A2 = [
  "Difficulty in Applying Knowledge",
  "Difficulty in Communicating",
  "Difficulty in Displaying Interpersonal Behavior (Emotional and Behavioral)",
  "Difficulty in Hearing",
  "Difficulty in Mobility (Walking, Climbing and Grasping)",
  "Difficulty in Performing Adaptive Skills (Self-Care)",
  "Difficulty in Remembering, Concentrating, Paying Attention and Understanding",
  "Difficulty in Seeing",
];

export const DISABILITY_TYPES = [
  ...DISABILITY_TYPES_A1,
  ...SPECIAL_HEALTH_SUB_OPTIONS,
  ...VISUAL_IMPAIRMENT_SUB_OPTIONS,
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
