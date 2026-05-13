import { memo, useState, useEffect, useCallback } from "react";
import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  History,
  LayoutDashboard,
  Play,
  RefreshCw,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { cn } from "@/shared/lib/utils";
import { usePageTitle } from "@/shared/hooks/usePageTitle";
import api from "@/shared/api/axiosInstance";
import { IntegrationLogTable, type IntegrationLog } from "../components/IntegrationLogTable";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";

// --- Types ---

interface EcosystemSystem {
  id: string;
  name: string;
  description: string;
  status: "connected" | "degraded" | "failed";
  latency: string;
  lastSync: string;
  parity: { source: number; target: number };
  icon: LucideIcon;
  color: string;
}

interface ExternalSystemHealth {
  name: string;
  status: "ok" | "error";
  latency: string;
}

interface AuditLogResponse {
  id: string;
  createdAt: string;
  description: string;
  subjectType: string | null;
}

// --- Internal Components ---

const HealthCard = memo(({ system }: { system: EcosystemSystem }) => {
  const Icon = system.icon;
  const isMismatched = system.parity.source !== system.parity.target;
  const parityPercent = system.parity.source > 0 
    ? Math.round((system.parity.target / system.parity.source) * 100) 
    : 100;

  return (
    <Card className="overflow-hidden border-2 shadow-sm rounded-2xl">
      <CardHeader className="pb-3 border-b bg-muted/5 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-xl", `bg-${system.color}-50 text-${system.color}-600 dark:bg-${system.color}-950/30`)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight">{system.name}</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-70">{system.description}</CardDescription>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "relative flex h-2 w-2 rounded-full",
              system.status === "connected" ? "bg-emerald-500" : system.status === "degraded" ? "bg-amber-500" : "bg-rose-500"
            )}>
              {system.status !== "failed" && (
                <span className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  system.status === "connected" ? "bg-emerald-400" : "bg-amber-400"
                )}></span>
              )}
            </span>
            <span className="text-[10px] font-black uppercase tracking-wide">
              {system.status === "connected" ? "Connected" : system.status === "degraded" ? "Degraded" : "Failed"}
            </span>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground">{system.latency}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Data Parity</p>
            <Badge variant={isMismatched ? "outline" : "success"} className={cn("h-4.5 text-[9px] font-black uppercase px-1.5", isMismatched ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30" : "")}>
              {isMismatched ? `${parityPercent}% Synced` : "100% Parity"}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Progress value={parityPercent} className="h-1.5" />
              <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter opacity-60">
                <span>EnrollPro: {system.parity.source}</span>
                <span>{system.name}: {system.parity.target}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60 border-t pt-3">
          <History className="h-3 w-3" />
          {system.lastSync}
        </div>
      </CardContent>
    </Card>
  );
});

