import api from "@/shared/api/axiosInstance";

export interface RolloverReadinessPayload {
  isEosyPhase: boolean;
  ready: boolean;
  schoolYearFinalized: boolean;
  blockers: Array<{
    sectionId: number;
    gradeLevel: string;
    sectionName: string;
    unfinishedLearnerCount: number;
    reasons: string[];
  }>;
  globalBlockers: Array<{
    code: string;
    message: string;
  }>;
  calendarPolicy: {
    id: number;
    yearLabel: string;
    version: number;
    status: string;
    depedIssuance: string;
  } | null;
  formStatus: {
    currentSf5Count: number;
    totalSections: number;
    sf6Recorded: boolean;
    sf6Current: boolean;
  };
}

export async function getRolloverReadiness(
  calendarPolicyId?: number,
): Promise<RolloverReadinessPayload> {
  const res = await api.get<RolloverReadinessPayload>(
    "/system/rollover-readiness",
    { params: { calendarPolicyId } },
  );
  return res.data;
}
