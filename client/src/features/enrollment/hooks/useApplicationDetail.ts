import { useState, useEffect, useCallback } from "react";
import { isAxiosError } from "axios";
import api from "@/shared/api/axiosInstance";

export interface Address {
  houseNo?: string;
  street?: string;
  sitio?: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  country: string;
  zipCode?: string;
}

export interface ParentInfo {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  contactNumber?: string | null;
  maidenName?: string | null;
  email?: string | null;
}

export interface GuardianInfo {
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  relationship?: string | null;
}

export interface EnrollmentDetail {
  id: number;
  applicantId: number;
  sectionId: number;
  schoolYearId: number;
  enrolledAt: string;
  enrolledById: number;
  section: {
    id: number;
    name: string;
    advisingTeacher: {
      id: number;
      firstName: string;
      lastName: string;
    } | null;
  };
  enrolledBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface EmailLog {
  id: number;
  recipient: string;
  subject: string;
  trigger: string;
  status: string;
  applicantId: number | null;
  errorMessage: string | null;
  attemptedAt: string;
  sentAt: string | null;
}

export interface ChecklistData {
  id: number;
  applicantId: number;
  isPsaBirthCertPresented: boolean;
  isOriginalPsaBcCollected: boolean;
  isSf9Submitted: boolean;
  isSf10Requested: boolean;
  isGoodMoralPresented: boolean;
  isMedicalEvalSubmitted: boolean;
  isCertOfRecognitionPresented: boolean;
  isUndertakingSigned: boolean;
  isConfirmationSlipReceived: boolean;
  updatedAt: string;
  updatedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export type LearnerType =
  | "NEW_ENROLLEE"
  | "TRANSFEREE"
  | "RETURNING"
  | "CONTINUING"
  | "OSCYA"
  | "ALS";

export interface AuditLog {
  id: number;
  userId: number | null;
  actionType: string;
  description: string;
  subjectType: string | null;
  recordId: number | null;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export interface HealthRecord {
  id: number;
  applicantId: number;
  schoolYearId: number;
  assessmentPeriod: "BOSY" | "EOSY";
  assessmentDate: string;
  weightKg: number;
  heightCm: number;
  notes: string | null;
  recordedById: number;
  recordedBy?: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  schoolYear?: { id: number; yearLabel: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentStep {
  stepOrder: number;
  kind: string;
  label: string;
  description: string | null;
  isRequired: boolean;
  configDate: string | null;
  configTime: string | null;
  configVenue: string | null;
  configNotes: string | null;
  cutoffScore: number | null;
  assessmentId: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  score: number | null;
  result: string | null;
  notes: string | null;
  conductedAt: string | null;
  status: "PENDING" | "SCHEDULED" | "COMPLETED";
}

export interface ApplicantDetail {
  id: number;
  lrn: string | null;
  isPendingLrnCreation?: boolean;
  isProfileLocked?: boolean;
  profileLockedAt?: string | null;
  profileLockedById?: number | null;
  studentPhoto: string | null;
  psaBirthCertNumber: string | null;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: string;
  sex: string;
  placeOfBirth: string | null;
  religion: string | null;
  motherTongue: string | null;
  currentAddress: Address;
  permanentAddress: Address | null;
  motherName: ParentInfo;
  fatherName: ParentInfo;
  guardianInfo: GuardianInfo | null;
  primaryContact?: "MOTHER" | "FATHER" | "GUARDIAN" | null;
  emailAddress: string | null;
  isIpCommunity: boolean;
  ipGroupName: string | null;
  is4PsBeneficiary: boolean;
  householdId4Ps: string | null;
  isBalikAral: boolean;
  lastYearEnrolled: string | null;
  isLearnerWithDisability: boolean;
  disabilityTypes: string[];
  lastSchoolName: string | null;
  lastSchoolId: string | null;
  lastGradeCompleted: string | null;
  schoolYearLastAttended: string | null;
  lastSchoolAddress: string | null;
  lastSchoolType: string | null;
  learnerType: LearnerType;
  isScpApplication: boolean;
  scpType: string | null;
  artField: string | null;
  sportsList: string[];
  foreignLanguage: string | null;
  trackingNumber: string;
  status: string;
  rejectionReason: string | null;
  gradeLevelId: number;
  schoolYearId: number;
  applicantType: string;
  examDate: string | null;
  examVenue: string | null;
  examScore: number | null;
  examResult: string | null;
  examNotes: string | null;
  assessmentType: string | null;
  interviewDate: string | null;
  interviewResult: string | null;
  interviewNotes: string | null;
  auditionResult: string | null;
  tryoutResult: string | null;
  assessmentSteps: AssessmentStep[];
  natScore: number | null;
  grade10ScienceGrade: number | null;
  grade10MathGrade: number | null;
  createdAt: string;
  updatedAt: string;
  admissionChannel: string;
  encodedById: number | null;
  specialNeedsCategory: string | null;
  hasPwdId: boolean;
  learningModalities: string[];
  isTemporarilyEnrolled: boolean;
  gradeLevel: { id: number; name: string };
  schoolYear: { id: number; yearLabel: string };
  encodedBy: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  } | null;
  enrollment: EnrollmentDetail | null;
  documents?: {
    id: number;
    documentType: string;
    status: "SUBMITTED" | "VERIFIED" | "REJECTED" | "MISSING";
    fileName: string | null;
    originalName: string | null;
    mimeType: string | null;
    size: number | null;
    verificationNote: string | null;
    isPresentedOnly: boolean;
    uploadedAt: string;
    verifiedAt: string | null;
    uploadedBy?: {
      id: number;
      firstName: string;
      lastName: string;
      role: string;
    } | null;
  }[];
  checklist?: ChecklistData;
  emailLogs?: EmailLog[];
  auditLogs?: AuditLog[];
  healthRecords?: HealthRecord[];
}

export function useApplicationDetail(
  id: number | null,
  isDetailed: boolean = false,
  endpointBase: string = "/applications",
) {
  const [data, setData] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const endpoint = isDetailed
        ? `${endpointBase}/${id}/detailed`
        : `${endpointBase}/${id}`;
      const res = await api.get(endpoint);
      setData(res.data);
    } catch (err: unknown) {
      if (isAxiosError(err)) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load application detail",
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to load application detail");
      }
    } finally {
      setLoading(false);
    }
  }, [id, isDetailed, endpointBase]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail, mutate: setData };
}