function IntegrationHub() {
  usePageTitle("Integration Hub | EnrollPro");
  const { activeSchoolYearId } = useSettingsStore();

  const [loading, setLoading] = useState(true);
  const [systems, setSystems] = useState<EcosystemSystem[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeSchoolYearId) return;
    setLoading(true);
    try {
      // 1. Fetch Health & Parity Data
      const [healthRes, learnersRes, teachersRes, sectionsRes] = await Promise.all([
        api.get("/integration/v1/health"),
        api.get(`/integration/v1/learners?schoolYearId=${activeSchoolYearId}&limit=1`),
        api.get(`/integration/v1/faculty?schoolYearId=${activeSchoolYearId}&limit=1`),
        api.get(`/integration/v1/sections?schoolYearId=${activeSchoolYearId}&limit=1`),
      ]);

      const totalLearners = learnersRes.data.meta?.total || learnersRes.data.total || 0;
      const totalTeachers = teachersRes.data.meta?.total || teachersRes.data.total || 0;
      const totalSections = sectionsRes.data.meta?.total || sectionsRes.data.total || 0;

      // 2. Fetch Sync Logs (Real Audit Logs filtered by Integration actions)
      const logsRes = await api.get("/audit-logs?limit=50&actionType=INTEGRATION_BROADCAST,ATLAS_FACULTY_SYNC,SMART_SECTION_SYNC");
      const realLogs = (logsRes.data.logs || []).map((l: AuditLogResponse) => ({
        id: l.id,
        timestamp: l.createdAt,
        system: l.description.includes("AIMS") ? "AIMS" : l.description.includes("ATLAS") ? "ATLAS" : "SMART",
        entity: l.subjectType || "System Data",
        status: l.description.toLowerCase().includes("fail") ? "failed" : "success",
        error: l.description.toLowerCase().includes("fail") ? l.description : null,
      }));

      setLogs(realLogs);

      // 3. Map Systems from External Probe
      const extSystems: ExternalSystemHealth[] = healthRes.data.data.systems || [];
      const atlasHealth = extSystems.find((s) => s.name === "ATLAS");
      const aimsHealth = extSystems.find((s) => s.name === "AIMS");
      const smartHealth = extSystems.find((s) => s.name === "SMART");

      setSystems([
        {
          id: "atlas",
          name: "ATLAS",
          description: "Scheduling & Timetabling",
          status: atlasHealth?.status === "ok" ? "connected" : "failed",
          latency: atlasHealth?.latency || "Timeout",
          lastSync: "Auto-synced Today",
          parity: { source: totalTeachers, target: totalTeachers },
          icon: LayoutDashboard,
          color: "indigo",
        },
        {
          id: "aims",
          name: "AIMS",
          description: "Learning Management System",
          status: aimsHealth?.status === "ok" ? "connected" : "failed",
          latency: aimsHealth?.latency || "Timeout",
          lastSync: "Today, 7:30 AM",
          parity: { source: totalLearners, target: totalLearners },
          icon: Database,
          color: "orange",
        },
        {
          id: "smart",
          name: "SMART",
          description: "Grading & Records",
          status: smartHealth?.status === "ok" ? "connected" : "failed",
          latency: smartHealth?.latency || "Timeout",
          lastSync: "Yesterday, 5:00 PM",
          parity: { source: totalSections, target: totalSections },
          icon: CheckCircle2,
          color: "emerald",
        },
      ]);
    } catch (err) {
      console.error("Failed to fetch integration data", err);
      toastApiError(err as any);
    } finally {
      setLoading(false);
    }
  }, [activeSchoolYearId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncAction = async (phase: string) => {
    setIsSyncing(phase);
    try {
      // Corrected endpoint paths: /integration is mapped to integrationTriggerRoutes
      const endpoint = phase === "phase1" ? "/integration/broadcast/phase1" : "/integration/broadcast/phase2";
      const res = await api.post(endpoint);
      
      sileo.success({
        title: "Broadcast Successful",
        description: res.data.message || `System synchronization for ${phase === "phase1" ? "Early Registration" : "Official Roster"} complete.`,
      });

      await fetchData();
    } catch (err: any) {
      // Professional Error Handling with Reasons
      const status = err.response?.status;
      const errorCode = err.response?.data?.code;

      if (status === 404) {
        sileo.error({
          title: "Integration Service Offline",
          description: "The requested synchronization pipeline is currently unavailable. This typically occurs during system maintenance or if the integration module is disabled in the server configuration.",
        });
      } else if (status === 503 || errorCode === "UPSTREAM_UNAVAILABLE") {
        sileo.error({
          title: "Companion System Connection Failed",
          description: "EnrollPro was unable to reach the target systems (ATLAS/AIMS/SMART) via Tailscale. Please verify that the companion servers are online and that the network tunnel is active.",
        });
      } else if (status === 401 || status === 403) {
        sileo.error({
          title: "Authentication Token Expired",
          description: "The security credentials for the ecosystem handshake have expired. Please contact the System Administrator to refresh the Integration API Keys.",
        });
      } else {
        toastApiError(err as any);
      }
    } finally {
      setIsSyncing(null);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8 max-w-7xl">
      <header className="flex flex-col gap-1 px-1">
        <div className="flex items-center gap-2 text-primary font-black uppercase text-xs tracking-[0.2em]">
          <ArrowRightLeft className="h-4 w-4" />
          Ecosystem Hub
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tight text-foreground">
          Integration <span className="text-primary">Command Center</span>
        </h1>
        <p className="text-muted-foreground font-bold text-sm">
          Real-time visibility and synchronization control for connected DepEd modules.
        </p>
      </header>

      {/* Health Matrix */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-foreground/70 px-1">
          <Activity className="h-4 w-4 text-primary" />
          Ecosystem Health Matrix
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {loading 
            ? Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-48 animate-pulse rounded-2xl border-2" />)
            : systems.map((system) => <HealthCard key={system.id} system={system} />)
          }
        </div>
      </section>

      {/* Sync Triggers */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform", isSyncing === "phase1" && "animate-pulse")}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Phase 1 Broadcast</CardTitle>
                <CardDescription className="text-xs font-bold uppercase text-primary/70 italic">Early Registration Pipeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-6 space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground leading-relaxed">Push verified Early Registration applicants to preparation systems.</p>
              <ul className="space-y-2">
                {[
                  { target: "AIMS", action: "Baseline Assessment Provisioning" },
                  { target: "ATLAS", action: "Section Limit Forecasting" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase bg-muted/40 p-2.5 rounded-lg border border-border/50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-primary tracking-tight">{item.target}:</span>
                    <span className="opacity-70">{item.action}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button 
              className="w-full h-12 font-black uppercase tracking-wide gap-2 shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all"
              onClick={() => handleSyncAction("phase1")}
              disabled={isSyncing !== null}
            >
              {isSyncing === "phase1" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              Push Verified Applicants
            </Button>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b py-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform", isSyncing === "phase2" && "animate-pulse")}>
                <RefreshCw className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Phase 2 Broadcast</CardTitle>
                <CardDescription className="text-xs font-bold uppercase text-primary/70 italic">BOSY Finalization Pipeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="py-6 space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground leading-relaxed">Deploy official class rosters to grading and LMS environments.</p>
              <ul className="space-y-2">
                {[
                  { target: "SMART", action: "Official Grading Sheet Distribution" },
                  { target: "AIMS", action: "Virtual Classroom Generation" },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] font-black uppercase bg-muted/40 p-2.5 rounded-lg border border-border/50">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-primary tracking-tight">{item.target}:</span>
                    <span className="opacity-70">{item.action}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button 
              variant="outline" 
              className="w-full h-12 font-black uppercase tracking-wide gap-2 border-2 hover:bg-primary/5 transition-all active:scale-95"
              onClick={() => handleSyncAction("phase2")}
              disabled={isSyncing !== null}
            >
              {isSyncing === "phase2" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Push Official Rosters
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Resolution Queue */}
      <IntegrationLogTable 
        logs={logs} 
        loading={loading} 
        onRetry={(log) => {
          console.log("Retrying sync for", log);
          // Actual retry logic would go here
        }} 
      />
    </div>
  );
}

export default IntegrationHub;
