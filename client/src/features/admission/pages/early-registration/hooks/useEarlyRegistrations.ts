import { useState, useCallback, useEffect, useMemo } from "react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
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

interface UseEarlyRegistrationsParams {
  schoolYearId: number | null;
  initialStatus?: string;
  allowedStatusesInAllMode?: string[];
  statusSelectionOverrides?: Record<string, string[]>;
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

export function useEarlyRegistrations({
  schoolYearId,
  initialStatus = "ALL",
  allowedStatusesInAllMode,
  statusSelectionOverrides,
}: UseEarlyRegistrationsParams) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>(() =>
    createEmptyStageCounts(),
  );

  // Filters
  const { inputValue: search, setInputValue: setSearch, activeFilter: activeSearch, isSearching } = useDebouncedSearch();
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const ayId = schoolYearId;
  const allowedStatusesInAllModeSet = useMemo(
    () => new Set(allowedStatusesInAllMode ?? []),
    [allowedStatusesInAllMode],
  );

  const buildBaseCountParams = useCallback(() => {
    const params = new URLSearchParams();
    params.append("schoolYearId", String(ayId));
    if (activeSearch) params.append("search", activeSearch);
    if (type !== "ALL") params.append("applicantType", type);
    params.append("page", "1");
    params.append("limit", "1");
    return params;
  }, [ayId, activeSearch, type]);

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
          status: stage.value,
          total: Number(response?.data?.pagination?.total ?? 0),
        };
      });

      const additionalStatusesForCounts = Array.from(
        allowedStatusesInAllModeSet,
      ).filter(
        (statusValue) =>
          statusValue !== "WITHOUT_LRN" &&
          !REGISTRATION_STAGE_QUICK_FILTERS.some(
            (stage) => stage.value === statusValue,
          ),
      );

      const additionalCountPromises = additionalStatusesForCounts.map(
        async (statusValue) => {
          const params = new URLSearchParams(baseParams.toString());
          params.append("status", statusValue);

          const response = await api.get(
            `/early-registrations?${params.toString()}`,
          );

          return {
            key: statusValue,
            status: statusValue,
            total: Number(response?.data?.pagination?.total ?? 0),
          };
        },
      );

      const [allResponse, ...stageResponses] = await Promise.all([
        api.get(`/early-registrations?${baseParams.toString()}`),
        ...stageCountPromises,
        ...additionalCountPromises,
      ]);

      const nextCounts = createEmptyStageCounts();
      const countsByStatus: Record<string, number> = {};
      for (const entry of stageResponses) {
        countsByStatus[entry.status] = entry.total;

        if (entry.key in nextCounts) {
          nextCounts[entry.key] = entry.total;
        }
      }

      if (statusSelectionOverrides) {
        for (const [stageValue, mappedStatuses] of Object.entries(
          statusSelectionOverrides,
        )) {
          if (!(stageValue in nextCounts) || mappedStatuses.length === 0) {
            continue;
          }

          nextCounts[stageValue] = mappedStatuses.reduce(
            (sum, mappedStatus) => sum + (countsByStatus[mappedStatus] ?? 0),
            0,
          );
        }
      }

      const allTotal = Number(allResponse?.data?.pagination?.total ?? 0);

      if (allowedStatusesInAllModeSet.size > 0) {
        nextCounts.ALL = Array.from(allowedStatusesInAllModeSet).reduce(
          (sum, allowedStatus) => sum + (countsByStatus[allowedStatus] ?? 0),
          0,
        );
      } else {
        const excludedTotal = PHASE_TWO_MONITORING_EXCLUDED_STATUSES.reduce(
          (sum, excludedStatus) => sum + (nextCounts[excludedStatus] ?? 0),
          0,
        );
        nextCounts.ALL = Math.max(0, allTotal - excludedTotal);
      }

      setStageCounts(nextCounts);
    } catch (err) {
      toastApiError(err as never);
    }
  }, [
    ayId,
    buildBaseCountParams,
    allowedStatusesInAllModeSet,
    statusSelectionOverrides,
  ]);

  const fetchData = useCallback(async () => {
    if (!ayId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      if (activeSearch) params.append("search", activeSearch);

      const statusOverrideForSelection = statusSelectionOverrides?.[status] ?? [];
      const hasStatusOverride = statusOverrideForSelection.length > 0;

      const normalizedStatus =
        PHASE_TWO_MONITORING_EXCLUDED_STATUS_SET.has(status) || hasStatusOverride
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

      const scopedStatusesForAllMode =
        normalizedStatus === "ALL"
          ? hasStatusOverride
            ? statusOverrideForSelection
            : Array.from(allowedStatusesInAllModeSet)
          : [];

      const excludedCountPromises =
        normalizedStatus === "ALL" && scopedStatusesForAllMode.length === 0
          ? PHASE_TWO_MONITORING_EXCLUDED_STATUSES.map((excludedStatus) => {
              const excludedParams = new URLSearchParams();
              excludedParams.append("schoolYearId", String(ayId));
              if (activeSearch) excludedParams.append("search", activeSearch);
              if (type !== "ALL") excludedParams.append("applicantType", type);
              excludedParams.append("status", excludedStatus);
              excludedParams.append("page", "1");
              excludedParams.append("limit", "1");

              return api.get(
                `/early-registrations?${excludedParams.toString()}`,
              );
            })
          : [];

      const scopedCountPromises =
        normalizedStatus === "ALL" && scopedStatusesForAllMode.length > 0
          ? scopedStatusesForAllMode.map((scopedStatus) => {
              const scopedParams = new URLSearchParams();
              scopedParams.append("schoolYearId", String(ayId));
              if (activeSearch) scopedParams.append("search", activeSearch);
              if (type !== "ALL") scopedParams.append("applicantType", type);
              scopedParams.append("status", scopedStatus);
              scopedParams.append("page", "1");
              scopedParams.append("limit", "1");

              return api.get(
                `/early-registrations?${scopedParams.toString()}`,
              );
            })
          : [];

      const [res, ...countResponses] = await Promise.all([
        allStatusPromise,
        ...excludedCountPromises,
        ...scopedCountPromises,
      ]);

      const excludedResponses = countResponses.slice(0, excludedCountPromises.length);
      const scopedCountResponses = countResponses.slice(excludedCountPromises.length);

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

      if (normalizedStatus === "ALL") {
        if (hasStatusOverride) {
          const overrideSet = new Set(statusOverrideForSelection);
          filteredApps = filteredApps.filter((app) => overrideSet.has(app.status));
        } else if (allowedStatusesInAllModeSet.size > 0) {
          filteredApps = filteredApps.filter((app) =>
            allowedStatusesInAllModeSet.has(app.status),
          );
        }
      }

      const computedAllModeTotal =
        scopedStatusesForAllMode.length > 0
          ? scopedCountResponses.reduce(
              (sum, response) =>
                sum + Number(response?.data?.pagination?.total ?? 0),
              0,
            )
          : Math.max(
              0,
              Number(res.data?.pagination?.total ?? 0) -
                excludedResponses.reduce(
                  (sum, response) =>
                    sum + Number(response?.data?.pagination?.total ?? 0),
                  0,
                ),
            );

      setApplications(filteredApps);
      setTotal(
        normalizedStatus === "ALL"
          ? computedAllModeTotal
          : Number(res.data?.pagination?.total ?? 0),
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [
    ayId,
    activeSearch,
    status,
    type,
    page,
    allowedStatusesInAllModeSet,
    statusSelectionOverrides,
  ]);

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
    isSearching,
    status,
    setStatus,
    type,
    setType,
    page,
    setPage,
    limit,
    setLimit,
    stageCounts,
    refresh: fetchData,
  };
}
