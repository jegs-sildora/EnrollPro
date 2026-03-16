import { z } from 'zod';

const addressSchema = z.object({
  houseNo: z.string().optional(),
  street: z.string().optional(),
  barangay: z.string().min(1, 'Barangay is required'),
  cityMunicipality: z.string().min(1, 'City/Municipality is required'),
  province: z.string().min(1, 'Province is required'),
  country: z.string().default('Philippines'),
  zipCode: z.string().optional(),
});

const optionalAddressSchema = z.object({
  houseNo: z.string().optional(),
  street: z.string().optional(),
  barangay: z.string().optional(),
  cityMunicipality: z.string().optional(),
  province: z.string().optional(),
  country: z.string().default('Philippines'),
  zipCode: z.string().optional(),
}).optional().nullable();

export const applicationSubmitSchema = z.object({
  // Reference numbers
  lrn: z.string().optional().nullable().refine((val) => !val || /^\d{12}$/.test(val), {
    message: 'LRN must be exactly 12 numeric digits',
  }),
  psaBcNumber: z.string().optional().nullable(),

  // Grade level & program
  gradeLevel: z.enum(['7', '8', '9', '10', '11', '12']),
  shsTrack: z.enum(['Academic', 'TechPro']).optional().nullable(),
  electiveCluster: z.string().optional().nullable(),
  scpApplication: z.boolean().default(false),
  scpType: z.enum(['STE', 'SPA', 'SPS', 'SPJ', 'SPFL', 'SPTVE']).optional().nullable(),

  // Personal information
  lastName: z.string().min(1, 'Last name is required').max(100),
  firstName: z.string().min(1, 'First name is required').max(100),
  middleName: z.string().optional().nullable(),
  extensionName: z.string().optional().nullable(),
  birthdate: z.string().or(z.date()),
  sex: z.enum(['Male', 'Female']),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  religion: z.string().optional().nullable(),
  motherTongue: z.string().min(1, 'Mother tongue is required'),

  // Special classifications
  isIpCommunity: z.boolean().default(false),
  ipGroupName: z.string().optional().nullable(),
  is4PsBeneficiary: z.boolean().default(false),
  householdId4Ps: z.string().optional().nullable(),
  isBalikAral: z.boolean().default(false),
  lastYearEnrolled: z.string().optional().nullable(),
  isLearnerWithDisability: z.boolean().default(false),
  disabilityType: z.array(z.string()).default([]),

  // Address
  currentAddress: addressSchema,
  permanentAddress: optionalAddressSchema,

  // Parent/guardian
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
  guardian: z.object({
    lastName: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    middleName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
    relationship: z.string().optional().nullable(),
  }).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),

  // Previous school
  lastSchoolName: z.string().min(1, 'Last school name is required'),
  lastSchoolId: z.string().optional().nullable(),
  lastGradeCompleted: z.string().min(1, 'Last grade completed is required'),
  syLastAttended: z.string().min(1, 'School year last attended is required'),
  lastSchoolAddress: z.string().optional().nullable(),
  lastSchoolType: z.enum(['Public', 'Private', 'International', 'ALS']),

  // STEM grades (G11 STEM only)
  g10ScienceGrade: z.number().optional().nullable(),
  g10MathGrade: z.number().optional().nullable(),

  // SCP specifics
  spaArtField: z.string().optional().nullable(),
  spsSports: z.array(z.string()).default([]),
  spflLanguage: z.string().optional().nullable(),

  // Learner type
  learnerType: z.enum(['Regular', 'Transferee', 'Returning Learner', 'OSCYA', 'ALS']),
});

export const approveSchema = z.object({
  sectionId: z.number().int().positive('Section ID is required'),
});

export const rejectSchema = z.object({
  rejectionReason: z.string().optional(),
});

export const scheduleExamSchema = z.object({
  examDate: z.string().or(z.date()),
  assessmentType: z.string().min(1, 'Assessment type is required'),
});

export const recordResultSchema = z.object({
  examScore: z.number().optional().nullable(),
  examResult: z.string().optional().nullable(),
  examNotes: z.string().optional().nullable(),
  interviewResult: z.string().optional().nullable(),
});
