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

export default function RegistrationPipelines() {
  const { configs, loading, error } = useScpConfigs();
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "REGULAR";
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  const tabs = useMemo(
    () => [
      {
        key: "REGULAR",
        label: "Regular",
        fullLabel: SCP_LABELS.REGULAR ?? "Regular",
        cutoffScore: null as number | null,
        hasAssessment: false,
      },
      ...configs.map((c) => ({
        key: c.scpType,
        label: SCP_ACRONYMS[c.scpType] || c.scpType,
        fullLabel: SCP_LABELS[c.scpType] || c.scpType,
        cutoffScore:
          c.cutoffScore ??
          c.steps.find((s) => s.cutoffScore != null)?.cutoffScore ??
          null,
        hasAssessment: c.steps.length > 0,
      })),
    ],
    [configs],
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
      const [allCount, ...excludedCounts] = await Promise.all([
        fetchCount(applicantType),
        ...ACTIVE_REGISTRATION_EXCLUDED_STATUSES.map((status) =>
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

  const handleTabChange = (value: string) => {
    setSearchParams(
      (previousParams) => {
        const nextParams = new URLSearchParams(previousParams);
        nextParams.set("tab", value);
        return nextParams;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);
          nextParams.set("tab", "REGULAR");
          return nextParams;
        },
        { replace: true },
      );
    }
  }, [activeTab, tabs, setSearchParams]);

  useEffect(() => {
    const run = async () => {
      await refreshTabCounts();
    };

    void run();
  }, [refreshTabCounts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Registration Pipelines
          </h1>
          <p className="text-sm font-bold">
            Batch-process applicants by curriculum program
          </p>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Registration Pipelines
          </h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Registration Pipelines
        </h1>
        <p className="text-sm font-bold">
          Batch-process applicants by curriculum program
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
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
                {activeTab === tab.key && (
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
                    variant={activeTab === tab.key ? "secondary" : "outline"}
                    className="h-5 px-1.5 text-[10px] font-bold">
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
