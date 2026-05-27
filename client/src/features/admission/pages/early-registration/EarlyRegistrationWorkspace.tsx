import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RefreshCw, UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Button } from "@/shared/ui/button";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import EarlyRegistrationList from "./EarlyRegistrationList";
import RegistrationPipelines from "../pipelines/RegistrationPipelines";
import { motion } from "motion/react";

type WorkspaceView = "pending" | "screening" | "qualified";

const VIEW_QUERY_KEY = "tab";
const DEFAULT_VIEW: WorkspaceView = "pending";

const PENDING_ALLOWED_STATUSES_IN_ALL_MODE = [
  "SUBMITTED_BEEF",
  "SUBMITTED_BEERF",
];

const PENDING_ALLOWED_STAGE_VALUES = ["ALL", "SUBMITTED_BEERF"];

const PENDING_STATUS_SELECTION_OVERRIDES: Record<string, string[]> = {
  SUBMITTED_BEERF: ["SUBMITTED_BEEF", "SUBMITTED_BEERF"],
};

const QUALIFIED_ALLOWED_STATUSES_IN_ALL_MODE = ["READY_FOR_ENROLLMENT"];

const QUALIFIED_ALLOWED_STAGE_VALUES = ["ALL", "READY_FOR_ENROLLMENT"];

function normalizeView(raw: string | null): WorkspaceView {
  if (raw === "screening") return "screening";
  if (raw === "qualified") return "qualified";
  return "pending";
}

export default function EarlyRegistrationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const refreshFnRef = useRef<(() => Promise<void>) | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate = !isHistoricalReadOnly || hasOverride;

  const activeView = useMemo<WorkspaceView>(
    () => normalizeView(searchParams.get(VIEW_QUERY_KEY)),
    [searchParams],
  );

  const handleViewChange = (nextView: string) => {
    const normalizedNextView = normalizeView(nextView);

    setSearchParams(
      (previousParams) => {
        const nextParams = new URLSearchParams(previousParams);

        if (normalizedNextView === DEFAULT_VIEW) {
          nextParams.delete(VIEW_QUERY_KEY);
        } else {
          nextParams.set(VIEW_QUERY_KEY, normalizedNextView);
        }

        return nextParams;
      },
      { replace: true },
    );
  };

  const tabs = [
    {
      key: "pending",
      label: "Pending BEERF Verification",
    },
    {
      key: "screening",
      label: "SCP Screening & Assessment",
    },
    {
      key: "qualified",
      label: "Qualified for Enrollment",
    },
  ];

  const registerActiveViewRefresh = (refreshFn: () => Promise<void>) => {
    refreshFnRef.current = refreshFn;
  };

  const handleRefresh = async () => {
    if (!refreshFnRef.current) {
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshFnRef.current();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Early Registration</h1>
          <p className="text-xs text-foreground font-bold">New Learner Intake &amp; Screening Workflow</p>
        </div>

        <div className="flex w-full md:w-auto gap-2">
          {canMutate && (
            <Button
              asChild
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold bg-primary hover:bg-primary/90">
              <Link to="/monitoring/f2f-early-registration">
                <UserPlus className="h-4 w-4 mr-2" />+ Walk-In BEERF
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing || !refreshFnRef.current}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={handleViewChange} className="w-full">
        <TabsList className="grid w-full h-auto grid-cols-3 gap-1 p-1 bg-white border border-border relative">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              {activeView === tab.key && (
                <motion.div
                  layoutId="early-reg-active-pill"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-20 text-xs sm:text-sm">
                {tab.label}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-2">
        {activeView === "pending" && (
          <EarlyRegistrationList
            key="pending-beerf"
            initialStatus="ALL"
            allowedStatusesInAllMode={PENDING_ALLOWED_STATUSES_IN_ALL_MODE}
            allowedStageValues={PENDING_ALLOWED_STAGE_VALUES}
            statusSelectionOverrides={PENDING_STATUS_SELECTION_OVERRIDES}
            onRegisterRefresh={registerActiveViewRefresh}
          />
        )}
        {activeView === "screening" && (
          <RegistrationPipelines onRegisterRefresh={registerActiveViewRefresh} />
        )}
        {activeView === "qualified" && (
          <EarlyRegistrationList
            key="qualified-enrollment"
            initialStatus="READY_FOR_ENROLLMENT"
            allowedStatusesInAllMode={QUALIFIED_ALLOWED_STATUSES_IN_ALL_MODE}
            allowedStageValues={QUALIFIED_ALLOWED_STAGE_VALUES}
            onRegisterRefresh={registerActiveViewRefresh}
          />
        )}
      </div>
    </div>
  );
}
