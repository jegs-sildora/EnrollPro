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

export const BaseEnrollmentFormSchema = z
  .object({
    // Phase 0: Data Privacy
    isPrivacyConsentGiven: z.boolean().refine((val) => val === true, {
      message: "Acceptance of the Data Privacy Notice is required to proceed.",
    }),
    
    // Auto-filled fetched details
    scpProgram: z.string().optional().nullable(),
    scpAdmissionStatus: z.string().optional().nullable(),


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
    isValidatingLrn: z.boolean().default(false).optional(),
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
    studentPhoto: z.string().min(1, "Learner photo is required"),
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
    motherTongue: z.string().min(1, "Mother tongue is required."),
    religion: z.string().min(1, "Religion is required."),
    intakeHeightCm: z
      .number({ message: "Please enter a valid numeric height." })
      .min(30, "Height must be at least 30 cm")
      .max(250, "Height must not exceed 250 cm"),
    intakeWeightKg: z
      .number({ message: "Please enter a valid numeric weight." })
      .min(10, "Weight must be at least 10 kg")
      .max(200, "Weight must not exceed 200 kg"),

    // Section 4: Special Classifications
    isIpCommunity: z.boolean({ message: "Please specify if the learner is a member of an IP cultural community." }),
    ipGroupName: z.string().optional(),
    is4PsBeneficiary: z.boolean({ message: "Please specify if the learner's household is a 4Ps beneficiary." }),
    householdId4Ps: z.string().optional(),
    isBalikAral: z.boolean({ message: "Please specify if the learner is a Balik-Aral." }),
    lastYearEnrolled: z.string().optional(),
    lastGradeLevel: z.string().optional(),
    isLearnerWithDisability: z.boolean({ message: "Please specify if the learner has a disability." }),
    specialNeedsCategory: z.enum(["a1", "a2"]).optional(),
    disabilityTypes: z.array(z.string()).default([]),
    hasPwdId: z.boolean().optional(),

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
    transferCertificateNo: z.string().optional(),
    lastSchoolType: z.enum(["Public", "Private", "International", "ALS"], { message: "Please select a valid school type." }),
    generalAverage: optionalSf9GeneralAverage,
    hasSf9Deficiency: z.boolean().default(false),

    // Section 8: SCP Specifics
    artField: z.string().optional(),
    sportsList: z.array(z.string()).default([]),
    foreignLanguage: z.string().optional(),
    hasScpFallbackConsent: z.boolean().default(false),

    // Section 9.2: Learner Type
    learnerType: z.enum(["NEW_ENROLLEE", "TRANSFEREE", "RETURNING"], { message: "Please select a valid learner type." }),
    learningModalities: z.array(z.enum(['BLENDED', 'EDUCATIONAL_TELEVISION', 'HOMESCHOOLING', 'MODULAR_DIGITAL', 'MODULAR_PRINT', 'ONLINE', 'RADIO_BASED_TELEVISION'])).default([]),
    bypassDuplicate: z.boolean().optional(),

    isCertifiedTrue: z.boolean().refine((val) => val === true, {
      message:
        "Verification and certification of the provided information is required.",
    }),
  });
  
const createSuperRefineLogic = (isEarlyRegistration: boolean) => (data: any, ctx: z.RefinementCtx) => {
    if (!isEarlyRegistration) {
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
        message:
          "Please clear the Learner Reference Number input if the learner does not have an LRN.",
        path: ["lrn"],
      });
    }

    if (!data.hasNoLrn && !lrnValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Please enter a valid 12-digit Learner Reference Number, or declare the learner has no LRN.",
        path: ["lrn"],
      });
    }

    if (data.isScpApplication && !data.scpType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a specific Special Curricular Program.",
        path: ["scpType"],
      });
    }

    if (data.isBalikAral) {
      if (!data.lastYearEnrolled?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide the school year the learner was last enrolled.",
          path: ["lastYearEnrolled"],
        });
      }
      if (!data.lastGradeLevel?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select the learner's last grade level.",
          path: ["lastGradeLevel"],
        });
      }
    }

    if (data.isLearnerWithDisability) {
      if (!data.specialNeedsCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please categorize the learner's special educational needs.",
          path: ["specialNeedsCategory"],
        });
      }

      if (!data.disabilityTypes || data.disabilityTypes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select at least one applicable disability type.",
          path: ["disabilityTypes"],
        });
      }
    }

    if (data.is4PsBeneficiary && !data.householdId4Ps?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please provide the 4Ps Household ID number.",
        path: ["householdId4Ps"],
      });
    }

    if (data.isIpCommunity && !data.ipGroupName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the indigenous community group.",
        path: ["ipGroupName"],
      });
    }

    if (data.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS" && !data.artField?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select an art specialization.",
        path: ["artField"],
      });
    }

    if (data.scpType === "SPECIAL_PROGRAM_IN_SPORTS" && data.sportsList.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select at least one sport.",
        path: ["sportsList"],
      });
    }

    if (data.scpType === "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE" && !data.foreignLanguage?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter the foreign language.",
        path: ["foreignLanguage"],
      });
    }

    if (data.primaryContact === "MOTHER" && data.hasNoMother) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You cannot assign the mother as primary contact if you have checked 'Learner has no mother'.",
        path: ["primaryContact"],
      });
    }

    if (data.primaryContact === "FATHER" && data.hasNoFather) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You cannot assign the father as primary contact if you have checked 'Learner has no father'.",
        path: ["primaryContact"],
      });
    }

    if (data.primaryContact === "GUARDIAN") {
      if (!data.guardian?.firstName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian's first name is required when assigned as primary contact.",
          path: ["guardian.firstName"],
        });
      }
      if (!data.guardian?.lastName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian's last name is required when assigned as primary contact.",
          path: ["guardian.lastName"],
        });
      }
      if (!data.guardianRelationship?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian's relationship to the learner is required when assigned as primary contact.",
          path: ["guardianRelationship"],
        });
      }
    }
  };

export const EnrollmentFormSchema = BaseEnrollmentFormSchema.superRefine(createSuperRefineLogic(false));

export const EarlyRegistrationFormSchema = BaseEnrollmentFormSchema.omit({
  isIpCommunity: true,
  is4PsBeneficiary: true,
  isBalikAral: true,
  isLearnerWithDisability: true,
}).superRefine(createSuperRefineLogic(true));

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


