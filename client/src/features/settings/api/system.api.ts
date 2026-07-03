import api from "@/shared/api/axiosInstance";

export interface RolloverReadinessPayload {
  isEosyPhase: boolean;
  ready: boolean;
  schoolYearFinalized: boolean;
  blockers: Array<{
    gradeLevel: string;
    sectionName: string;
    unfinishedLearnerCount: number;
    reasons: string[];
  }>;
}

export async function getRolloverReadiness(): Promise<RolloverReadinessPayload> {
  const res = await api.get<RolloverReadinessPayload>("/system/rollover-readiness");
  return res.data;
}
