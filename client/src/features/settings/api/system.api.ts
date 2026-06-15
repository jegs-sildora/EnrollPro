import api from "@/shared/api/axiosInstance";

export interface RolloverReadinessPayload {
  isEosyPhase: boolean;
  blockers: string[];
}

export async function getRolloverReadiness(): Promise<RolloverReadinessPayload> {
  const res = await api.get<RolloverReadinessPayload>("/system/rollover-readiness");
  return res.data;
}
