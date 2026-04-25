import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Database,
  HardDrive,
  Monitor,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

interface HealthResponse {
  database: {
    status: string;
    avgQueryMs: number;
  };
  storage: {
    status: string;
  };
  server: {
    uptime: number;
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    totalMemory: number;
    freeMemory: number;
  };
  counts: {
    users: number;
    schoolYears: number;
    gradeLevels: number;
    sections: number;
    applications: number;
    enrollments: number;
    auditLogs: number;
  };
  timezone: string;
}

interface StatsResponse {
  activeUsers: number;
  usersByRole: Record<string, number>;
  systemStatus: string;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(1)} ${units[index]}`;
}

function formatUptime(seconds: number) {
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function statusClass(status: string) {
  if (status === "OK")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "DEGRADED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

interface MetricRow {
  metric: string;
  value: number;
}

export default function SystemHealth() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const showSkeleton = useDelayedLoading(loading);

  const fetchHealthData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        api.get("/admin/system/health"),
        api.get("/admin/dashboard/stats"),
      ]);
      setHealth(healthRes.data);
      setStats(statsRes.data);
      setLastUpdated(new Date());
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const userRoles = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.usersByRole).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [stats]);

  const countData = useMemo<MetricRow[]>(() => {
    if (!health) return [];
    return Object.entries(health.counts).map(([key, value]) => ({
      metric:
        key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
      value: value as number,
    }));
  }, [health]);

  const countColumns = useMemo<ColumnDef<MetricRow>[]>(
    () => [
      {
        accessorKey: "metric",
        header: "Metric",
        cell: ({ row }) => (
          <span className="font-medium text-left block">
            {row.original.metric}
          </span>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        cell: ({ row }) => (
          <span className="text-left block">{row.original.value}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Monitor className="h-7 w-7 text-primary" />
            System Health
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Monitor runtime status, resource usage, and key operational counts.
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdated.toLocaleString("en-US")}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={fetchHealthData}
          disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Database
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-primary" />
              {showSkeleton ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                health?.database.status || "—"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {showSkeleton ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <>
                <Badge
                  variant="outline"
                  className={statusClass(health?.database.status || "DOWN")}>
                  {health?.database.status || "DOWN"}
                </Badge>
                <p className="text-muted-foreground">
                  Avg query: {health?.database.avgQueryMs ?? 0} ms
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Users
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5 text-primary" />
              {showSkeleton ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                (stats?.activeUsers ?? 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {showSkeleton ? (
              <Skeleton className="h-4 w-36" />
            ) : (
              <>
                <Badge
                  variant="outline"
                  className={statusClass(stats?.systemStatus || "DOWN")}>
                  System: {stats?.systemStatus || "DOWN"}
                </Badge>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Server
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Server className="h-5 w-5 text-primary" />
              {showSkeleton ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                formatUptime(health?.server.uptime ?? 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {showSkeleton ? (
              <Skeleton className="h-4 w-44" />
            ) : (
              <p className="text-muted-foreground">
                {health?.server.platform}/{health?.server.arch} • Node{" "}
                {health?.server.nodeVersion}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5" />
              Record Counts
            </CardTitle>
            <CardDescription>
              Current totals from operational tables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton
                    key={`counts-${idx}`}
                    className="h-4 w-full"
                  />
                ))}
              </div>
            ) : (
              <DataTable
                columns={countColumns}
                data={countData}
                loading={loading}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <HardDrive className="h-5 w-5" />
              Runtime Details
            </CardTitle>
            <CardDescription>
              Server resources, memory pressure, and role breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {showSkeleton ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton
                    key={`runtime-${idx}`}
                    className="h-4 w-full"
                  />
                ))}
              </div>
            ) : health ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock3 className="h-4 w-4" /> Uptime
                  </span>
                  <span className="font-semibold">
                    {formatUptime(health.server.uptime)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">RSS Memory</span>
                  <span className="font-semibold">
                    {formatBytes(health.server.memory.rss)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Heap Used</span>
                  <span className="font-semibold">
                    {formatBytes(health.server.memory.heapUsed)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Total System Memory
                  </span>
                  <span className="font-semibold">
                    {formatBytes(health.server.totalMemory)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Free System Memory
                  </span>
                  <span className="font-semibold">
                    {formatBytes(health.server.freeMemory)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">CPU Cores</span>
                  <span className="font-semibold">{health.server.cpus}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Timezone</span>
                  <span className="font-semibold">{health.timezone}</span>
                </div>

                {userRoles.length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <p className="font-semibold">Active Users by Role</p>
                    <div className="flex flex-wrap gap-2">
                      {userRoles.map(([role, count]) => (
                        <Badge
                          key={role}
                          variant="outline">
                          {role}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No health data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
