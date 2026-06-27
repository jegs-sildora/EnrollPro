import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
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
  ChevronDown,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useAuthStore } from "@/store/auth.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
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
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

interface AuditUser {
  id: number;
  firstName: string;
  lastName: string;
  roles: string[];
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
  metadata?: any;
  newValue?: string | null;
  oldValue?: string | null;
}

interface FilterMetadata {
  actionTypes: string[];
  actors: { id: number; name: string; roles: string[] }[];
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

const ACTION_MAP: Record<string, string> = {
  SY_CREATED: "Created School Year",
  SY_UPDATED: "Updated School Year",
  SY_DELETED: "Deleted School Year",
  SY_ARCHIVED: "Archived School Year",
  SY_ROLLOVER: "Rolled Over School Year",
  TERM_DATES_UPDATED: "Updated Term Dates",
  ENROLLMENT_DATES_UPDATED: "Updated Enrollment Dates",
  BOSY_LOCKED: "Locked BOSY",
  BOSY_UNLOCKED: "Unlocked BOSY",
  EOSY_FINALIZED: "Finalized EOSY",
  ENROLLMENT_CREATED: "Created Enrollment",
  ENROLLMENT_UPDATED: "Updated Enrollment",
  ENROLLMENT_DELETED: "Deleted Enrollment",
  ENROLLMENT_VERIFIED: "Verified Enrollment",
  ENROLLMENT_REJECTED: "Rejected Enrollment",
  STUDENT_CREATED: "Added Learner",
  STUDENT_UPDATED: "Updated Learner",
  STUDENT_DELETED: "Deleted Learner",
  SECTION_CREATED: "Created Section",
  SECTION_UPDATED: "Updated Section",
  SECTION_DELETED: "Deleted Section",
  USER_CREATED: "Added Staff Member",
  USER_UPDATED: "Updated Staff Member",
  USER_DELETED: "Deleted Staff Member",
  LOGIN: "Logged In",
  LOGOUT: "Logged Out",
  FAILED_LOGIN: "Failed Login Attempt",
};

function toTitleCase(str: string) {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function actionLabel(actionType: string) {
  const upper = actionType.toUpperCase();
  if (ACTION_MAP[upper]) return ACTION_MAP[upper];

  const parts = upper.split("_");
  const verbMap: Record<string, string> = {
    CREATED: "Created",
    UPDATED: "Updated",
    DELETED: "Deleted",
    REMOVED: "Removed",
    ADDED: "Added",
    ARCHIVED: "Archived",
    RESTORED: "Restored",
  };
  const nounMap: Record<string, string> = {
    SY: "School Year",
    STUDENT: "Learner",
    USER: "Staff Member",
    SECTION: "Class Section",
    SCHOOLYEAR: "School Year",
    SCHOOLSETTING: "School Profile Settings",
  };

  if (parts.length === 2 && verbMap[parts[1]]) {
    const noun = nounMap[parts[0]] || toTitleCase(parts[0]);
    return `${verbMap[parts[1]]} ${noun}`;
  }

  if (parts.length === 2 && verbMap[parts[0]]) {
    const noun = nounMap[parts[1]] || toTitleCase(parts[1]);
    return `${verbMap[parts[0]]} ${noun}`;
  }

  const label = actionType.replaceAll("_", " ");
  return toTitleCase(label)
    .replace(/Schoolyear/ig, "School Year")
    .replace(/Schoolsetting/ig, "School Profile Settings");
}

function getDiffs(log: AuditLogRow) {
  if (log.metadata?.previousData && log.metadata?.newData) {
    return { old: log.metadata.previousData, new: log.metadata.newData };
  }
  if (log.oldValue || log.newValue) {
    let oldData = {};
    let newData = {};
    try { oldData = JSON.parse(log.oldValue || '{}'); } catch (e) { }
    try { newData = JSON.parse(log.newValue || '{}'); } catch (e) { }
    return { old: oldData, new: newData };
  }
  return null;
}

function parseUserAgent(ua: string) {
  if (!ua) return "Unknown Device/Browser";
  let browser = "Unknown Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  
  let os = "Unknown OS";
  if (ua.includes("Win")) os = "Windows";
  else if (ua.includes("Mac")) os = "MacOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("like Mac OS X")) os = "iOS";
  
  return `${browser} on ${os}`;
}

const FIELD_MAP: Record<string, string> = {
  spsEnabled: "Special Program in Sports (SPS) Status",
  spaEnabled: "Special Program in the Arts (SPA) Status",
  steEnabled: "Science, Technology, and Engineering (STE) Status",
};

function formatKeyName(key: string) {
  if (FIELD_MAP[key]) return FIELD_MAP[key];
  const spaced = key.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Forensic UI Upgrade: Shift from "Pretty UI" to "Forensic Usability"
 */
export default function AuditLogs() {
  const { user } = useAuthStore();
  const isSystemAdmin = user?.roles?.includes("SYSTEM_ADMIN");
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

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
    setExpandedRowId(null);
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

  const handlePresetDate = (daysBack: number | null) => {
    const today = new Date();
    const to = today.toISOString().slice(0, 10);
    let from = "";
    if (daysBack !== null) {
      const fromDate = new Date();
      fromDate.setDate(today.getDate() - daysBack);
      from = fromDate.toISOString().slice(0, 10);
    } else {
      // This Month
      const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
      from = fromDate.toISOString().slice(0, 10);
    }
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
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
        size: 160,
        minSize: 140,
        maxSize: 190,
        meta: { skeletonClassName: "w-[140px] mx-auto", className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Timestamp"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => (
          <div className="flex w-full justify-center py-3">
            <span className="whitespace-nowrap text-base font-extrabold text-foreground">
              {formatTimestamp(row.original.createdAt)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "user",
        size: 250,
        minSize: 200,
        maxSize: 350,
        meta: { skeletonClassName: "w-[150px]" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Staff Member"
          />
        ),
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="flex min-w-0 flex-col text-left py-3 pl-2">
              <span className="text-base leading-tight font-extrabold text-foreground uppercase">
                {log.user
                  ? `${log.user.lastName}, ${log.user.firstName}`
                  : "System / Guest"}
              </span>
              {log.user && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-extrabold text-foreground">
                    ID: {log.user.id}
                  </span>
                  <span className="text-sm font-extrabold text-foreground">
                    | {formatUserRole(log.user.roles?.[0])}
                  </span>
                </div>
              )}
            </div>
          );
        },
      },
      {
        id: "systemModule",
        size: 220,
        minSize: 180,
        maxSize: 260,
        meta: { skeletonClassName: "w-[150px] mx-auto", className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="System Module"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => {
          const log = row.original;
          const type = log.subjectType ? log.subjectType.charAt(0) + log.subjectType.slice(1).toLowerCase() : "System";

          let displayType = type;
          if (type === "Schoolyear") displayType = "School Year";
          if (type === "Schoolsetting") displayType = "School Profile Settings";
          if (type === "Enrollment") displayType = "Enrollment";
          if (type === "Student") displayType = "Learner Registry";
          if (type === "User") displayType = "Staff Management";
          if (type === "Section") displayType = "Class Sectioning";

          let colorClass = "bg-slate-100 text-slate-800";
          if (displayType === "School Profile Settings") colorClass = "bg-blue-100 text-blue-800";
          if (displayType === "School Year") colorClass = "bg-indigo-100 text-indigo-800";
          if (displayType === "Learner Registry") colorClass = "bg-slate-700 text-white";
          if (displayType === "Enrollment") colorClass = "bg-emerald-100 text-emerald-800";
          if (displayType === "Staff Management") colorClass = "bg-violet-100 text-violet-800";
          if (displayType === "Class Sectioning") colorClass = "bg-amber-100 text-amber-800";

          return (
            <div className="flex w-full justify-center py-3">
              <Badge className={cn("px-2.5 py-0.5 border-none", colorClass)}>
                {displayType}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "recordedAction",
        size: 400,
        minSize: 300,
        maxSize: 600,
        meta: { skeletonClassName: "w-[250px]" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Recorded Action"
          />
        ),
        cell: ({ row }) => {
          const action = row.original.actionType;
          return (
            <div className="flex min-w-0 flex-col text-left py-3 pl-2 leading-relaxed">
              <span className="font-extrabold text-foreground block mb-0.5 uppercase">
                {actionLabel(action)}
              </span>
              <span className="text-base text-foreground/80 max-w-[400px] break-words block">
                {row.original.description}
              </span>
            </div>
          );
        },
      },
      {
        id: "expander",
        size: 60,
        minSize: 50,
        maxSize: 70,
        meta: { className: "text-center", headerClassName: "text-center" },
        header: "",
        cell: ({ row }) => {
          const diff = getDiffs(row.original);
          const hasChanges = diff && (Object.keys(diff.old).length > 0 || Object.keys(diff.new).length > 0);
          if (!hasChanges) return null;

          return (
            <div className="flex items-center justify-center py-3 pr-2">
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  expandedRowId === row.original.id && "rotate-180 text-primary"
                )}
              />
            </div>
          );
        },
      },
    ],
    [expandedRowId],
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
        description: "Activity Report CSV downloaded successfully.",
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
          <h1 className="text-3xl font-extrabold text-foreground">
            System Activity Logs
          </h1>
          <p className="text-base leading-tight font-extrabold text-foreground ">
            Track institutional data modifications, enrollment overrides, and staff login activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="font-extrabold text-base"
            onClick={() => fetchLogs(page)}
            disabled={loading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {isSystemAdmin && (
            <Button
              className="font-extrabold text-base"
              onClick={handleExport}
              disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Exporting..." : "Download Activity Report"}
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
              <p className="font-extrabold">Access Restricted</p>
              <p className="text-base leading-tight text-foreground font-extrabold">
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
              <CardTitle className="text-base font-extrabold uppercase text-foreground">
                Search Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label className="text-base font-extrabold uppercase st text-foreground">
                    Action Category
                  </Label>
                  <Select value={actionType} onValueChange={(val) => { setActionType(val); setPage(1); }}>
                    <SelectTrigger className="font-extrabold text-base">
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-extrabold text-base">All Actions</SelectItem>
                      {filterMeta.actionTypes.map((at) => (
                        <SelectItem key={at} value={at} className="font-extrabold text-base">
                          {actionLabel(at)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSystemAdmin && (
                  <div className="space-y-2">
                    <Label className="text-base font-extrabold uppercase st text-foreground">
                      Actor Filter
                    </Label>
                    <Select value={actorId} onValueChange={(val) => { setActorId(val); setPage(1); }}>
                      <SelectTrigger className="font-extrabold text-base">
                        <SelectValue placeholder="All Staff Members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="font-extrabold text-base">All Staff Members</SelectItem>
                        {filterMeta.actors.map((actor) => (
                          <SelectItem key={actor.id} value={actor.id.toString()} className="font-extrabold text-base">
                            {actor.name} ({formatUserRole(actor.roles?.[0])})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-base font-extrabold uppercase st text-foreground">
                    Date From
                  </Label>
                  <HybridDatePicker
                    value={dateFrom}
                    onChange={(val) => {
                      setDateFrom(val);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-extrabold uppercase st text-foreground">
                    Date To
                  </Label>
                  <HybridDatePicker
                    value={dateTo}
                    onChange={(val) => {
                      setDateTo(val);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-extrabold uppercase text-foreground mr-2">Quick Presets:</span>
                  <Button variant="outline" size="sm" className="h-8 text-base font-extrabold" onClick={() => handlePresetDate(0)}>Today</Button>
                  <Button variant="outline" size="sm" className="h-8 text-base font-extrabold" onClick={() => handlePresetDate(7)}>Last 7 Days</Button>
                  <Button variant="outline" size="sm" className="h-8 text-base font-extrabold" onClick={() => handlePresetDate(null)}>This Month</Button>
                </div>
                <Button
                  variant="ghost"
                  className="font-extrabold text-base h-8"
                  onClick={() => {
                    setActionType("all");
                    setActorId("all");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}>
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-foreground" />
                  <p className="text-base font-extrabold uppercase text-foreground">
                    Total Events
                  </p>
                </div>
                <CardTitle className="text-3xl font-extrabold mb-4">
                  <AnimatedNumber value={total} />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-base font-extrabold uppercase st text-foreground">
                    Critical Alerts
                  </p>
                </div>
                <CardTitle className="text-3xl font-extrabold  text-amber-600">
                  <AnimatedNumber value={meta.criticalCount} />
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <p className="text-base font-extrabold uppercase st text-primary">
                    Active Actors
                  </p>
                </div>
                <CardTitle className="text-3xl font-extrabold  flex items-center gap-2 text-primary">
                  {meta.activeActors}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden h-[calc(100vh-250px)] min-h-[500px] flex flex-col">
            <DataTable
              columns={columns}
              data={logs}
              loading={loading}
              virtualize={false}
              containerHeight="100%"
              isRowClickable={(row) => {
                const diff = getDiffs(row);
                return diff !== null && (Object.keys(diff.old).length > 0 || Object.keys(diff.new).length > 0);
              }}
              onRowClick={(row) => {
                setExpandedRowId((prev) => (prev === row.id ? null : row.id))
              }}
              renderRowAfter={(row) => {
                if (expandedRowId !== row.id) return null;
                const diff = getDiffs(row);
                if (!diff || (Object.keys(diff.old).length === 0 && Object.keys(diff.new).length === 0)) {
                  return null;
                }
                const allKeys = Array.from(new Set([...Object.keys(diff.old), ...Object.keys(diff.new)]));

                return (
                  <tr className="bg-muted/5 border-b">
                    <td colSpan={columns.length} className="p-0">
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 border-l-4 border-l-primary/50 mx-4 my-2 rounded-r-lg bg-card shadow-sm border border-border/50">
                          <h4 className="text-base font-extrabold uppercase tracking-wide text-foreground mb-4 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Detailed Changes
                          </h4>
                          <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
                            <table className="w-full text-base leading-tight text-left">
                              <thead className="bg-muted/50 border-b">
                                <tr>
                                  <th className="px-4 py-3 font-extrabold text-foreground">Modified Field</th>
                                  <th className="px-4 py-3 font-extrabold text-foreground">Changed From</th>
                                  <th className="px-4 py-3 font-extrabold text-foreground">Changed To</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {allKeys.map(key => {
                                  let oldVal = diff.old[key];
                                  let newVal = diff.new[key];
                                  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;

                                  const isIsoDate = (str: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(str);
                                  const formatVal = (v: any) => {
                                    if (v === null || v === undefined) return "—";
                                    if (v === true || String(v) === "true") return <span className="text-green-600 font-extrabold">Active</span>;
                                    if (v === false || String(v) === "false") return <span className="text-destructive font-extrabold">Inactive</span>;
                                    if (typeof v === "object") return JSON.stringify(v);
                                    const str = String(v);
                                    if (isIsoDate(str)) {
                                      return new Date(str).toLocaleDateString("en-US", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                      });
                                    }
                                    return str;
                                  };

                                  return (
                                    <tr key={key} className="hover:bg-muted/30 transition-colors">
                                      <td className="px-4 py-3 font-extrabold text-foreground/80">{formatKeyName(key)}</td>
                                      <td className="px-4 py-3  text-destructive bg-destructive/5">
                                        <span className="line-through decoration-destructive/40 opacity-80">{formatVal(oldVal)}</span>
                                      </td>
                                      <td className="px-4 py-3  text-green-700 bg-green-50">
                                        {formatVal(newVal)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="mt-4 rounded-lg border bg-background shadow-sm overflow-hidden p-4">
                            <p className="text-sm font-extrabold uppercase text-foreground/60 mb-1">Network Security Footprint</p>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-foreground">{row.ipAddress || "Unknown IP"}</span>
                              <span className="text-foreground/70 text-sm border-l pl-2 border-border">
                                {parseUserAgent(row.userAgent || "")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                );
              }}
            />

            {total > 0 && (
              <PaginationBar
                page={page}
                total={total}
                limit={PAGE_SIZE}
                onPageChange={handlePageChange}
                onLimitChange={() => { }} // Fixed page size for scannability
                itemName="Audit Records"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

