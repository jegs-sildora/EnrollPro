import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import EarlyRegistrationList from "./EarlyRegistrationList";
import RegistrationPipelines from "../pipelines/RegistrationPipelines";
import { motion } from "motion/react";

type WorkspaceView = "pending" | "screening" | "qualified";

const VIEW_QUERY_KEY = "tab";
const DEFAULT_VIEW: WorkspaceView = "pending";

function normalizeView(raw: string | null): WorkspaceView {
  if (raw === "screening") return "screening";
  if (raw === "qualified") return "qualified";
  return "pending";
}

export default function EarlyRegistrationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();

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

  return (
    <div className="flex flex-col space-y-6">
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
          <EarlyRegistrationList initialStatus="SUBMITTED_BEEF" />
        )}
        {activeView === "screening" && (
          <RegistrationPipelines />
        )}
        {activeView === "qualified" && (
          <EarlyRegistrationList initialStatus="READY_FOR_ENROLLMENT" />
        )}
      </div>
    </div>
  );
}
