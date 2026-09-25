import { useQuery } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useEffect, useState } from "react";
import { MOCKED_SYSTEM_DATE_KEY } from "@/shared/lib/utils";

export function useActiveTerm() {
  const { activeSchoolYearId } = useSettingsStore();
  const [nonce, setNonce] = useState(0);
  const isTimeMachineActive = typeof window !== "undefined"
    && Boolean(localStorage.getItem(MOCKED_SYSTEM_DATE_KEY));

  // Still support manual refetch event for components that need it
  useEffect(() => {
    const handler = () => setNonce((n) => n + 1);
    window.addEventListener("refetch-active-term", handler);
    return () => window.removeEventListener("refetch-active-term", handler);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["activeTerm", activeSchoolYearId, nonce],
    queryFn: async () => {
      const res = await api.get(`/school-years/active-term?schoolYearId=${activeSchoolYearId}`);
      return res.data;
    },
    enabled: !!activeSchoolYearId,
    retry: false,
    staleTime: isTimeMachineActive ? 0 : 60 * 1000,
    refetchInterval: isTimeMachineActive ? 1000 : false,
  });

  return {
    activeTerm: data?.activeTerm || (activeSchoolYearId ? "T1" : null),
    activeTermLabel: data?.activeTermLabel || (activeSchoolYearId ? "Term 1" : null),
    isGradingLocked: data?.isGradingLocked ?? false,
    isLoading: isLoading && !!activeSchoolYearId,
  };
}
