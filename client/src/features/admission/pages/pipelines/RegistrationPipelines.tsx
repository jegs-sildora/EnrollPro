import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { motion } from "motion/react";
import { Skeleton } from "@/shared/ui/skeleton";
import { Badge } from "@/shared/ui/badge";
import { useScpConfigs } from "@/features/admission/hooks/useScpConfigs";
import api from "@/shared/api/axiosInstance";
import { SCP_ACRONYMS, SCP_LABELS } from "@/shared/lib/utils";
import PipelineBatchView from "@/features/admission/components/PipelineBatchView";
import { useSettingsStore } from "@/store/settings.slice";
import { ACTIVE_REGISTRATION_EXCLUDED_STATUSES } from "@/features/admission/constants/registrationWorkflow";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";

export default function RegistrationPipelines({
  onRegisterRefresh,
}: {
  onRegisterRefresh?: (fn: () => Promise<void>) => void;
}) {
  const { configs, loading: rawLoading, error } = useScpConfigs();
  const loading = useDelayedLoading(rawLoading);
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const [searchParams, setSearchParams] = useSearchParams();

  // Use "program" instead of "tab" to avoid collision with Workspace tabs
  const activeProgram = searchParams.get("program") || "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  const steConfig = configs.find(
    (config) => config.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
  );
  const spaConfig = configs.find(
    (config) => config.scpType === "SPECIAL_PROGRAM_IN_THE_ARTS",
  );
  const spsConfig = configs.find(
    (config) => config.scpType === "SPECIAL_PROGRAM_IN_SPORTS",
  );

  const tabs = useMemo(
    () => [
      {
        key: "SCIENCE_TECHNOLOGY_AND_ENGINEERING",
        label: SCP_ACRONYMS.SCIENCE_TECHNOLOGY_AND_ENGINEERING || "STE",
        fullLabel: SCP_LABELS.SCIENCE_TECHNOLOGY_AND_ENGINEERING || "Science, Technology & Engineering",
        cutoffScore:
          steConfig?.cutoffScore ??
          steConfig?.steps.find((s) => s.cutoffScore != null)?.cutoffScore ??
          null,
        hasAssessment: (steConfig?.steps?.length ?? 0) > 0,
      },
      {
        key: "SPECIAL_PROGRAM_IN_THE_ARTS",
        label: SCP_ACRONYMS.SPECIAL_PROGRAM_IN_THE_ARTS || "SPA",
        fullLabel: SCP_LABELS.SPECIAL_PROGRAM_IN_THE_ARTS || "Special Program in the Arts",
        cutoffScore:
          spaConfig?.cutoffScore ??
          spaConfig?.steps.find((s) => s.cutoffScore != null)?.cutoffScore ??
          null,
        hasAssessment: (spaConfig?.steps?.length ?? 0) > 0,
      },
      {
        key: "SPECIAL_PROGRAM_IN_SPORTS",
        label: SCP_ACRONYMS.SPECIAL_PROGRAM_IN_SPORTS || "SPS",
        fullLabel: SCP_LABELS.SPECIAL_PROGRAM_IN_SPORTS || "Special Program in Sports",
        cutoffScore:
          spsConfig?.cutoffScore ??
          spsConfig?.steps.find((s) => s.cutoffScore != null)?.cutoffScore ??
          null,
        hasAssessment: (spsConfig?.steps?.length ?? 0) > 0,
      },
    ],
    [spaConfig, spsConfig, steConfig],
  );

  const fetchCount = useCallback(
    async (applicantType: string, status: string = "ALL") => {
      if (!ayId) return 0;
      const params = new URLSearchParams();
      if (status !== "ALL") params.append("status", status);
      params.append("page", "1");
      params.append("limit", "1");
      params.append("applicantType", applicantType);
      params.append("schoolYearId", String(ayId));

      const res = await api.get(`/early-registrations?${params.toString()}`);
      return Number(res.data?.pagination?.total ?? 0);
    },
    [ayId],
  );

  const fetchActiveCount = useCallback(
    async (applicantType: string) => {
      const PIPELINE_EXCLUDED = [
        ...ACTIVE_REGISTRATION_EXCLUDED_STATUSES,
        "READY_FOR_ENROLLMENT",
      ] as const;
      const [allCount, ...excludedCounts] = await Promise.all([
        fetchCount(applicantType),
        ...PIPELINE_EXCLUDED.map((status) =>
          fetchCount(applicantType, status),
        ),
      ]);

      return Math.max(
        0,
        allCount - excludedCounts.reduce((sum, count) => sum + count, 0),
      );
    },
    [fetchCount],
  );

  const refreshTabCounts = useCallback(async () => {
    try {
      const countEntries = await Promise.all(
        tabs.map(async (tab) => {
          const activeCount = await fetchActiveCount(tab.key);

          return [tab.key, activeCount] as const;
        }),
      );

      const nextCounts = Object.fromEntries(countEntries);
      setTabCounts((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextCounts);

        if (prevKeys.length !== nextKeys.length) {
          return nextCounts;
        }

        for (const key of nextKeys) {
          if (prev[key] !== nextCounts[key]) {
            return nextCounts;
          }
        }

        return prev;
      });
    } catch {
      setTabCounts((prev) => (Object.keys(prev).length > 0 ? {} : prev));
    }
  }, [fetchActiveCount, tabs]);

  const handleProgramChange = (value: string) => {
    setSearchParams(
      (previousParams) => {
        const nextParams = new URLSearchParams(previousParams);
        nextParams.set("program", value);
        return nextParams;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeProgram)) {
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);
          nextParams.set("program", "SCIENCE_TECHNOLOGY_AND_ENGINEERING");
          return nextParams;
        },
        { replace: true },
      );
    }
  }, [activeProgram, tabs, setSearchParams]);

  useEffect(() => {
    onRegisterRefresh?.(refreshTabCounts);
  }, [onRegisterRefresh, refreshTabCounts]);

  useEffect(() => {
    const run = async () => {
      await refreshTabCounts();
    };

    void run();
  }, [refreshTabCounts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-32"
            />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={activeProgram}
        onValueChange={handleProgramChange}
        className="w-full">
        <div className="mb-6 w-full pb-1">
          <TabsList
            className="grid w-full h-auto gap-1 p-1 bg-white border border-border relative"
            style={{
              gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
            }}>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                title={tab.fullLabel}
                className="w-full min-w-0 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                {activeProgram === tab.key && (
                  <motion.div
                    layoutId="pipeline-active-pill"
                    className="absolute inset-0 bg-primary rounded-md"
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.5,
                    }}
                  />
                )}
                <span className="relative z-20 inline-flex w-full items-center justify-center gap-2">
                  {tab.label}
                  <Badge
                    variant={activeProgram === tab.key ? "secondary" : "outline"}
                    className="h-5 px-1.5 text-xs font-bold">
                    {tabCounts[tab.key] ?? 0}
                  </Badge>
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.key}
            value={tab.key}
            forceMount
            className="mt-0 focus-visible:outline-none ring-0 data-[state=inactive]:hidden">
            <PipelineBatchView
              applicantType={tab.key}
              cutoffScore={tab.cutoffScore}
              hasAssessment={tab.hasAssessment}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
