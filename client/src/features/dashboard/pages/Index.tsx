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

interface DashboardStatsResponse {
  stats: DashboardStats
}

export default function DashboardIndex() {
  const { ayId, viewingStatus } = useSchoolYearContext();
  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Master Dashboard");
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

  const phase = stats?.systemPhase;

  if (stats.isArchived || viewingStatus === "ARCHIVED") {
    return <PhaseOfficial stats={stats} />;
  }

  if (phase === "OFFICIAL_ENROLLMENT") {
    return <PhaseOfficial stats={stats} />;
  }
  
  if (phase === "EOSY_CLOSING") {
    return <PhaseEOSY stats={stats} />;
  }

  // Fallback / Default for CLASSES_ONGOING and any other phases like PRE_REGISTRATION
  return <PhaseOngoing stats={stats} />;
}
