// @ts-nocheck
import { useEffect, useState } from "react";
import { AlertTriangle, Database, Loader2, RefreshCw, Server, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/features/smart/components/ui/card";
import { Badge } from "@/features/smart/components/ui/badge";
import { Button } from "@/features/smart/components/ui/button";
import { registrarApi, type RegistrarDashboard } from "@/features/smart/lib/api";
import { useTheme } from "@/features/smart/contexts/ThemeContext";

const gradeLevelLabels: Record<string, string> = {
  GRADE_7: "Grade 7",
  GRADE_8: "Grade 8",
  GRADE_9: "Grade 9",
  GRADE_10: "Grade 10",
};

function SyncStatusBadge({ dashboard }: { dashboard: RegistrarDashboard | null }) {
  if (!dashboard) {
    return <Badge className="bg-slate-100 text-slate-700">Sync status unavailable</Badge>;
  }

  if (dashboard.sync.running) {
    return <Badge className="bg-blue-100 text-blue-700 border border-blue-300">Sync in progress</Badge>;
  }

  if (dashboard.sync.status === "never") {
    return <Badge className="bg-amber-100 text-amber-700 border border-amber-300">Not synced yet</Badge>;
  }

  if (dashboard.sync.isStale) {
    return (
      <Badge className="bg-rose-100 text-rose-700 border border-rose-300">
        Stale ({dashboard.sync.minutesSinceLastSync} min)
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-300">
      Fresh ({dashboard.sync.minutesSinceLastSync} min)
    </Badge>
  );
}

export default function RegistrarDashboardPage() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dashboard, setDashboard] = useState<RegistrarDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await registrarApi.getDashboard();
      setDashboard(response.data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load registrar dashboard:", err);
      setError(err?.response?.data?.message || "Failed to load registrar dashboard");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadDashboard(false);

    const poller = window.setInterval(() => {
      void loadDashboard(true);
    }, 30000);

    return () => window.clearInterval(poller);
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await registrarApi.runSync();
      await loadDashboard(true);
    } catch (err) {
      console.error("Failed to trigger registrar sync:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.primary }} />
      </div>
    );
  }

  if (!dashboard || error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Dashboard</h2>
        <p className="text-gray-600 mb-4">{error || "Unknown error"}</p>
        <Button onClick={() => void loadDashboard(false)} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Registrar Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time enrollment oversight with EnrollPro-backed student metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SyncStatusBadge dashboard={dashboard} />
          <Button
            onClick={triggerSync}
            disabled={syncing}
            className="text-white rounded-xl"
            style={{ backgroundColor: colors.primary }}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync with EnrollPro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Total Students</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{dashboard.stats.totalStudents}</p>
              </div>
              <Users className="w-7 h-7" style={{ color: colors.primary }} />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Source: {dashboard.stats.totalStudentsSource === "enrollpro-realtime" ? "EnrollPro (real-time)" : "SMART DB fallback"}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Sections</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{dashboard.stats.totalSections}</p>
              </div>
              <Server className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-xs text-slate-500 mt-3">School Year: {dashboard.currentSchoolYear}</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Male / Female</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">
                  {dashboard.stats.maleCount} / {dashboard.stats.femaleCount}
                </p>
              </div>
              <Database className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-xs text-slate-500 mt-3">From synced masterlist</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 font-semibold">Data Issues</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{dashboard.dataCompleteness.totalIssues}</p>
              </div>
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Missing LRN: {dashboard.dataCompleteness.missingLrn}, Birth Date: {dashboard.dataCompleteness.missingBirthDate}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle>Grade-Level Distribution</CardTitle>
            <CardDescription>Synced enrolled learner counts by grade level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(dashboard.stats.gradeStats).map(([grade, count]) => (
              <div key={grade} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm  text-slate-700">{gradeLevelLabels[grade] || grade}</span>
                <Badge style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}>{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border border-slate-200">
          <CardHeader>
            <CardTitle>Section Overview</CardTitle>
            <CardDescription>Current advisory and class sizes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[340px] overflow-auto">
            {dashboard.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{section.name}</p>
                  <Badge style={{ backgroundColor: `${colors.primary}15`, color: colors.primary }}>
                    {gradeLevelLabels[section.gradeLevel] || section.gradeLevel}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 mt-1">{section.studentCount} learners</p>
                <p className="text-xs text-slate-500 mt-1">Adviser: {section.adviser || "Unassigned"}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
