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

const EXCLUDED_ACTIVE_STATUSES = [
  "ENROLLED",
  "PRE_REGISTERED",
  "TEMPORARILY_ENROLLED",
];

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
    async (applicantType: string, status: string) => {
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

  const refreshTabCounts = useCallback(async () => {
    try {
      const countEntries = await Promise.all(
        tabs.map(async (tab) => {
          const [allCount, ...excludedCounts] = await Promise.all([
            fetchCount(tab.key, "ALL"),
            ...EXCLUDED_ACTIVE_STATUSES.map((status) =>
              fetchCount(tab.key, status),
            ),
          ]);

          const activeCount = Math.max(
            0,
            allCount - excludedCounts.reduce((sum, n) => sum + n, 0),
          );

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
  }, [fetchCount, tabs]);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setSearchParams({ tab: "REGULAR" }, { replace: true });
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
        <div className="mb-6 overflow-x-auto pb-1">
          <TabsList className="inline-flex min-w-max h-auto gap-1 p-1 bg-white border border-border relative">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                title={tab.fullLabel}
                className="shrink-0 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
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
                <span className="relative z-20 inline-flex items-center gap-2">
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
