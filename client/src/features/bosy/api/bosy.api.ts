import api from "@/shared/api/axiosInstance";
import type {
  BOSYReadiness,
  BOSYQueuePage,
  BulkConfirmResult,
  JHSCompleterPage,
  TLEProgram,
  Phase2QueuePage,
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
  previousSectionName?: string;
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
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/confirm-return/${applicationId}`,
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

export async function getTLEPrograms(
  schoolYearId: number,
): Promise<TLEProgram[]> {
  const res = await api.get<{ programs: TLEProgram[] }>(`/bosy/tle-programs`, {
    params: { schoolYearId },
  });
  return res.data.programs;
}

export async function syncBOSYQueue(
  schoolYearId: number,
): Promise<{ created: number }> {
  const res = await api.post<{ created: number }>(`/bosy/sync`, {
    schoolYearId,
  });
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

export interface Phase2QueueParams {
  schoolYearId: number;
  status?: string | string[];
  admissionChannel?: "ONLINE" | "F2F";
  page?: number;
  limit?: number;
  search?: string;
}

export async function getPhase2Queue(
  params: Phase2QueueParams,
): Promise<Phase2QueuePage> {
  const res = await api.get<Phase2QueuePage>(`/bosy/phase2-queue`, { params });
  return res.data;
}

export async function apiConfirmScpSlot(
  applicationId: number,
  pendingDocs = false,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/confirm-scp-slot/${applicationId}`,
    { pendingDocs },
  );
  return res.data;
}

export async function apiVerifyBeef(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/verify-beef/${applicationId}`,
    {},
  );
  return res.data;
}

export async function apiRouteToScpScreening(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/route-to-scp/${applicationId}`,
    {},
  );
  return res.data;
}

export async function apiMarkBeefPending(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/mark-pending/${applicationId}`,
    {},
  );
  return res.data;
}

export async function apiResolveBeef(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/resolve-beef/${applicationId}`,
    {},
  );
  return res.data;
}

export async function apiRevertToPendingBeef(
  applicationId: number,
  reason: string,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/revert-to-pending/${applicationId}`,
    { reason },
  );
  return res.data;
}

export async function apiDowngradeToBeef(
  applicationId: number,
): Promise<{ applicationId: number; status: string }> {
  const res = await api.post<{ applicationId: number; status: string }>(
    `/bosy/downgrade-to-beef/${applicationId}`,
    {},
  );
  return res.data;
}

export async function apiFlushNoShows(
  applicationIds: number[],
  reason: string,
): Promise<{ flushed: number; skipped: number }> {
  const res = await api.post<{ flushed: number; skipped: number }>(
    `/bosy/flush-no-shows`,
    { applicationIds, reason },
  );
  return res.data;
}
