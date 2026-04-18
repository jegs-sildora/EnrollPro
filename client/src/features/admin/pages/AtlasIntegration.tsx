import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CloudUpload,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

interface AtlasHealthResponse {
  endpoint: {
    configured: boolean;
    url: string | null;
    probe: {
      status: "UP" | "DOWN" | "DEGRADED" | "UNCONFIGURED";
      latencyMs: number | null;
      httpStatus: number | null;
      error: string | null;
    };
  };
  queue: {
    pending: number;
    synced: number;
    failed: number;
    oldestPendingEvent: {
      id: number;
      createdAt: string;
    } | null;
  };
  recentFailures: Array<{
    id: number;
    eventId: string;
    eventType: string;
    errorMessage: string | null;
    attemptCount: number;
    maxAttempts: number;
    nextRetryAt: string | null;
    createdAt: string;
    teacher: {
      id: number;
      name: string;
    } | null;
  }>;
}

interface AtlasEvent {
  id: number;
  eventId: string;
  eventType: string;
  status: "PENDING" | "SYNCED" | "FAILED";
  httpStatus: number | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
  teacher: {
    id: number;
    name: string;
  } | null;
  schoolYear: {
    id: number;
    yearLabel: string;
  } | null;
}

interface AtlasEventsResponse {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  events: AtlasEvent[];
}

const STATUS_OPTIONS = ["all", "PENDING", "SYNCED", "FAILED"] as const;
type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "danger";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadge(status: string): BadgeVariant {
  if (status === "SYNCED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PENDING") return "warning";
  if (status === "UP") return "success";
  if (status === "DEGRADED") return "warning";
  if (status === "DOWN") return "danger";
  return "outline";
}

export default function AtlasIntegration() {
  const [health, setHealth] = useState<AtlasHealthResponse | null>(null);
  const [events, setEvents] = useState<AtlasEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("all");

  const showSkeleton = useDelayedLoading(loading);

  const columns = useMemo<ColumnDef<AtlasEvent>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-left text-xs block">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "eventType",
        header: "Event Type",
        cell: ({ row }) => (
          <span className="text-left text-xs block font-medium">
            {row.original.eventType}
          </span>
        ),
      },
      {
        accessorKey: "teacher",
        header: "Teacher",
        cell: ({ row }) => (
          <span className="text-left text-xs block">
            {row.original.teacher?.name ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "schoolYear",
        header: "School Year",
        cell: ({ row }) => (
          <span className="text-left text-xs block">
            {row.original.schoolYear?.yearLabel ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="text-left">
            <Badge variant={statusBadge(row.original.status)}>
              {row.original.status}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "attemptCount",
        header: "Attempts",
        cell: ({ row }) => (
          <span className="text-left text-xs block font-mono">
            {row.original.attemptCount} / {row.original.maxAttempts}
          </span>
        ),
      },
      {
        accessorKey: "httpStatus",
        header: "HTTP",
        cell: ({ row }) => (
          <span className="text-left text-xs block font-mono">
            {row.original.httpStatus ?? "-"}
          </span>
        ),
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ row }) => (
          <span
            className="text-left text-xs max-w-[240px] truncate block"
            title={row.original.errorMessage ?? ""}>
            {row.original.errorMessage ?? "-"}
          </span>
        ),
      },
    ],
    [],
  );

  const fetchAtlasData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, eventsRes] = await Promise.all([
        api.get<AtlasHealthResponse>("/admin/atlas/health"),
        api.get<AtlasEventsResponse>("/admin/atlas/events", {
          params: {
            page,
            pageSize: 15,
            ...(statusFilter !== "all" ? { status: statusFilter } : {}),
          },
        }),
      ]);

      setHealth(healthRes.data);
      setEvents(eventsRes.data.events ?? []);
      setTotalPages(eventsRes.data.totalPages ?? 1);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchAtlasData();
  }, [fetchAtlasData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CloudUpload className="h-7 w-7 text-primary" />
            ATLAS Integration
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Monitor EnrollPro to ATLAS sync delivery health and event logs.
          </p>
        </div>
        <Button variant="outline" onClick={fetchAtlasData} disabled={loading}>
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Endpoint Probe
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="h-5 w-5 text-primary" />
              {showSkeleton ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                (health?.endpoint.probe.status ?? "-")
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {showSkeleton ? (
              <Skeleton className="h-4 w-40" />
            ) : (
              <>
                <Badge
                  variant={statusBadge(
                    health?.endpoint.probe.status || "UNCONFIGURED",
                  )}>
                  {health?.endpoint.probe.status || "UNCONFIGURED"}
                </Badge>
                <p className="text-muted-foreground">
                  Latency: {health?.endpoint.probe.latencyMs ?? 0}ms
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Queue
            </CardDescription>
            <CardTitle className="text-xl">
              Pending: {showSkeleton ? "-" : (health?.queue.pending ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>Synced: {showSkeleton ? "-" : (health?.queue.synced ?? 0)}</p>
            <p>Failed: {showSkeleton ? "-" : (health?.queue.failed ?? 0)}</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Configuration
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ServerCrash className="h-5 w-5 text-primary" />
              {health?.endpoint.configured ? "Configured" : "Missing"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {health?.endpoint.url ? (
              <p className="truncate" title={health.endpoint.url}>
                {health.endpoint.url}
              </p>
            ) : (
              <p>Set ATLAS_TEACHER_WEBHOOK_URL or ATLAS_WEBHOOK_URL.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">Event Log</CardTitle>
              <CardDescription>
                Recent delivery attempts to ATLAS.
              </CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as (typeof STATUS_OPTIONS)[number]);
                setPage(1);
              }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SYNCED">Synced</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={columns}
            data={events}
            loading={showSkeleton}
          />

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              Failed events are automatically retried by the sync worker.
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground font-bold">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page >= totalPages || loading}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
