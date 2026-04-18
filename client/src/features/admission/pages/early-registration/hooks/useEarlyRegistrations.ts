import { useState, useCallback, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import {
  ACTIVE_REGISTRATION_EXCLUDED_STATUSES,
  REGISTRATION_STAGE_QUICK_FILTERS,
} from "@/features/admission/constants/registrationWorkflow";

const PHASE_TWO_MONITORING_EXCLUDED_STATUSES = [
  ...ACTIVE_REGISTRATION_EXCLUDED_STATUSES,
  "TEMPORARILY_ENROLLED",
] as const;

const PHASE_TWO_MONITORING_EXCLUDED_STATUS_SET = new Set<string>(
  PHASE_TWO_MONITORING_EXCLUDED_STATUSES,
);

export interface Application {
  id: number;
  lrn: string;
  isPendingLrnCreation: boolean;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  createdAt: string;
}

interface EarlyRegistrationApiRow {
  id: number;
  lrn?: string;
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  suffix?: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  createdAt: string;
  learner?: {
    firstName?: string;
    lastName?: string;
    middleName?: string | null;
    extensionName?: string | null;
    lrn?: string;
    isPendingLrnCreation?: boolean;
  };
}

const createEmptyStageCounts = () =>
  REGISTRATION_STAGE_QUICK_FILTERS.reduce<Record<string, number>>(
    (acc, stage) => {
      acc[stage.value] = 0;
      return acc;
    },
    {},
  );

function normalizeLrnValue(value: string | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";

  const upper = normalized.toUpperCase();
  if (
    upper === "N/A" ||
    upper === "NA" ||
    upper === "NONE" ||
    upper === "NULL" ||
    upper === "-"
  ) {
    return "";
  }

  return normalized;
}

export function useEarlyRegistrations(ayId: number | null) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>(() =>
    createEmptyStageCounts(),
  );

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);

  const buildBaseCountParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append("schoolYearId", String(ayId));
    if (search) params.append("search", search);
    if (type !== "ALL") params.append("applicantType", type);
    params.append("page", "1");
    params.append("limit", "1");
    return params;
  }, [ayId, search, type]);

  const fetchStageCounts = useCallback(async () => {
    if (!ayId) {
      setStageCounts(createEmptyStageCounts());
      return;
    }

    try {
      const baseParams = buildBaseCountParams();

      const stageCountPromises = REGISTRATION_STAGE_QUICK_FILTERS.filter(
        (stage) => stage.value !== "ALL",
      ).map(async (stage) => {
        const params = new URLSearchParams(baseParams.toString());

        if (stage.value === "WITHOUT_LRN") {
          params.append("withoutLrn", "true");
        } else {
          params.append("status", stage.value);
        }

        const response = await api.get(
          `/early-registrations?${params.toString()}`,
        );
        return {
          key: stage.value,
          total: Number(response?.data?.pagination?.total ?? 0),
        };
      });

      const [allResponse, ...stageResponses] = await Promise.all([
        api.get(`/early-registrations?${baseParams.toString()}`),
        ...stageCountPromises,
      ]);

      const nextCounts = createEmptyStageCounts();
      for (const entry of stageResponses) {
        nextCounts[entry.key] = entry.total;
      }

      const allTotal = Number(allResponse?.data?.pagination?.total ?? 0);
      const excludedTotal = PHASE_TWO_MONITORING_EXCLUDED_STATUSES.reduce(
        (sum, excludedStatus) => sum + (nextCounts[excludedStatus] ?? 0),
        0,
      );
      nextCounts.ALL = Math.max(0, allTotal - excludedTotal);

      setStageCounts(nextCounts);
    } catch (err) {
      toastApiError(err as never);
    }
  }, [ayId, buildBaseCountParams]);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      if (search) params.append("search", search);

      const normalizedStatus = PHASE_TWO_MONITORING_EXCLUDED_STATUS_SET.has(
        status,
      )
        ? "ALL"
        : status;

      if (normalizedStatus === "WITHOUT_LRN") {
        params.append("withoutLrn", "true");
      } else if (normalizedStatus !== "ALL") {
        params.append("status", normalizedStatus);
      }

      if (type !== "ALL") params.append("applicantType", type);
      params.append("page", String(page));
      params.append("limit", "50");

      const allStatusPromise = api.get(
        `/early-registrations?${params.toString()}`,
      );

      const excludedCountPromises =
        normalizedStatus === "ALL"
          ? PHASE_TWO_MONITORING_EXCLUDED_STATUSES.map((excludedStatus) => {
              const excludedParams = new URLSearchParams();
              excludedParams.append("schoolYearId", String(ayId));
              if (search) excludedParams.append("search", search);
              if (type !== "ALL") excludedParams.append("applicantType", type);
              excludedParams.append("status", excludedStatus);
              excludedParams.append("page", "1");
              excludedParams.append("limit", "1");

              return api.get(
                `/early-registrations?${excludedParams.toString()}`,
              );
            })
          : [];

      const [res, ...excludedResponses] = await Promise.all([
        allStatusPromise,
        ...excludedCountPromises,
      ]);

      let filteredApps = (res.data.data as EarlyRegistrationApiRow[]).map(
        (app): Application => {
          const learnerLrn = normalizeLrnValue(app.learner?.lrn);
          const fallbackLrn = normalizeLrnValue(app.lrn);
          const normalizedLrn = learnerLrn || fallbackLrn;
          const pendingFromRecord = Boolean(app.learner?.isPendingLrnCreation);

          return {
            ...app,
            firstName: app.learner?.firstName || app.firstName || "",
            lastName: app.learner?.lastName || app.lastName || "",
            middleName: app.learner?.middleName || app.middleName || null,
            suffix: app.learner?.extensionName || app.suffix || null,
            lrn: normalizedLrn,
            isPendingLrnCreation:
              pendingFromRecord ||
              (normalizedStatus === "WITHOUT_LRN" && !normalizedLrn),
          };
        },
      );

      filteredApps = filteredApps.filter(
        (app) => !PHASE_TWO_MONITORING_EXCLUDED_STATUS_SET.has(app.status),
      );

      const excludedTotals =
        normalizedStatus === "ALL"
          ? excludedResponses.reduce(
              (sum, response) =>
                sum + Number(response?.data?.pagination?.total ?? 0),
              0,
            )
          : 0;

      setApplications(filteredApps);
      setTotal(
        normalizedStatus === "ALL"
          ? Math.max(
              0,
              Number(res.data?.pagination?.total ?? 0) - excludedTotals,
            )
          : Number(res.data?.pagination?.total ?? 0),
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [ayId, search, status, type, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStageCounts();
  }, [fetchStageCounts]);

  return {
    applications,
    total,
    loading,
    search,
    setSearch,
    status,
    setStatus,
    type,
    setType,
    page,
    setPage,
    stageCounts,
    fetchData,
  };
}
