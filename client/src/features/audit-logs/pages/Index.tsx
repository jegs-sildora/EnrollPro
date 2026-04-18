import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import {
  ClipboardList,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

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
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  user: AuditUser | null;
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
  return actionType.replaceAll("_", " ");
}

export default function AuditLogs() {
  const { user } = useAuthStore();
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const showSkeleton = useDelayedLoading(loading);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [actionType, setActionType] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const columns = useMemo<ColumnDef<AuditLogRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs font-medium">
            {formatTimestamp(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "user",
        header: "Actor",
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">
                {log.user
                  ? `${log.user.lastName}, ${log.user.firstName}`
                  : "System / Guest"}
              </p>
              {log.user && (
                <p className="text-xs text-muted-foreground">
                  ID {log.user.id} • {log.user.role}
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "actionType",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-semibold">
            {actionLabel(row.original.actionType)}
          </Badge>
        ),
      },
      {
        accessorKey: "subjectType",
        header: "Subject",
        cell: ({ row }) => {
          const log = row.original;
          return (
            <span className="text-xs">
              {log.subjectType
                ? `${log.subjectType}${log.recordId ? ` #${log.recordId}` : ""}`
                : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm max-w-[480px] break-words block">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "ipAddress",
        header: "IP Address",
        cell: ({ row }) => (
          <span className="text-xs font-mono">{row.original.ipAddress}</span>
        ),
      },
    ],
    [],
  );

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (actionType.trim()) params.actionType = actionType.trim().toUpperCase();
    if (isSystemAdmin && userId.trim()) params.userId = userId.trim();
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [actionType, userId, dateFrom, dateTo, isSystemAdmin]);

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

  const visibleActors = useMemo(() => {
    const unique = new Set(
      logs.map((log) => (log.user ? `${log.user.id}` : "system")),
    );
    return unique.size;
  }, [logs]);

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
        description: "Audit log CSV downloaded successfully.",
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" />
            Audit Logs
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            Review immutable system activity and actor metadata.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchLogs(page)}
            disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {isSystemAdmin && (
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Export CSV"}
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
              <p className="text-sm text-muted-foreground">
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
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={actionType}
                      onChange={(e) => {
                        setActionType(e.target.value);
                        setPage(1);
                      }}
                      placeholder="e.g. APPLICATION_SUBMITTED"
                      className="pl-9"
                    />
                  </div>
                </div>
                {isSystemAdmin && (
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input
                      value={userId}
                      onChange={(e) => {
                        setUserId(e.target.value.replace(/[^0-9]/g, ""));
                        setPage(1);
                      }}
                      placeholder="System admin filter"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionType("");
                    setUserId("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}>
                  Reset Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Results
                </p>
                <CardTitle className="text-2xl font-extrabold">
                  {total}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Visible Rows
                </p>
                <CardTitle className="text-2xl font-extrabold">
                  {logs.length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Actors In View
                </p>
                <CardTitle className="text-2xl font-extrabold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {visibleActors}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DataTable columns={columns} data={logs} loading={showSkeleton} />

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm font-semibold text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1 || loading}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages || loading}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
