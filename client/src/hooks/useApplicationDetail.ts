import { useState, useEffect, useCallback } from "react";
import api from "@/api/axiosInstance";

export interface ApplicantDetail {
  id: number;
  lrn: string | null;
  psaBcNumber: string | null;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: string;
  sex: string;
  placeOfBirth: string | null;
  religion: string | null;
  motherTongue: string | null;
  currentAddress: any;
  permanentAddress: any;
  motherName: any;
  fatherName: any;
  guardianInfo: any;
  emailAddress: string | null;
  isIpCommunity: boolean;
  ipGroupName: string | null;
  is4PsBeneficiary: boolean;
  householdId4Ps: string | null;
  isBalikAral: boolean;
  lastYearEnrolled: string | null;
  isLearnerWithDisability: boolean;
  disabilityType: string[];
  lastSchoolName: string | null;
  lastSchoolId: string | null;
  lastGradeCompleted: string | null;
  syLastAttended: string | null;
  lastSchoolAddress: string | null;
  lastSchoolType: string | null;
  learnerType: string | null;
  electiveCluster: string | null;
  scpApplication: boolean;
  scpType: string | null;
  spaArtField: string | null;
  spsSports: string[];
  spflLanguage: string | null;
  trackingNumber: string;
  status: string;
  rejectionReason: string | null;
  gradeLevelId: number;
  strandId: number | null;
  academicYearId: number;
  applicantType: string;
  shsTrack: string | null;
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
  natScore: number | null;
  grade10ScienceGrade: number | null;
  grade10MathGrade: number | null;
  createdAt: string;
  updatedAt: string;
  admissionChannel: string;
  encodedById: number | null;
  snedCategory: string | null;
  hasPwdId: boolean;
  learningModalities: string[];
  gradeLevel: { id: number; name: string };
  strand: { id: number; name: string } | null;
  academicYear: { id: number; yearLabel: string };
  encodedBy: { id: number; name: string; role: string } | null;
  enrollment: any;
  emailLogs?: any[];
}

export function useApplicationDetail(id: number | null, isDetailed: boolean = false) {
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
      const endpoint = isDetailed ? `/applications/${id}/detailed` : `/applications/${id}`;
      const res = await api.get(endpoint);
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load application detail");
    } finally {
      setLoading(false);
    }
  }, [id, isDetailed]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail, mutate: setData };
}
