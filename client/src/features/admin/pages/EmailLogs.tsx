import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/ui/card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { sileo } from "sileo";
import { Download, Mail, RefreshCw, RotateCcw, Search } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

interface EmailLogRow {
  id: number;
  recipient: string;
  subject: string;
  trigger: string;
  status: "PENDING" | "SENT" | "FAILED";
  errorMessage: string | null;
  attemptedAt: string;
  sentAt: string | null;
  applicant: {
    id: number;
    firstName: string;
    lastName: string;
    trackingNumber: string | null;
  } | null;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["PENDING", "SENT", "FAILED"] as const;
const TRIGGER_OPTIONS = [
  "APPLICATION_SUBMITTED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "EXAM_SCHEDULED",
  "ASSESSMENT_PASSED",
  "ASSESSMENT_FAILED",
] as const;

function formatTimestamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function triggerLabel(trigger: string) {
  return trigger.replaceAll("_", " ");
}

function statusClass(status: EmailLogRow["status"]) {
  if (status === "SENT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "FAILED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export default function EmailLogs() {
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendTarget, setResendTarget] = useState<EmailLogRow | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const filterParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (triggerFilter !== "all") params.trigger = triggerFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [statusFilter, triggerFilter, dateFrom, dateTo]);

  const fetchLogs = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const res = await api.get("/admin/email-logs", {
          params: {
            ...filterParams,
            page: targetPage,
            limit: PAGE_SIZE,
          },
        });

        setLogs(res.data.logs || []);
        setTotal(res.data.total ?? 0);
      } catch (err) {
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

  const visibleLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const keyword = search.trim().toLowerCase();
    return logs.filter((log) => {
      return (
        log.recipient.toLowerCase().includes(keyword) ||
        log.subject.toLowerCase().includes(keyword) ||
        log.trigger.toLowerCase().includes(keyword) ||
        log.applicant?.trackingNumber?.toLowerCase().includes(keyword)
      );
    });
  }, [logs, search]);

  const sentCount = useMemo(
    () => logs.filter((log) => log.status === "SENT").length,
    [logs],
  );

  const failedCount = useMemo(
    () => logs.filter((log) => log.status === "FAILED").length,
    [logs],
  );

  const columns = useMemo<ColumnDef<EmailLogRow>[]>(
    () => [
      {
        accessorKey: "attemptedAt",
        header: "Attempted",
        cell: ({ row }) => (
          <span className="text-left text-xs whitespace-nowrap">
            {formatTimestamp(row.original.attemptedAt)}
          </span>
        ),
      },
      {
        accessorKey: "recipient",
        header: "Recipient",
        cell: ({ row }) => {
          const log = row.original;
          return (
            <div className="space-y-0.5 text-left">
              <p className="text-sm font-semibold">{log.recipient}</p>
              <p className="text-xs text-muted-foreground">
                Sent at: {formatTimestamp(log.sentAt)}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "trigger",
        header: "Trigger",
        cell: ({ row }) => (
          <span className="text-left text-xs font-medium block">
            {triggerLabel(row.original.trigger)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="text-left">
            <Badge
              variant="outline"
              className={statusClass(row.original.status)}>
              {row.original.status}
            </Badge>
          </div>
        ),
      },
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <span className="text-left max-w-[320px] break-words block">
            {row.original.subject}
          </span>
        ),
      },
      {
        accessorKey: "applicant",
        header: "Tracking #",
        cell: ({ row }) => (
          <span className="text-left text-xs  block">
            {row.original.applicant?.trackingNumber || "—"}
          </span>
        ),
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ row }) => (
          <span className="text-left text-xs text-red-600 max-w-[260px] break-words block">
            {row.original.errorMessage || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="text-left">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResendTarget(row.original)}
              disabled={resendingId === row.original.id}>
              Resend
            </Button>
          </div>
        ),
      },
    ],
    [resendingId],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/admin/email-logs/export", {
        params: filterParams,
        responseType: "blob",
      });

      const disposition = res.headers["content-disposition"] as
        | string
        | undefined;
      const filenameMatch = disposition?.match(/filename=([^;]+)/i);
      const filename = filenameMatch
        ? filenameMatch[1].replaceAll('"', "")
        : `email-logs-${new Date().toISOString().slice(0, 10)}.csv`;

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
        description: "Email logs CSV downloaded successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setExporting(false);
    }
  };

  const handleResend = async (id: number) => {
    setResendingId(id);
    try {
      await api.patch(`/admin/email-logs/${id}/resend`);
      sileo.success({
        title: "Resend Triggered",
        description: "A resend attempt has been queued and logged.",
      });
      setResendTarget(null);
      fetchLogs(page);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Logs</h1>
          <p className="text-sm font-medium text-muted-foreground">
            View and manage transactional email delivery history.
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
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem
                      key={status}
                      value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select
                value={triggerFilter}
                onValueChange={(value) => {
                  setTriggerFilter(value);
                  setPage(1);
                }}>
                <SelectTrigger>
                  <SelectValue placeholder="All triggers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All triggers</SelectItem>
                  {TRIGGER_OPTIONS.map((trigger) => (
                    <SelectItem
                      key={trigger}
                      value={trigger}>
                      {triggerLabel(trigger)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            <div className="space-y-2">
              <Label>Search (Current Page)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recipient, subject, trigger..."
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setTriggerFilter("all");
                setDateFrom("");
                setDateTo("");
                setSearch("");
                setPage(1);
              }}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total (Server)
            </p>
            <CardTitle className="text-2xl font-extrabold">{total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Sent (Page)
            </p>
            <CardTitle className="text-2xl font-extrabold text-emerald-600">
              {sentCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Failed (Page)
            </p>
            <CardTitle className="text-2xl font-extrabold text-red-600">
              {failedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5" />
            Delivery History
          </CardTitle>
          <CardDescription>
            View every email attempt, error reason, and resend action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable
            columns={columns}
            data={visibleLogs}
            loading={loading}
          />

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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationModal
        open={!!resendTarget}
        onOpenChange={(open) => !open && setResendTarget(null)}
        title="Resend Email"
        description={
          resendTarget
            ? `Resend message "${resendTarget.subject}" to ${resendTarget.recipient}?`
            : "Confirm resend action."
        }
        onConfirm={() => resendTarget && handleResend(resendTarget.id)}
        confirmText="Yes, Resend"
        loading={!!resendTarget && resendingId === resendTarget.id}
        variant="info"
      />
    </div>
  );
}
