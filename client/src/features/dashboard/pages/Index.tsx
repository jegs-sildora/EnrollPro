import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import api from "@/shared/api/axiosInstance";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { useHeaderStore } from "@/store/header.slice";
import type { DashboardStats } from "../types";
import {
  REALTIME_INVALIDATION_EVENT,
  type RealtimeInvalidationEvent,
} from "@/shared/hooks/useRealtimeInvalidations";

import { PhaseOfficial } from "./PhaseOfficial";
import { PhaseOngoing } from "./PhaseOngoing";
import { PhaseEOSY } from "./PhaseEOSY";
import {
  DashboardActionToolbar,
  DashboardSummaryRibbon,
} from "../components/DashboardCommandCenter";

interface DashboardStatsResponse {
  stats: DashboardStats;
}

function DashboardPhaseBanner({
  phase,
  isArchived,
  ayLabel,
}: {
  phase: string;
  isArchived: boolean;
  ayLabel: string | null;
}) {
  if (isArchived) {
    return (
      <div className="rounded-md border border-slate-200 bg-card px-4 py-3 shadow-sm">
        <p className="text-lg font-bold text-foreground">
          Archived School Year Summary
        </p>
        <p className="text-base font-bold text-foreground">
          Final records for S.Y. {ayLabel}. Changes are not allowed for an archived school year.
        </p>
      </div>
    );
  }

  if (phase === "ENROLLMENT_OPERATIONS") {
    return (
      <div className="bg-card">
        <div className="rounded-md border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
          <p className="text-lg font-bold text-primary">
            Enrollment Operations for S.Y. {ayLabel}
          </p>
          <p className="text-base font-semibold text-foreground">
            Process learner applications, verify school requirements, and complete section assignment.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "EOSY_CLOSING") {
    return (
      <div className="rounded-md border border-slate-300 bg-slate-50 px-4 py-3 shadow-sm">
        <p className="text-lg font-bold text-foreground">
          EOSY Closing for S.Y. {ayLabel}
        </p>
        <p className="text-base  text-foreground">
          Enrollment is locked while final grades, promotion outcomes, and official school forms are completed.
        </p>
      </div>
    );
  }

  return null;
}

export default function DashboardIndex() {
  const { ayId, viewingStatus, ayLabel } = useSchoolYearContext();
  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Dashboard");
    return () => setTitle(null);
  }, [setTitle]);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!ayId) return;
    try {
      setLoading(true);
      const res = await api.get<DashboardStatsResponse>("/dashboard/stats");
      setStats(res.data.stats);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const handleRealtimeInvalidation = (event: Event) => {
      const payload = (event as CustomEvent<RealtimeInvalidationEvent>).detail;
      if (!payload?.topics) return;
      if (payload.schoolYearId && ayId && payload.schoolYearId !== ayId) return;

      const shouldRefresh = payload.topics.some((topic) =>
        ["dashboard:summary", "settings:public"].includes(topic),
      );

      if (shouldRefresh) {
        void loadStats();
      }
    };

    window.addEventListener(
      REALTIME_INVALIDATION_EVENT,
      handleRealtimeInvalidation,
    );

    return () => {
      window.removeEventListener(
        REALTIME_INVALIDATION_EVENT,
        handleRealtimeInvalidation,
      );
    };
  }, [ayId, loadStats]);

  if (loading || !stats) {
    return <PageLoadingSkeleton />;
  }

  const phase = stats.systemPhase;
  const isArchived = stats.isArchived || viewingStatus === "ARCHIVED";
  const dashboardPhase = phase === "EOSY_CLOSING"
    ? "EOSY_CLOSING"
    : phase === "CLASSES_ONGOING"
      ? "CLASSES_ONGOING"
      : "ENROLLMENT_OPERATIONS";

  let content;

  if (isArchived) {
    content = <PhaseOfficial stats={stats} />;
  } else if (phase === "OFFICIAL_ENROLLMENT") {
    content = <PhaseOfficial stats={stats} />;
  } else if (phase === "EOSY_CLOSING") {
    content = <PhaseEOSY stats={stats} />;
  } else {
    content = <PhaseOngoing stats={stats} />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="flex min-h-0 min-w-0 w-full flex-1 flex-col gap-4 pb-6"
      >
        <DashboardPhaseBanner
          phase={dashboardPhase}
          isArchived={isArchived}
          ayLabel={ayLabel}
        />
        <DashboardActionToolbar
          phase={dashboardPhase}
          isArchived={isArchived}
        />
        <DashboardSummaryRibbon summary={stats.summaryRibbon} />
        <div className="min-w-0 flex-1">{content}</div>
      </motion.div>
    </AnimatePresence>
  );
}
