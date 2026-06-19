import { useState, useEffect, useCallback, startTransition, useRef } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  LogOut,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";

import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirm,
  apiRevertToPendingBeef,
  apiFlushNoShows,
  getPreviousSections,
} from "../api/bosy.api";
import type { BOSYReadiness, BOSYQueueItem } from "../types";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
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
      <span className="font-mono font-bold text-base text-foreground">
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
        <span className="font-bold text-base leading-tight">
          {[lastName, firstName].filter(Boolean).join(", ")}
        </span>
      );
    },
  },
  {
    accessorKey: "gradeLevelName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Grade" />,
    cell: ({ row }) => (
      <Badge variant="secondary" className="text-base font-bold">
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
        className="text-base font-bold border-amber-300 text-amber-700 bg-amber-50"
      >
        {formatNoShowStatus(row.original.status)}
      </Badge>
    ),
    size: 160,
  },
];

export default function BOSYPage() {
  const { activeSchoolYearId, viewingSchoolYearId } =
    useSettingsStore();
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
  const [readinessLoading, setReadinessLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("PENDING_VERIFICATION");
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const isUserInteracting = isSearchFocused || isTableHovered;

  const fetchReadiness = useCallback(async () => {
    if (!syId) return;
    setReadinessLoading(true);
    try {
      await Promise.all([
        getBOSYReadiness(syId).then(setReadiness),
        getPreviousSections(syId).then(setPreviousSections),
      ]);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setReadinessLoading(false);
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

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (typeof syId !== "number" || isUserInteracting) return;

    const tick = () => {
      void fetchReadiness();
      void fetchQueue();
    };

    const intervalId = setInterval(tick, 5_000);
    pollingRef.current = intervalId;
    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [
    syId,
    isUserInteracting,
    fetchReadiness,
    fetchQueue,
  ]);

  const handleRefresh = () => {
    void fetchReadiness();
    void fetchQueue();
  };

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
          <h1 className="text-3xl font-bold">Early Registration (BOSY)</h1>
          <p className="text-base leading-tight font-bold">
            Fast-track LRN verification and intent-to-enroll confirmation for continuing Grade 8–10 learners.
          </p>
          {isHistoricalReadOnly && (
            <p className="text-base font-bold text-amber-600 mt-0.5">Viewing archived data — all confirmation actions are disabled.</p>
          )}
        </div>
        <div className="flex items-center w-full md:w-auto gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
              isUserInteracting
                ? "border-muted-foreground/30 text-foreground"
                : "border-emerald-200 text-emerald-700",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                isUserInteracting ? "bg-muted-foreground/60" : "bg-emerald-500 animate-pulse",
              )}
            />
            {isUserInteracting ? "Paused" : "Live Sync"}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-base leading-tight font-bold text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleRefresh}
            disabled={readinessLoading || queueLoading}>
            <RefreshCw
              className={cn(
                "h-4 w-4 mr-2",
                (readinessLoading || queueLoading) && "animate-spin",
              )}
            />
            Refresh Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: AlertCircle,
            label: "Pending Confirmation",
            value: readiness?.pendingConfirmationCount ?? 0,
            filterVal: "PENDING_VERIFICATION",
          },
          {
            icon: CheckCircle2,
            label: "Confirmed (Returning)",
            value: readiness?.readyForSectioningCount ?? 0,
            filterVal: "READY_FOR_SECTIONING",
          },
          {
            icon: LogOut,
            label: "Transferred / Dropped",
            value: readiness?.droppedCount ?? 0,
            filterVal: "TRANSFERRED_OUT",
          },
        ].map(({ icon: Icon, label, value, filterVal }) => (
          <Card
            key={label}
            onClick={() => {
              setStatusFilter(filterVal);
              setQueuePage(1);
              setRowSelection({});
            }}
            className={cn(
              "shadow-sm cursor-pointer transition-colors border-2",
              statusFilter === filterVal ? "border-primary bg-primary/5" : "border-transparent bg-[hsl(var(--card))] hover:border-primary/50"
            )}>
            <CardHeader className="p-3 pb-1 flex-row items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg shrink-0",
                statusFilter === filterVal ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-[10px] font-black uppercase text-foreground leading-tight">
                {label}
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {readinessLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-foreground" />
              ) : (
                <p className="text-2xl font-black">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
              <Input
                placeholder="Search LRN, First Name, Last Name..."
                className="pl-10 h-11 text-base leading-tight font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                value={queueSearch}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onChange={(e) => {
                  setQueueSearch(e.target.value);
                  startTransition(() => {
                    setQueuePage(1);
                  });
                }}
              />
            </div>
            {canMutate && statusFilter === "PENDING_VERIFICATION" && selectedIds.length > 0 ? (
              <BulkConfirmBar
                selectedCount={selectedIds.length}
                loading={bulkLoading}
                onConfirm={() => void handleBulkConfirm()}
                onClear={() => setRowSelection({})}
              />
            ) : (
              <Select
                value={previousSectionName}
                onValueChange={(val) => {
                  setPreviousSectionName(val);
                  startTransition(() => setQueuePage(1));
                }}>
                <SelectTrigger className="w-full md:w-[260px] h-11 bg-muted/30 border-2 border-transparent hover:border-primary/20 transition-all text-base leading-tight font-bold">
                  <SelectValue placeholder="Filter by Previous Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Previous Sections</SelectItem>
                  {previousSections.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      {sec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex flex-col min-h-0">
          <div
            className="overflow-auto bg-muted/5"
            onMouseEnter={() => setIsTableHovered(true)}
            onMouseLeave={() => setIsTableHovered(false)}
          >
            <QueueTable
              items={queueItems}
              loading={queueLoading}
              isSearching={isSearching}
              showConfirmAction={statusFilter === "PENDING_VERIFICATION" && canMutate}
              rowSelection={statusFilter === "PENDING_VERIFICATION" ? rowSelection : {}}
              onRowSelectionChange={setRowSelection}
              onConfirmSingle={handleConfirmSingle}
              confirmingIds={confirmingIds}
              onRevertSingle={statusFilter === "READY_FOR_SECTIONING" && canMutate ? (id) => { setRevertTargetId(id); setRevertReason(""); } : undefined}
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
              <p className="text-base leading-tight font-bold uppercase">
                {confirmSingleTarget.lastName}, {confirmSingleTarget.firstName}
                {confirmSingleTarget.middleName
                  ? ` ${confirmSingleTarget.middleName.charAt(0)}.`
                  : ""}
              </p>
              <p className="text-base text-foreground font-bold">
                LRN: {confirmSingleTarget.lrn ?? "No LRN"}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] font-black uppercase">
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
              className="resize-none font-bold text-base leading-tight"
            />
            {revertReason.length > 0 && revertReason.trim().length < 5 && (
              <p className="text-base text-destructive font-bold">
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
                  ? `${noShowItems.length} SCP applicant${
                      noShowItems.length !== 1 ? "s" : ""
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
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-base text-destructive font-bold">
                  This is a destructive bulk operation. Only proceed if these
                  learners have confirmed they will not be attending.
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-16 text-base leading-tight text-foreground font-bold gap-2">
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
