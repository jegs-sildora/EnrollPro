import { z } from "zod";
import { AssessmentPeriodEnum } from "../constants/index.js";

export const healthRecordSchema = z.object({
  assessmentPeriod: AssessmentPeriodEnum,
  assessmentDate: z.string().or(z.date()),
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  notes: z.string().optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  middleName: z.string().optional().nullable(),
  suffix: z.string().optional().nullable(),
  sex: z.string().optional(),
  birthDate: z.string().or(z.date()).optional(),
  email: z.string().email().optional().nullable(),
  contactNumber: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  isIpCommunity: z.boolean().optional(),
  is4PsBeneficiary: z.boolean().optional(),
  isLearnerWithDisability: z.boolean().optional(),
  disabilityTypes: z.array(z.string()).optional().nullable(),
  isBalikAral: z.boolean().optional(),
  currentAddress: z.object({
    houseNoStreet: z.string().optional(),
    sitio: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
    region: z.string().optional(),
  }).optional(),
  permanentAddress: z.object({
    houseNoStreet: z.string().optional(),
    sitio: z.string().optional(),
    barangay: z.string().optional(),
    cityMunicipality: z.string().optional(),
    province: z.string().optional(),
    region: z.string().optional(),
  }).optional().nullable(),
  motherName: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional().nullable(),
    maidenName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
  }).optional().nullable(),
  fatherName: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional().nullable(),
    contactNumber: z.string().optional().nullable(),
  }).optional().nullable(),
  guardianInfo: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional().nullable(),
    relationship: z.string().optional(),
    contactNumber: z.string().optional().nullable(),
  }).optional().nullable(),
});
