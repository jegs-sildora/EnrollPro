import { useEffect, useState } from "react";
import api from "@/shared/api/axiosInstance";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { Skeleton } from "@/shared/ui/skeleton";
import type { DashboardStats } from "../types";

import { PhaseOfficial } from "./PhaseOfficial";
import { PhaseOngoing } from "./PhaseOngoing";
import { PhaseEOSY } from "./PhaseEOSY";

export default function DashboardIndex() {
  const { ayId } = useSchoolYearContext();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!ayId) return;
      try {
        setLoading(true);
        const res = await api.get("/dashboard/stats");
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
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Skeleton className="h-[400px] lg:col-span-3" />
          <Skeleton className="h-[400px] lg:col-span-2" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const phase = stats?.systemPhase;

  if (phase === "OFFICIAL_ENROLLMENT" || phase === "BOSY_ENROLLMENT") {
    return <PhaseOfficial stats={stats} />;
  }
  
  if (phase === "EOSY_CLOSING") {
    return <PhaseEOSY stats={stats} />;
  }

  // Fallback / Default for CLASSES_ONGOING and any other phases like PRE_REGISTRATION
  return <PhaseOngoing stats={stats} />;
}
