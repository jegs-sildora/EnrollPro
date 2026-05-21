import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { useSearchParams } from "react-router";
import { sileo } from "sileo";
import {
  Download,
  RefreshCw,
  ShieldAlert,
  AlertTriangle,
  History,
  Activity,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { cn, formatUserRole, getRoleColorClasses } from "@/shared/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { PaginationBar } from "@/shared/components/PaginationBar";

interface AuditUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuditLogRow {
  id: number;
  userId: number | null;
  actionType: string;
  description: string;
  subjectType: string | null;
  recordId: number | null;
  resolvedSubject: string | null;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  user: AuditUser | null;
}

interface FilterMetadata {
  actionTypes: string[];
  actors: { id: number; name: string; role: string }[];
}

const PAGE_SIZE = 20;

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function actionLabel(actionType: string) {
  const label = actionType.replaceAll("_", " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Forensic UI Upgrade: Shift from "Pretty UI" to "Forensic Usability"
 */
export default function AuditLogs() {
  const { user } = useAuthStore();
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 1);
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState({ criticalCount: 0, activeActors: 0 });

  const [actionType, setActionType] = useState(() => searchParams.get("actionType") || "all");
  const [actorId, setActorId] = useState(() => searchParams.get("actorId") || "all");
  const [dateFrom, setDateFrom] = useState(() => searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(() => searchParams.get("dateTo") || "");

  const updateUrlParams = useCallback(
    (newParams: Record<string, string | number | undefined>) => {
      const current = Object.fromEntries(searchParams.entries());
      const updated = { ...current, ...newParams };

      Object.keys(updated).forEach((key) => {
        if (updated[key] === undefined || updated[key] === null || updated[key] === "" || updated[key] === "all") {
          delete updated[key];
        }
      });

      setSearchParams(updated as Record<string, string>, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrlParams({ page: newPage });
  };

  const [filterMeta, setFilterMeta] = useState<FilterMetadata>({
    actionTypes: [],
    actors: [],
  });

  const fetchFilterMeta = async () => {
    try {
      const res = await api.get("/audit-logs/filters");
      setFilterMeta(res.data);
    } catch (err) {
      console.error("Failed to fetch filter metadata", err);
    }
  };

  useEffect(() => {
    if (isSystemAdmin) {
      fetchFilterMeta();
    }
  }, [isSystemAdmin]);

  const columns = useMemo<ColumnDef<AuditLogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Timestamp",
        cell: ({ row }) => (
          <div className="text-center">
            <span className="whitespace-nowrap text-xs font-semibold text-foreground">
              {formatTimestamp(row.original.createdAt)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "user",
        header: "Actor",
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="space-y-0.5 text-left">
              <p className="text-sm font-bold  text-foreground">
                {log.user
                  ? `${log.user.lastName}, ${log.user.firstName}`
                  : "System / Guest"}
              </p>
              {log.user && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground opacity-70">
                    ID: {log.user.id}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] font-black uppercase px-1.5 h-3.5 border-none",
                      getRoleColorClasses(log.user.role),
                    )}>
                    {formatUserRole(log.user.role)}
                  </Badge>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "actionType",
        header: "Action",
        cell: ({ row }) => {
          const action = row.original.actionType;
          const isDestructive = action.includes("DELETE") || action.includes("REMOVE") || action.includes("DROP");
          
          return (
            <div className="text-center">
              <Badge
                variant={isDestructive ? "destructive" : "secondary"}
                className={cn(
                  "font-bold text-xs px-2 py-0.5 border-none",
                  !isDestructive && "bg-slate-100 text-foreground"
                )}>
                {actionLabel(action)}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => {
          const log = row.original;
          const type = log.subjectType ? log.subjectType.charAt(0) + log.subjectType.slice(1).toLowerCase() : "System";
          
          return (
            <div className="text-left space-y-0.5 flex justify-center items-center flex-col">
              <span className="text-xs font-bold text-foreground/80 px-1.5 py-0.5 bg-muted rounded">
                {type}
              </span>
              {log.resolvedSubject ? (
                <p className="text-sm font-semibold text-foreground">
                  {log.resolvedSubject}
                </p>
              ) : log.recordId ? (
                <p className="text-xs font-mono text-foreground">
                  Record #{log.recordId}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm font-normal text-foreground max-w-[400px] break-words block text-left leading-relaxed">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "ipAddress",
        header: "IP Address",
        cell: ({ row }) => (
          <div className="text-center">
            <span className="text-xs font-mono font-bold text-foreground bg-muted/30 px-1.5 py-0.5 rounded">
              {row.original.ipAddress}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (actionType !== "all") params.actionType = actionType;
    if (isSystemAdmin && actorId !== "all") params.userId = actorId;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [actionType, actorId, dateFrom, dateTo, isSystemAdmin]);

  const fetchLogs = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setForbidden(false);
      try {
        const res = await api.get("/audit-logs", {
          params: {
            ...filterParams,
            page: targetPage,
            limit: PAGE_SIZE,
          },
        });

        setLogs(res.data.logs || []);
        setTotal(res.data.total ?? 0);
        setMeta(res.data.meta || { criticalCount: 0, activeActors: 0 });
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response
          ?.status;
        if (status === 403) {
          setForbidden(true);
          setLogs([]);
          setTotal(0);
          return;
        }
        toastApiError(err as never);
      } finally {
        setLoading(false);
      }
    },
    [filterParams],
  );

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/audit-logs/export", {
        params: filterParams,
        responseType: "blob",
      });

      const disposition = res.headers["content-disposition"] as
        | string
        | undefined;
      const filenameMatch = disposition?.match(/filename=([^;]+)/i);
      const filename = filenameMatch
        ? filenameMatch[1].replaceAll('"', "")
        : `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      sileo.success({
        title: "Export Ready",
        description: "Forensic Audit CSV downloaded successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">
            Audit Logs
          </h1>
          <p className="text-sm font-bold text-foreground ">
            Forensic analysis of immutable system activity and actor metadata.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="font-semibold text-xs"
            onClick={() => fetchLogs(page)}
            disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {isSystemAdmin && (
            <Button
              className="font-semibold text-xs"
              onClick={handleExport}
              disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Export forensic CSV"}
            </Button>
          )}
        </div>
      </div>

      {forbidden ? (
        <Card className="border-none shadow-sm">
          <CardContent className="py-10">
            <div className="mx-auto max-w-xl text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <p className="font-bold">Access Restricted</p>
              <p className="text-sm text-foreground font-bold">
                Your role cannot access full audit logs. Contact a system
                administrator if this access is required.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase text-foreground">
                Forensic Search Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase st text-foreground">
                    Action Category
                  </Label>
                  <Select value={actionType} onValueChange={(val) => { setActionType(val); setPage(1); }}>
                    <SelectTrigger className="font-semibold text-xs">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-semibold text-xs">All Actions</SelectItem>
                      {filterMeta.actionTypes.map((at) => (
                        <SelectItem key={at} value={at} className="font-semibold text-xs">
                          {actionLabel(at)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSystemAdmin && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase st text-foreground">
                      Actor Filter
                    </Label>
                    <Select value={actorId} onValueChange={(val) => { setActorId(val); setPage(1); }}>
                      <SelectTrigger className="font-semibold text-xs">
                        <SelectValue placeholder="All Staff Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="font-semibold text-xs">All Staff Members</SelectItem>
                        {filterMeta.actors.map((actor) => (
                          <SelectItem key={actor.id} value={actor.id.toString()} className="font-semibold text-xs">
                            {actor.name} ({formatUserRole(actor.role)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase st text-foreground">
                    Date From
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    className="font-semibold text-xs"
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase st text-foreground">
                    Date To
                  </Label>
                  <Input
                    type="date"
                    value={dateTo}
                    className="font-semibold text-xs"
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="font-bold text-xs st h-8"
                  onClick={() => {
                    setActionType("all");
                    setActorId("all");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}>
                  Clear Investigation Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-foreground" />
                  <p className="text-xs font-bold uppercase st text-foreground">
                    Total Events
                  </p>
                </div>
                <CardTitle className="text-3xl font-black ">
                  <AnimatedNumber value={total} />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-xs font-bold uppercase st text-foreground">
                    Critical Alerts
                  </p>
                </div>
                <CardTitle className="text-3xl font-black  text-amber-600">
                  <AnimatedNumber value={meta.criticalCount} />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold uppercase st text-primary">
                    Active Actors
                  </p>
                </div>
                <CardTitle className="text-3xl font-black  flex items-center gap-2 text-primary">
                  {meta.activeActors}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden min-h-[500px]">
            <DataTable
              columns={columns}
              data={logs}
              loading={loading}
              virtualize={false}
            />

            {total > 0 && (
              <PaginationBar
                page={page}
                total={total}
                limit={PAGE_SIZE}
                onPageChange={handlePageChange}
                onLimitChange={() => {}} // Fixed page size for forensic scannability
                itemName="Audit Records"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

