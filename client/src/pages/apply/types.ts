import { z } from 'zod';

export const admissionSchema = z.object({
  // Phase 0: Data Privacy
  privacyConsentGiven: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Data Privacy Notice.',
  }),

  // Section 1: Reference Numbers
  schoolYear: z.string().min(1, 'School year is required'),
  lrn: z.string().optional().refine((val) => !val || /^\d{12}$/.test(val), {
    message: 'LRN must be exactly 12 numeric digits',
  }),
  psaBcNumber: z.string().optional(),

  // Section 2: Grade Level & Program
  gradeLevel: z.enum(['7', '8', '9', '10', '11', '12']),
  shsTrack: z.enum(['Academic', 'TechPro']).optional(),
  electiveCluster: z.string().optional(),
  scpApplication: z.boolean().default(false),
  scpType: z.enum(['STE', 'SPA', 'SPS', 'SPJ', 'SPFL', 'SPTVE']).optional(),

  // Section 3: Personal Information
  lastName: z.string().min(1, 'Last name is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extensionName: z.string().optional(),
  birthdate: z.date(),
  age: z.number().min(0),
  sex: z.enum(['Male', 'Female']),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  religion: z.string().optional(),
  motherTongue: z.string().min(1, 'Mother tongue is required'),

  // Section 4: Special Classifications
  isIpCommunity: z.boolean().default(false),
  ipGroupName: z.string().optional(),
  is4PsBeneficiary: z.boolean().default(false),
  householdId4Ps: z.string().optional(),
  isBalikAral: z.boolean().default(false),
  lastYearEnrolled: z.string().optional(),
  lastGradeLevel: z.string().optional(),
  isLearnerWithDisability: z.boolean().default(false),
  disabilityType: z.array(z.string()).default([]),
  snedPlacement: z.enum(['Inclusive Education', 'Special Education Center']).optional(),

  // Section 5: Address Information
  currentAddress: z.object({
    houseNo: z.string().optional(),
    street: z.string().optional(),
    barangay: z.string().min(1, 'Barangay is required'),
    cityMunicipality: z.string().min(1, 'City/Municipality is required'),
    province: z.string().min(1, 'Province is required'),
    country: z.string().default('Philippines'),
    zipCode: z.string().optional(),
  }),
  isPermanentSameAsCurrent: z.boolean().default(true),
  permanentAddress: z.object({
    houseNo: z.string().optional(),
    street: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
    country: z.string().default('Philippines'),
    zipCode: z.string().optional(),
  }).optional(),

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
  guardian: z.object({
    lastName: z.string().optional().nullable(),
    firstName: z.string().optional().nullable(),
    middleName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
    relationship: z.string().optional().nullable(),
  }).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),

  // Section 7: Previous School Information
  lastSchoolName: z.string().min(1, 'Last school name is required'),
  lastSchoolId: z.string().optional(),
  lastGradeCompleted: z.string().min(1, 'Last grade completed is required'),
  syLastAttended: z.string().min(1, 'School year last attended is required'),
  lastSchoolAddress: z.string().optional(),
  lastSchoolType: z.enum(['Public', 'Private', 'International', 'ALS']),

  // Section 8: SHS STEM Specifics
  g10ScienceGrade: z.number().optional(),
  g10MathGrade: z.number().optional(),

  // Section 9: SCP Specifics
  spaArtField: z.string().optional(),
  spsSports: z.array(z.string()).default([]),
  spflLanguage: z.string().optional(),

  // Section 9.2: Learner Type
  learnerType: z.enum(['Regular', 'Transferee', 'Returning Learner', 'OSCYA', 'ALS']),

  // Section 10: Certification
  isCertifiedTrue: z.boolean().refine((val) => val === true, {
    message: 'You must certify that the information is true.',
  }),
  parentGuardianSignature: z.string().min(1, 'Signature (full name) is required'),
  dateAccomplished: z.date().default(new Date()),
});

export type AdmissionFormData = z.infer<typeof admissionSchema>;

// Track/Cluster Options
export const ACADEMIC_CLUSTERS = [
  { value: 'AC-STEM', label: 'Science, Technology, Engineering, and Mathematics (STEM)' },
  { value: 'AC-ARTSOC', label: 'Arts, Social Sciences, and Humanities' },
  { value: 'AC-SPORTS', label: 'Sports, Health, and Wellness' },
  { value: 'AC-BUSENT', label: 'Business and Entrepreneurship' },
  { value: 'AC-FIELDEXP', label: 'Field Experience' },
];

export const TECHPRO_CLUSTERS = [
  { value: 'TP-AESTWH', label: 'Aesthetic, Wellness, and Human Care' },
  { value: 'TP-AGRIFOOD', label: 'Agri-Fishery Business and Food Innovation' },
  { value: 'TP-ARTISAN', label: 'Artisanry and Creative Enterprise' },
  { value: 'TP-AUTO', label: 'Automotive and Small Engine Technologies' },
  { value: 'TP-CONST', label: 'Construction and Building Technologies' },
  { value: 'TP-CREATIVE', label: 'Creative Arts and Design Technologies' },
  { value: 'TP-HOSPTOUR', label: 'Hospitality and Tourism' },
  { value: 'TP-INDTECH', label: 'Industrial Technologies' },
  { value: 'TP-ICT', label: 'ICT Support and Computer Programming Technologies' },
  { value: 'TP-MARITIME', label: 'Maritime Transport transport' },
];

export const DISABILITY_TYPES = [
  'Visual Impairment', 'Hearing Impairment', 'Physical/Motor Disability',
  'Intellectual Disability', 'Learning Disability', 'Speech/Language Disorder',
  'Emotional/Behavioral Disorder', 'Autism Spectrum Disorder', 'Multiple Disabilities', 'Other'
];

export const SPA_ART_FIELDS = [
  'Visual Arts', 'Music (Vocal)', 'Music (Instrumental)', 'Theatre Arts',
  'Dance Arts', 'Media Arts', 'Creative Writing (English)', 'Creative Writing (Filipino)'
];

export const SPS_SPORTS = [
  'Basketball', 'Volleyball', 'Football', 'Badminton', 'Table Tennis',
  'Swimming', 'Arnis', 'Taekwondo', 'Athletics', 'Chess', 'Other'
];

export const SPFL_LANGUAGES = [
  'Japanese (Nihongo)', 'Spanish', 'French', 'German', 'Chinese (Mandarin)', 'Korean'
];
