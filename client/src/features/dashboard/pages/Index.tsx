import { useEffect, useState } from "react";
import api from "@/shared/api/axiosInstance";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { PageLoadingSkeleton } from "@/shared/components/PageLoadingSkeleton";
import { useHeaderStore } from "@/store/header.slice";
import type { DashboardStats } from "../types";

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

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [ayId]);

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
