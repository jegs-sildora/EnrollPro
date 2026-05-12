import api from "@/shared/api/axiosInstance";
import type {
  BOSYReadiness,
  BOSYQueuePage,
  BulkConfirmResult,
  JHSCompleterPage,
} from "../types";

export async function getBOSYReadiness(
  schoolYearId: number,
): Promise<BOSYReadiness> {
  const res = await api.get<BOSYReadiness>(`/bosy/readiness`, {
    params: { schoolYearId },
  });
  return res.data;
}

export interface BOSYQueueParams {
  schoolYearId: number;
  page?: number;
  limit?: number;
  gradeLevelId?: number;
  status?: string;
  search?: string;
}

export async function getBOSYQueue(
  params: BOSYQueueParams,
): Promise<BOSYQueuePage> {
  const res = await api.get<BOSYQueuePage>(`/bosy/queue`, { params });
  return res.data;
}

export async function confirmReturn(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/confirm-return/${applicationId}`,
  );
  return res.data;
}

export async function bulkConfirm(body: {
  applicationIds: number[];
  schoolYearId: number;
}): Promise<BulkConfirmResult> {
  const res = await api.post<BulkConfirmResult>(`/bosy/bulk-confirm`, body);
  return res.data;
}

export async function syncBOSYQueue(schoolYearId: number): Promise<{ created: number }> {
  const res = await api.post<{ created: number }>(`/bosy/sync`, { schoolYearId });
  return res.data;
}

export interface JHSCompleterParams {
  schoolYearId: number;
  page?: number;
  limit?: number;
  search?: string;
}

export async function getJHSCompleters(
  params: JHSCompleterParams,
): Promise<JHSCompleterPage> {
  const res = await api.get<JHSCompleterPage>(`/bosy/completers`, { params });
  return res.data;
}
