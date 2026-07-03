import { useState, useEffect, useCallback, startTransition } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";

import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  markTransferRequest,
  bulkConfirm,
  apiRevertToPendingBeef,
  apiFlushNoShows,
  getPreviousSections,
} from "../api/bosy.api";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import type { BOSYReadiness, BOSYQueueItem } from "../types";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { QueueTable } from "../components/QueueTable";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { BulkConfirmBar } from "../components/BulkConfirmBar";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { PhaseBanner } from "@/shared/components/PhaseBanner";

import { sileo } from "sileo";

function formatNoShowStatus(status: string): string {
  const map: Record<string, string> = {
    READY_FOR_ENROLLMENT: "Ready for Enrollment",
    PENDING_BEEF: "Pending (Incomplete)",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

const FLUSH_NO_SHOW_COLUMNS: ColumnDef<BOSYQueueItem>[] = [
  {
    accessorKey: "lrn",
    header: ({ column }) => <DataTableColumnHeader column={column} title="LRN" />,
    cell: ({ row }) => (
      <span className="font-mono font-extrabold text-base text-foreground">
        {row.original.lrn ?? <em className="opacity-50 not-italic">No LRN</em>}
      </span>
    ),
    size: 140,
  },
  {
    id: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Learner" />,
    cell: ({ row }) => {
      const { lastName, firstName } = row.original;
      return (
        <span className="font-extrabold text-base leading-tight">
          {[lastName, firstName].filter(Boolean).join(", ")}
        </span>
      );
    },
  },
  {
    accessorKey: "gradeLevelName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Grade" />,
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-base font-extrabold">
        {row.original.gradeLevelName}
      </Badge>
    ),
    size: 100,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="text-base font-extrabold border-amber-300 text-amber-700 bg-amber-50"
      >
        {formatNoShowStatus(row.original.status)}
      </Badge>
    ),
    size: 160,
  },
];

