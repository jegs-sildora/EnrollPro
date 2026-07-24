import api from "@/shared/api/axiosInstance";
import type {
  BOSYReadiness,
  BOSYQueuePage,
  BulkConfirmResult,
  BOSYQueueState,
  ConfirmReturnResult,
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
  targetGradeOrder?: number;
  queueState?: BOSYQueueState;
  status?: string;
  search?: string;
  previousSectionName?: string;
  curricularProgram?: string;
}

export async function getBOSYQueue(
  params: BOSYQueueParams,
): Promise<BOSYQueuePage> {
  const res = await api.get<BOSYQueuePage>(`/bosy/queue`, { params });
  return res.data;
}

export async function getPreviousSections(
  schoolYearId: number,
): Promise<string[]> {
  const res = await api.get<string[]>(`/bosy/previous-sections`, {
    params: { schoolYearId },
  });
  return res.data;
}

export async function confirmReturn(
  applicationId: number,
): Promise<ConfirmReturnResult> {
  const res = await api.post<ConfirmReturnResult>(
    `/bosy/confirm-return/${applicationId}`,
    {},
  );
  return res.data;
}

export async function markTransferRequest(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/transfer-request/${applicationId}`,
    {},
  );
  return res.data;
}

export async function revokeConfirmedReturn(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/revoke-confirmation/${applicationId}`,
    {},
  );
  return res.data;
}

export async function markConfirmedTransferOut(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/confirmed-transfer-out/${applicationId}`,
    {},
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

export async function syncBOSYQueue(
  schoolYearId: number,
): Promise<{ created: number; remedialHolds: number }> {
  const res = await api.post<{ created: number; remedialHolds: number }>(`/bosy/sync`, {
    schoolYearId,
  });
  return res.data;
}
