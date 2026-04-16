import { useState, useCallback, useEffect } from "react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";

export interface Application {
  id: number;
  lrn: string;
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

export function useEarlyRegistrations(ayId: number | null) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [page, setPage] = useState(1);

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

      if (status !== "ALL") {
        params.append("status", status);
      }

      if (type !== "ALL") params.append("applicantType", type);
      params.append("page", String(page));
      params.append("limit", "50");

      const res = await api.get(`/early-registrations?${params.toString()}`);

      let filteredApps = res.data.data.map((app: any) => ({
        ...app,
        firstName: app.learner?.firstName || app.firstName,
        lastName: app.learner?.lastName || app.lastName,
        middleName: app.learner?.middleName || app.middleName,
        suffix: app.learner?.extensionName || app.suffix,
        lrn: app.learner?.lrn || app.lrn,
      }));

      if (status === "ALL") {
        filteredApps = filteredApps.filter(
          (app: Application) =>
            !["ENROLLED", "PRE_REGISTERED", "TEMPORARILY_ENROLLED"].includes(
              app.status,
            ),
        );
      }

      setApplications(filteredApps);
      setTotal(
        status === "ALL"
          ? res.data.pagination.total -
              (res.data.data.length - filteredApps.length)
          : res.data.pagination.total,
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
    fetchData,
  };
}