export default function BOSYPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeSchoolYearId, viewingSchoolYearId } =
    useSettingsStore();
  const { ayLabel } = useSchoolYearContext();
  let priorSyLabel = "25-26";
  if (ayLabel) {
    const parts = ayLabel.split("-");
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        priorSyLabel = `${start - 1}-${end - 1}`;
      }
    }
  }
  const resolvedSchoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const syId =
    typeof resolvedSchoolYearId === "number" &&
      Number.isFinite(resolvedSchoolYearId) &&
      resolvedSchoolYearId > 0
      ? resolvedSchoolYearId
      : null;

  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate = !isHistoricalReadOnly || hasOverride;

  const [readiness, setReadiness] = useState<BOSYReadiness | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("PENDING_CONFIRMATION");
  const [targetGrade, setTargetGrade] = useState<string>("ALL");
  const {
    inputValue: queueSearch,
    setInputValue: setQueueSearch,
    activeFilter: activeQueueSearch,
    isSearching,
  } = useDebouncedSearch();

  const [previousSectionName, setPreviousSectionName] = useState<string>("ALL");
  const [previousSections, setPreviousSections] = useState<string[]>([]);
  const [queueItems, setQueueItems] = useState<BOSYQueueItem[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState(25);
  const [queueLoading, setQueueLoading] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);


  const [revertTargetId, setRevertTargetId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertBusy, setRevertBusy] = useState(false);

  const [flushDialogOpen, setFlushDialogOpen] = useState(false);
  const [flushBusy, setFlushBusy] = useState(false);
  const [noShowItems, setNoShowItems] = useState<BOSYQueueItem[]>([]);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [confirmSingleTarget, setConfirmSingleTarget] = useState<BOSYQueueItem | null>(null);
  const [confirmSingleBusy, setConfirmSingleBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState<BOSYQueueItem | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);


  const fetchReadiness = useCallback(async () => {
    if (!syId) return;
    try {
      await Promise.all([
        getBOSYReadiness(syId).then(setReadiness),
        getPreviousSections(syId).then(setPreviousSections),
      ]);
    } catch (e) {
      toastApiError(e as never);
    }
  }, [syId]);



  const fetchQueue = useCallback(async () => {
    if (!syId) return;
    setQueueLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: statusFilter,
        search: activeQueueSearch || undefined,
        previousSectionName: previousSectionName !== "ALL" ? previousSectionName : undefined,
        page: queuePage,
        limit: queueLimit,
      });
      setQueueItems(data.items);
      setQueueTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setQueueLoading(false);
    }
  }, [syId, queuePage, queueLimit, statusFilter, activeQueueSearch, previousSectionName]);

  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);





  const handleConfirmSingle = (applicationId: number) => {
    const item = queueItems.find((i) => i.applicationId === applicationId);
    if (!item) return;
    setConfirmSingleTarget(item);
  };

  const executeConfirmSingle = async () => {
    if (!confirmSingleTarget) return;
    const { applicationId } = confirmSingleTarget;
    sileo.info({
      title: "Confirming Learner Return",
      description: "Submitting the learner record for BOSY sectioning readiness.",
    });
    setConfirmSingleBusy(true);
    setConfirmingIds((prev) => new Set(prev).add(applicationId));
    try {
      await confirmReturn(applicationId);
      sileo.success({
        title: "Learner Return Confirmed",
        description: "Application confirmed for sectioning.",
      });
      setQueueItems((prev) =>
        prev.filter((item) => item.applicationId !== applicationId),
      );
      setQueueTotal((prev) => Math.max(0, prev - 1));
      setConfirmSingleTarget(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
      setConfirmSingleBusy(false);
    }
  };

  const executeTransferRequest = async () => {
    if (!transferTarget) return;
    setTransferBusy(true);
    try {
      await markTransferRequest(transferTarget.applicationId);
      sileo.success({
        title: "Transfer Request Recorded",
        description:
          `${transferTarget.firstName} ${transferTarget.lastName} was moved to Transfer Requests.`,
      });
      setQueueItems((current) =>
        current.filter(
          (item) => item.applicationId !== transferTarget.applicationId,
        ),
      );
      setQueueTotal((current) => Math.max(0, current - 1));
      setTransferTarget(null);
      void fetchReadiness();
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0]);
    } finally {
      setTransferBusy(false);
    }
  };

  const pendingIdSet = new Set(queueItems.map((item) => item.applicationId));
  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((k) => Number(k))
    .filter((id) => pendingIdSet.has(id));

  const handleBulkConfirm = async () => {
    if (!syId || selectedIds.length === 0) return;
    sileo.info({
      title: "Processing Bulk Confirmation",
      description: "Applying BOSY confirmation to selected learner records.",
    });
    setBulkLoading(true);
    try {
      const result = await bulkConfirm({
        applicationIds: selectedIds,
        schoolYearId: syId,
      });
      if (result.confirmed.length > 0) {
        sileo.success({
          title: "Bulk Confirmation Completed",
          description: `${result.confirmed.length} learner(s) confirmed for sectioning.`,
        });
        setQueueItems((prev) =>
          prev.filter((item) => !result.confirmed.includes(item.applicationId)),
        );
        setQueueTotal((prev) => Math.max(0, prev - result.confirmed.length));
      }
      if (result.failed.length > 0) {
        sileo.warning({
          title: "Partial Confirmation Result",
          description: `${result.failed.length} application(s) could not be confirmed.`,
        });
      }
      setRowSelection({});
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleRevertToPending = async () => {
    if (!revertTargetId || revertReason.trim().length < 5) return;
    setRevertBusy(true);
    try {
      await apiRevertToPendingBeef(revertTargetId, revertReason.trim());
      sileo.success({
        title: "Flagged for Review",
        description: "Learner has been moved back to the BEEF intake queue.",
      });
      setRevertTargetId(null);
      setRevertReason("");
      void fetchQueue();
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setRevertBusy(false);
    }
  };

  useEffect(() => {
    if (!flushDialogOpen || !syId) {
      if (!flushDialogOpen) setNoShowItems([]);
      return;
    }
    setNoShowLoading(true);
    Promise.all([
      getBOSYQueue({ schoolYearId: syId, status: "READY_FOR_ENROLLMENT", page: 1, limit: 500 }),
      getBOSYQueue({ schoolYearId: syId, status: "PENDING_BEEF", page: 1, limit: 500 }),
    ])
      .then(([rfe, pb]) => setNoShowItems([...rfe.items, ...pb.items]))
      .catch((e) => toastApiError(e as never))
      .finally(() => setNoShowLoading(false));
  }, [flushDialogOpen, syId]);

  const handleFlushNoShows = async () => {
    if (!syId) return;
    const ids = noShowItems.map((i) => i.applicationId);
    if (ids.length === 0) {
      sileo.success({ title: "No No-Shows", description: "No eligible records to flush." });
      setFlushDialogOpen(false);
      return;
    }
    setFlushBusy(true);
    try {
      const result = await apiFlushNoShows(ids, "Admin flush of no-show SCP applicants");
      sileo.success({
        title: "No-Shows Flushed",
        description: `${result.flushed} record(s) withdrawn. ${result.skipped} skipped.`,
      });
      setNoShowItems([]);
      setFlushDialogOpen(false);
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setFlushBusy(false);
    }
  };

  return (
    <div
      className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6"
    >
      <PhaseBanner />
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold">Confirmation of Continuing Learners</h1>
          <p className="text-base leading-tight font-extrabold">
            Record which learners are returning before assigning their class sections for S.Y. {ayLabel || "2026–2027"}.
          </p>
          {isHistoricalReadOnly && (
            <p className="text-base font-extrabold text-amber-600 mt-0.5">Viewing archived data — all confirmation actions are disabled.</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/monitoring/enrollment?tab=sectioning")}
          className="font-extrabold"
        >
          Open Section Assignment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Pending Confirmations",
            subBadge: "Waiting for the learner or parent to confirm",
            value: readiness?.pendingConfirmationCount ?? 0,
            filterVal: "PENDING_CONFIRMATION",
            actionText: "Review Enrollees →",
            isPrimaryMetric: false,
          },
          {
            label: "Confirmed and Ready for Section Assignment",
            subBadge: `Included in the S.Y. ${ayLabel || "2026–2027"} enrollment total`,
            value: readiness?.readyForSectioningCount ?? 0,
            filterVal: "READY_FOR_SECTIONING",
            actionText: "View Masterlist →",
            isPrimaryMetric: true,
          },
          {
            label: "Transfer Requests (SF10)",
            subBadge: "Moving to Another School",
            value: readiness?.transferRequestCount ?? 0,
            filterVal: "TRANSFERRING_OUT",
            actionText: "Process Transfers →",
            isPrimaryMetric: false,
          },
        ].map(({ label, subBadge, value, filterVal, isPrimaryMetric }) => (
          <Card
            key={label}
            onClick={() => {
              setStatusFilter(filterVal);
              setQueuePage(1);
              setRowSelection({});
            }}
            className={cn(
              "shadow-sm cursor-pointer transition-all border flex flex-col",
              statusFilter === filterVal ? "border-slate-300 bg-slate-50 ring-1 ring-slate-200" : "border-slate-200 bg-white hover:border-slate-300"
            )}>
            <CardContent className="p-4 flex flex-row h-full justify-between gap-4">
              <div className="flex flex-col justify-between">
                <p className="text-base font-extrabold leading-tight text-foreground">
                  {label}
                </p>
                <div className="mt-4">
                  <p
                    className={cn("text-4xl font-extrabold leading-none", isPrimaryMetric && value > 0 ? "" : "text-foreground")}
                    style={isPrimaryMetric && value > 0 ? { color: "hsl(var(--primary))" } : undefined}
                  >
                    {value}
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{subBadge}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-wrap lg:flex-nowrap items-end gap-3">
            <div className="relative w-full lg:w-1/2 shrink-0">
              <span className="text-base font-extrabold text-foreground">Search Learner</span>
              <Search className="absolute left-2.5 h-4 w-4 bottom-3.5 text-foreground" />
              <Input
                placeholder="Search by LRN, Last Name, or First Name..."
                className="pl-9 h-10 w-full text-base font-semibold mt-2"
                value={queueSearch}
                onChange={(e) => {
                  setQueueSearch(e.target.value);
                  startTransition(() => {
                    setQueuePage(1);
                  });
                }}
              />
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-end gap-3 flex-1 lg:justify-end">
              {canMutate && statusFilter === "PENDING_CONFIRMATION" && selectedIds.length > 0 ? (
                <div className="flex items-center gap-2">
                  <BulkConfirmBar
                    selectedCount={selectedIds.length}
                    loading={bulkLoading}
                    onConfirm={() => void handleBulkConfirm()}
                    onClear={() => setRowSelection({})}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <span className="text-base font-extrabold text-foreground">Target Grade</span>
                    <Select
                      value={targetGrade}
                      onValueChange={(val) => {
                        setTargetGrade(val);
                        setQueuePage(1);
                        setRowSelection({});
                      }}
                    >
                      <SelectTrigger className="w-full sm:min-w-[210px] bg-white h-10 whitespace-nowrap text-base font-semibold">
                        <SelectValue placeholder="All Returning Grades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-base">All Returning Grades</SelectItem>
                        <SelectItem value="8" className="text-base">Incoming Grade 8</SelectItem>
                        <SelectItem value="9" className="text-base">Incoming Grade 9</SelectItem>
                        <SelectItem value="10" className="text-base">Incoming Grade 10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <span className="text-base font-extrabold text-foreground">Prior Section</span>
                    <Select
                      value={previousSectionName}
                      onValueChange={(val) => {
                        setPreviousSectionName(val);
                        startTransition(() => setQueuePage(1));
                      }}
                    >
                      <SelectTrigger className="h-10 w-full sm:w-64 text-base font-semibold whitespace-nowrap">
                        <SelectValue placeholder="All Previous Sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-base font-semibold">All Previous Sections</SelectItem>
                        {previousSections
                          .filter((sec) => typeof sec === "string" && sec.trim() !== "")
                          .map((sec) => (
                            <SelectItem key={sec} value={sec} className="text-base font-semibold">
                              {sec}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
        <CardContent className="p-0 flex flex-col min-h-0">
          <div className="overflow-auto bg-muted/5 w-full max-w-full">
            <QueueTable
              priorSyLabel={priorSyLabel}
              items={queueItems}
              loading={queueLoading}
              isSearching={isSearching}
              showConfirmAction={statusFilter === "PENDING_CONFIRMATION" && canMutate}
              rowSelection={statusFilter === "PENDING_CONFIRMATION" ? rowSelection : {}}
              onRowSelectionChange={setRowSelection}
              onConfirmSingle={handleConfirmSingle}
              onTransferRequest={setTransferTarget}
              confirmingIds={confirmingIds}
            />
          </div>
          <PaginationBar
            page={queuePage}
            total={queueTotal}
            limit={queueLimit}
            onPageChange={setQueuePage}
            onLimitChange={(l) => {
              setQueueLimit(l);
              setQueuePage(1);
            }}
            itemName="Learners"
          />
        </CardContent>
      </Card>

      {/* Confirm Single Return Dialog */}
      <Dialog
        open={confirmSingleTarget !== null}
        onOpenChange={(open) => { if (!open) setConfirmSingleTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Confirm Learner Return
            </DialogTitle>
            <DialogDescription>
              The following learner will be marked as{" "}
              <strong>Ready for Sectioning</strong>. This will complete their
              BOSY confirmation.
            </DialogDescription>
          </DialogHeader>
          {confirmSingleTarget && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1.5">
              <p className="text-base leading-tight font-extrabold uppercase">
                {confirmSingleTarget.lastName}, {confirmSingleTarget.firstName}
                {confirmSingleTarget.middleName
                  ? ` ${confirmSingleTarget.middleName.charAt(0)}.`
                  : ""}
              </p>
              <p className="text-base text-foreground font-extrabold">
                LRN: {confirmSingleTarget.lrn ?? "No LRN"}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] font-extrabold uppercase">
                {confirmSingleTarget.gradeLevelName}
              </Badge>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmSingleTarget(null)}
              disabled={confirmSingleBusy}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={confirmSingleBusy}
              onClick={() => void executeConfirmSingle()}>
              {confirmSingleBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferTarget !== null}
        onOpenChange={(open) => {
          if (!open && !transferBusy) setTransferTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Transfer Request</DialogTitle>
            <DialogDescription>
              Move this learner to Transfer Requests. The learner will not be
              included in enrollment totals or class assignment.
            </DialogDescription>
          </DialogHeader>
          {transferTarget && (
            <div className="rounded-md border bg-muted/40 px-4 py-3">
              <p className="font-extrabold">
                {transferTarget.lastName}, {transferTarget.firstName}
              </p>
              <p className="text-sm font-semibold">
                {transferTarget.gradeLevelName}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={transferBusy}
              onClick={() => setTransferTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={transferBusy}
              onClick={() => void executeTransferRequest()}
            >
              {transferBusy && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Mark as Transfer Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert to Pending Dialog */}
      <Dialog
        open={revertTargetId !== null}
        onOpenChange={(open) => { if (!open) { setRevertTargetId(null); setRevertReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              Flag for Review
            </DialogTitle>
            <DialogDescription>
              This will move the learner back to the BEEF intake queue
              (PENDING_BEEF). Provide a mandatory reason of at least 5 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Reason for reverting (min. 5 characters)…"
              value={revertReason}
              onChange={(e) => setRevertReason(e.target.value)}
              rows={3}
              className="resize-none font-extrabold text-base leading-tight"
            />
            {revertReason.length > 0 && revertReason.trim().length < 5 && (
              <p className="text-base text-destructive font-extrabold">
                Reason must be at least 5 characters.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setRevertTargetId(null); setRevertReason(""); }}
              disabled={revertBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revertBusy || revertReason.trim().length < 5}
              onClick={() => void handleRevertToPending()}>
              {revertBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1.5" />
              )}
              Revert to Pending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flush No-Shows Dialog */}
      <Dialog
        open={flushDialogOpen}
        onOpenChange={(open) => {
          setFlushDialogOpen(open);
          if (!open) setNoShowItems([]);
        }}
      >
        <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Flush No-Shows
            </DialogTitle>
            <DialogDescription>
              {noShowLoading
                ? "Loading no-show applicants…"
                : noShowItems.length > 0
                  ? `${noShowItems.length} SCP applicant${noShowItems.length !== 1 ? "s" : ""
                  } in Ready for Enrollment or Pending (Incomplete) status have not reported. Confirming will withdraw all of them. This cannot be undone.`
                  : "No eligible no-show applicants found for this school year."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-3">
            {noShowLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-foreground" />
              </div>
            ) : noShowItems.length > 0 ? (
              <>
                <DataTable
                  columns={FLUSH_NO_SHOW_COLUMNS}
                  data={noShowItems}
                  dense
                  getRowId={(row) => String(row.applicationId)}
                  containerHeight="14rem"
                  estimatedRowHeight={32}
                />
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-base text-destructive font-extrabold">
                  This is a destructive bulk operation. Only proceed if these
                  learners have confirmed they will not be attending.
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-16 text-base leading-tight text-foreground font-extrabold gap-2">
                <CheckCircle2 className="h-4 w-4 opacity-50" />
                No no-show applicants found.
              </div>
            )}
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => { setFlushDialogOpen(false); setNoShowItems([]); }}
              disabled={flushBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={flushBusy || noShowLoading || noShowItems.length === 0}
              onClick={() => void handleFlushNoShows()}>
              {flushBusy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Confirm Flush
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
