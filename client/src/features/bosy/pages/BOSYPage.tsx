import { useState, useEffect, useCallback, startTransition, useRef } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  LogOut,
  UserPlus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import type { RowSelectionState } from "@tanstack/react-table";

import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirm,
  syncBOSYQueue,
  getJHSCompleters,
  apiRevertToPendingBeef,
  apiFlushNoShows,
} from "../api/bosy.api";
import type { BOSYReadiness, BOSYQueueItem, JHSCompleter } from "../types";
import { Phase2IntakeHub } from "../components/Phase2IntakeHub";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useAuthStore } from "@/store/auth.slice";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
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
import { JHSCompleterTable } from "../components/JHSCompleterTable";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { BulkConfirmBar } from "../components/BulkConfirmBar";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import {
  getReducedMotionProps,
  listVariants,
  panelTransition,
  sectionVariants,
  staggerTransition,
} from "@/shared/lib/motion";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";

export default function BOSYPage() {
  const navigate = useNavigate();
  const { activeSchoolYearId, activeSchoolYearLabel, viewingSchoolYearId } =
    useSettingsStore();
  const { user } = useAuthStore();
  const isSystemAdmin = user?.role === "SYSTEM_ADMIN";
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

  const [activeTab, setActiveTab] = useState("pending");
  const {
    inputValue: queueSearch,
    setInputValue: setQueueSearch,
    activeFilter: activeQueueSearch,
    isSearching,
  } = useDebouncedSearch();

  // Pending Confirmation state
  const [pendingItems, setPendingItems] = useState<BOSYQueueItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLimit, setPendingLimit] = useState(25);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Confirmed state
  const [confirmedItems, setConfirmedItems] = useState<BOSYQueueItem[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedPage, setConfirmedPage] = useState(1);
  const [confirmedLimit, setConfirmedLimit] = useState(25);
  const [confirmedLoading, setConfirmedLoading] = useState(false);

  // Transferred Out / Dropped state
  const [droppedItems, setDroppedItems] = useState<BOSYQueueItem[]>([]);
  const [droppedTotal, setDroppedTotal] = useState(0);
  const [droppedPage, setDroppedPage] = useState(1);
  const [droppedLimit, setDroppedLimit] = useState(25);
  const [droppedLoading, setDroppedLoading] = useState(false);

  // JHS Completers state
  const [completersItems, setCompletersItems] = useState<JHSCompleter[]>([]);
  const [completersTotal, setCompletersTotal] = useState(0);
  const [completersPage, setCompletersPage] = useState(1);
  const [completersLimit, setCompletersLimit] = useState(25);
  const [completersLoading, setCompletersLoading] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"continuing" | "phase2">("continuing");

  // Revert to pending state
  const [revertTargetId, setRevertTargetId] = useState<number | null>(null);
  const [revertReason, setRevertReason] = useState("");
  const [revertBusy, setRevertBusy] = useState(false);

  // Flush no-shows state
  const [flushDialogOpen, setFlushDialogOpen] = useState(false);
  const [flushBusy, setFlushBusy] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const isUserInteracting = isSearchFocused || isTableHovered;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const motionState = getReducedMotionProps(shouldReduceMotion);

  const fetchReadiness = useCallback(async () => {
    if (!syId) return;
    setReadinessLoading(true);
    try {
      const data = await getBOSYReadiness(syId);
      setReadiness(data);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setReadinessLoading(false);
    }
  }, [syId]);

  const handleSync = async () => {
    if (!syId) return;
    lifecycleFeedback.progress(
      "Synchronizing BOSY Queue",
      "Refreshing continuing-learner records for the active academic year.",
    );
    setSyncing(true);
    try {
      const res = await syncBOSYQueue(syId);
      lifecycleFeedback.success(
        "BOSY Synchronization Complete",
        `Successfully repaired ${res.created} learner record(s).`,
      );
      void handleRefresh();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setSyncing(false);
    }
  };

  const fetchPending = useCallback(async () => {
    if (!syId) return;
    setPendingLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "PENDING_CONFIRMATION",
        search: activeQueueSearch || undefined,
        page: pendingPage,
        limit: pendingLimit,
      });
      setPendingItems(data.items);
      setPendingTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setPendingLoading(false);
    }
  }, [syId, activeQueueSearch, pendingPage, pendingLimit]);

  const fetchConfirmed = useCallback(async () => {
    if (!syId) return;
    setConfirmedLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "READY_FOR_SECTIONING",
        search: activeQueueSearch || undefined,
        page: confirmedPage,
        limit: confirmedLimit,
      });
      setConfirmedItems(data.items);
      setConfirmedTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setConfirmedLoading(false);
    }
  }, [syId, activeQueueSearch, confirmedPage, confirmedLimit]);

  const fetchDropped = useCallback(async () => {
    if (!syId) return;
    setDroppedLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "TRANSFERRED_OUT",
        search: activeQueueSearch || undefined,
        page: droppedPage,
        limit: droppedLimit,
      });
      setDroppedItems(data.items);
      setDroppedTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setDroppedLoading(false);
    }
  }, [syId, activeQueueSearch, droppedPage, droppedLimit]);

  const fetchCompleters = useCallback(async () => {
    if (!syId) return;
    setCompletersLoading(true);
    try {
      const data = await getJHSCompleters({
        schoolYearId: syId,
        search: activeQueueSearch || undefined,
        page: completersPage,
        limit: completersLimit,
      });
      setCompletersItems(data.items);
      setCompletersTotal(data.total);
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setCompletersLoading(false);
    }
  }, [syId, activeQueueSearch, completersPage, completersLimit]);

  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  useEffect(() => {
    if (activeTab === "pending") void fetchPending();
  }, [activeTab, fetchPending]);

  useEffect(() => {
    if (activeTab === "confirmed") void fetchConfirmed();
  }, [activeTab, fetchConfirmed]);

  useEffect(() => {
    if (activeTab === "dropped") void fetchDropped();
  }, [activeTab, fetchDropped]);

  useEffect(() => {
    if (activeTab === "completers") void fetchCompleters();
  }, [activeTab, fetchCompleters]);

  // ── Auto-polling: refresh readiness + active tab data every 5 seconds ────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (typeof syId !== "number" || isUserInteracting) return;

    const tick = () => {
      void fetchReadiness();
      if (activeTab === "pending") void fetchPending();
      else if (activeTab === "confirmed") void fetchConfirmed();
      else if (activeTab === "dropped") void fetchDropped();
      else if (activeTab === "completers") void fetchCompleters();
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
    activeTab,
    isUserInteracting,
    fetchReadiness,
    fetchPending,
    fetchConfirmed,
    fetchDropped,
    fetchCompleters,
  ]);

  const handleRefresh = () => {
    void fetchReadiness();
    if (activeTab === "pending") void fetchPending();
    else if (activeTab === "confirmed") void fetchConfirmed();
    else if (activeTab === "dropped") void fetchDropped();
    else if (activeTab === "completers") void fetchCompleters();
  };

  const handleConfirmSingle = async (applicationId: number) => {
    lifecycleFeedback.progress(
      "Confirming Learner Return",
      "Submitting the learner record for BOSY sectioning readiness.",
    );
    setConfirmingIds((prev) => new Set(prev).add(applicationId));
    try {
      await confirmReturn(applicationId);
      lifecycleFeedback.success(
        "Learner Return Confirmed",
        "Application confirmed for sectioning.",
      );
      setPendingItems((prev) =>
        prev.filter((item) => item.applicationId !== applicationId),
      );
      setPendingTotal((prev) => Math.max(0, prev - 1));
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const pendingIdSet = new Set(pendingItems.map((item) => item.applicationId));
  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((k) => Number(k))
    .filter((id) => pendingIdSet.has(id));

  const handleBulkConfirm = async () => {
    if (!syId || selectedIds.length === 0) return;
    lifecycleFeedback.progress(
      "Processing Bulk Confirmation",
      "Applying BOSY confirmation to selected learner records.",
    );
    setBulkLoading(true);
    try {
      const result = await bulkConfirm({
        applicationIds: selectedIds,
        schoolYearId: syId,
      });
      if (result.confirmed.length > 0) {
        lifecycleFeedback.success(
          "Bulk Confirmation Completed",
          `${result.confirmed.length} learner(s) confirmed for sectioning.`,
        );
        setPendingItems((prev) =>
          prev.filter((item) => !result.confirmed.includes(item.applicationId)),
        );
        setPendingTotal((prev) => Math.max(0, prev - result.confirmed.length));
      }
      if (result.failed.length > 0) {
        lifecycleFeedback.warning(
          "Partial Confirmation Result",
          `${result.failed.length} application(s) could not be confirmed.`,
        );
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
      lifecycleFeedback.success(
        "Flagged for Review",
        "Learner has been moved back to the BEEF intake queue.",
      );
      setRevertTargetId(null);
      setRevertReason("");
      void fetchConfirmed();
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setRevertBusy(false);
    }
  };

  const handleFlushNoShows = async () => {
    if (!syId) return;
    setFlushBusy(true);
    try {
      const queueData = await getBOSYQueue({
        schoolYearId: syId,
        status: "READY_FOR_ENROLLMENT",
        page: 1,
        limit: 500,
      });
      const pendingBeefData = await getBOSYQueue({
        schoolYearId: syId,
        status: "PENDING_BEEF",
        page: 1,
        limit: 500,
      });
      const ids = [
        ...queueData.items.map((i) => i.applicationId),
        ...pendingBeefData.items.map((i) => i.applicationId),
      ];
      if (ids.length === 0) {
        lifecycleFeedback.success("No No-Shows", "No eligible records to flush.");
        setFlushDialogOpen(false);
        return;
      }
      const result = await apiFlushNoShows(ids, "Admin flush of no-show SCP applicants");
      lifecycleFeedback.success(
        "No-Shows Flushed",
        `${result.flushed} record(s) withdrawn. ${result.skipped} skipped.`,
      );
      setFlushDialogOpen(false);
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setFlushBusy(false);
    }
  };

  const BOSY_TABS = [
    {
      key: "pending",
      label: "Pending Confirmation",
      count: readiness?.pendingConfirmationCount,
    },
    {
      key: "confirmed",
      label: "Confirmed (Walk-in & Portal)",
      count: readiness?.readyForSectioningCount,
    },
    {
      key: "dropped",
      label: "Transferred Out / Dropped",
      count: readiness?.droppedCount,
    },
    {
      key: "completers",
      label: "JHS Completers",
      count: readiness?.jhsCompleterCount,
    },
  ];

  const phase2TotalCount =
    (readiness?.scpPriorityCount ?? 0) +
    (readiness?.onlineBeefCount ?? 0) +
    (readiness?.walkInBeefCount ?? 0) +
    (readiness?.pendingBeefCount ?? 0);

  const WORKSPACE_VIEWS = [
    {
      key: "continuing" as const,
      label: "Continuing Learners",
      badge: readiness?.pendingConfirmationCount ?? 0,
    },
    {
      key: "phase2" as const,
      label: "Phase 2 Intake (BEEF)",
      badge: phase2TotalCount,
    },
  ];

  return (
    <motion.div
      className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6"
      variants={listVariants}
      transition={staggerTransition}
      {...motionState}>
      {/* CONDITIONALLY_PROMOTED blocker warning */}
      {readiness && readiness.irregularBlockerCount > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-start gap-3 rounded-xl border-2 border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 shadow-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-black uppercase text-xs">Rollover Blocked</p>
            <p className="font-bold text-sm mt-0.5">
              {readiness.irregularBlockerCount} learner
              {readiness.irregularBlockerCount !== 1 ? "s" : ""} remain
              CONDITIONALLY PROMOTED in EOSY. Resolve their remedial results
              before initiating year rollover.
            </p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        variants={sectionVariants}
        transition={panelTransition}>
        <div>
          <h1 className="text-3xl font-bold">BOSY Confirmation</h1>
          <p className="text-sm font-bold">
            Beginning of School Year Processing Hub
            {activeSchoolYearLabel ? ` · ${activeSchoolYearLabel}` : ""}
          </p>
          {isHistoricalReadOnly && (
            <p className="text-xs font-bold text-amber-600 mt-0.5">Viewing archived data — all confirmation actions are disabled.</p>
          )}
        </div>
        <div className="flex items-center w-full md:w-auto gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
              isUserInteracting
                ? "border-muted-foreground/30 text-muted-foreground"
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
          {workspaceView === "phase2" && (
            <Button
              variant="outline"
              className="h-10 px-3 text-sm font-bold border-red-200 text-red-700 hover:bg-red-50 shrink-0"
              onClick={() => navigate("/monitoring/enrollment/walk-in")}
              disabled={!canMutate}>
              <UserPlus className="h-4 w-4 mr-2" />
              + Walk-In BEEF
            </Button>
          )}
          {workspaceView === "continuing" && (
            <Button
              variant="outline"
              className="h-10 font-bold gap-2 bg-white border-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary transition-all"
              onClick={handleSync}
              disabled={syncing || readinessLoading || !canMutate}>
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Synchronize Roster
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 hover:bg-muted"
            title="Refresh Data"
            onClick={handleRefresh}
            disabled={
              readinessLoading ||
              pendingLoading ||
              confirmedLoading ||
              droppedLoading ||
              completersLoading
            }>
            <RefreshCw
              className={cn(
                "h-5 w-5",
                (readinessLoading ||
                  pendingLoading ||
                  confirmedLoading ||
                  droppedLoading ||
                  completersLoading) &&
                  "animate-spin",
              )}
            />
          </Button>
        </div>
      </motion.div>

      {/* ─── Top-Level Workspace Selector ─── */}
      <motion.div
        className="flex gap-1 bg-white border border-border rounded-xl p-1"
        variants={sectionVariants}
        transition={panelTransition}>
        {WORKSPACE_VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => setWorkspaceView(view.key)}
            className={cn(
              "relative flex-1 px-5 py-3 text-sm font-bold rounded-lg transition-colors",
              workspaceView === view.key
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}>
            {workspaceView === view.key && (
              <motion.div
                layoutId="bosy-workspace-pill"
                className="absolute inset-0 bg-primary rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {view.label}
              {view.badge > 0 && (
                <Badge
                  variant={workspaceView === view.key ? "secondary" : "outline"}
                  className="h-5 px-1.5 text-xs font-bold">
                  {view.badge}
                </Badge>
              )}
            </span>
          </button>
        ))}
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* VIEW 1 — CONTINUING LEARNERS               */}
      {/* ═══════════════════════════════════════════ */}
      {workspaceView === "continuing" && <>
      {/* Readiness stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: AlertCircle,
            label: "Pending Confirmation",
            value: readiness?.pendingConfirmationCount ?? 0,
          },
          {
            icon: CheckCircle2,
            label: "Confirmed (Returning)",
            value: readiness?.readyForSectioningCount ?? 0,
          },
          {
            icon: LogOut,
            label: "Transferred / Dropped",
            value: readiness?.droppedCount ?? 0,
          },
        ].map(({ icon: Icon, label, value }) => (
          <Card
            key={label}
            className="border-none shadow-sm bg-[hsl(var(--card))]">
            <CardHeader className="p-3 pb-1 flex-row items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                <Icon className="h-3.5 w-3.5 text-foreground" />
              </div>
              <p className="text-[10px] font-black uppercase text-muted-foreground leading-tight">
                {label}
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {readinessLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <p className="text-2xl font-black">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          setRowSelection({});
        }}
        className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1 bg-white border border-border relative">
          {BOSY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              {activeTab === tab.key && (
                <motion.div
                  layoutId="bosy-active-pill"
                  className="absolute inset-0 bg-primary rounded-md"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className="relative z-20 inline-flex items-center gap-2 text-xs sm:text-sm">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <Badge
                    variant={activeTab === tab.key ? "secondary" : "outline"}
                    className="h-5 px-1.5 text-xs font-bold">
                    {tab.count}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* PENDING CONFIRMATION */}
        <TabsContent
          value="pending"
          className="mt-3">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search LRN, First Name, Last Name..."
                  className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                  value={queueSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => {
                    setQueueSearch(e.target.value);
                    startTransition(() => {
                      setPendingPage(1);
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col min-h-0">
              <div
                className="overflow-auto bg-muted/5"
                onMouseEnter={() => setIsTableHovered(true)}
                onMouseLeave={() => setIsTableHovered(false)}
              >
                <QueueTable
                  items={pendingItems}
                  loading={pendingLoading}
                  isSearching={isSearching}
                  showConfirmAction={canMutate}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  onConfirmSingle={handleConfirmSingle}
                  confirmingIds={confirmingIds}
                />
              </div>
              <PaginationBar
                page={pendingPage}
                total={pendingTotal}
                limit={pendingLimit}
                onPageChange={setPendingPage}
                onLimitChange={(l) => {
                  setPendingLimit(l);
                  setPendingPage(1);
                }}
                itemName="Learners"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIRMED */}
        <TabsContent
          value="confirmed"
          className="mt-3">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search LRN, First Name, Last Name..."
                  className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                  value={queueSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => {
                    setQueueSearch(e.target.value);
                    startTransition(() => {
                      setConfirmedPage(1);
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col min-h-0">
              <div
                className="overflow-auto bg-muted/5"
                onMouseEnter={() => setIsTableHovered(true)}
                onMouseLeave={() => setIsTableHovered(false)}
              >
                <QueueTable
                  items={confirmedItems}
                  loading={confirmedLoading}
                  isSearching={isSearching}
                  showConfirmAction={false}
                  rowSelection={{}}
                  onRowSelectionChange={() => {}}
                  onConfirmSingle={() => {}}
                  confirmingIds={new Set()}
                  onRevertSingle={canMutate ? (id) => { setRevertTargetId(id); setRevertReason(""); } : undefined}
                />
              </div>
              <PaginationBar
                page={confirmedPage}
                total={confirmedTotal}
                limit={confirmedLimit}
                onPageChange={setConfirmedPage}
                onLimitChange={(l) => {
                  setConfirmedLimit(l);
                  setConfirmedPage(1);
                }}
                itemName="Learners"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* DROPPED / TRANSFERRED */}
        <TabsContent
          value="dropped"
          className="mt-3">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search LRN, First Name, Last Name..."
                  className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                  value={queueSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => {
                    setQueueSearch(e.target.value);
                    startTransition(() => {
                      setDroppedPage(1);
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col min-h-0">
              <div
                className="overflow-auto bg-muted/5"
                onMouseEnter={() => setIsTableHovered(true)}
                onMouseLeave={() => setIsTableHovered(false)}
              >
                <QueueTable
                  items={droppedItems}
                  loading={droppedLoading}
                  isSearching={isSearching}
                  showConfirmAction={false}
                  rowSelection={{}}
                  onRowSelectionChange={() => {}}
                  onConfirmSingle={() => {}}
                  confirmingIds={new Set()}
                />
              </div>
              <PaginationBar
                page={droppedPage}
                total={droppedTotal}
                limit={droppedLimit}
                onPageChange={setDroppedPage}
                onLimitChange={(l) => {
                  setDroppedLimit(l);
                  setDroppedPage(1);
                }}
                itemName="Learners"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* JHS COMPLETERS */}
        <TabsContent
          value="completers"
          className="mt-3">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search LRN, First Name, Last Name..."
                  className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                  value={queueSearch}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => {
                    setQueueSearch(e.target.value);
                    startTransition(() => {
                      setCompletersPage(1);
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col min-h-0">
              <div
                className="overflow-auto bg-muted/5"
                onMouseEnter={() => setIsTableHovered(true)}
                onMouseLeave={() => setIsTableHovered(false)}
              >
                <JHSCompleterTable
                  items={completersItems}
                  loading={completersLoading}
                  isSearching={isSearching}
                />
              </div>
              <PaginationBar
                page={completersPage}
                total={completersTotal}
                limit={completersLimit}
                onPageChange={setCompletersPage}
                onLimitChange={(l) => {
                  setCompletersLimit(l);
                  setCompletersPage(1);
                }}
                itemName="Completers"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canMutate && (
        <BulkConfirmBar
          selectedCount={selectedIds.length}
          loading={bulkLoading}
          onConfirm={() => void handleBulkConfirm()}
          onClear={() => setRowSelection({})}
        />
      )}
      </>}

      {/* ═══════════════════════════════════════════ */}
      {/* VIEW 2 — PHASE 2 INTAKE (BEEF)             */}
      {/* ═══════════════════════════════════════════ */}
      {workspaceView === "phase2" && (
        <>
          {/* SCP no-shows stat card + SYSTEM_ADMIN flush */}
          {isSystemAdmin && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
                  <LogOut className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-700">
                    SCP No-Shows (READY_FOR_ENROLLMENT + PENDING_BEEF)
                  </p>
                  {readinessLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600 mt-0.5" />
                  ) : (
                    <p className="text-xl font-black text-amber-900">
                      {(readiness?.scpPriorityCount ?? 0) + (readiness?.pendingBeefCount ?? 0)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0 font-bold"
                disabled={flushBusy || !canMutate}
                onClick={() => setFlushDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Flush No-Shows
              </Button>
            </div>
          )}

          <Phase2IntakeHub
            syId={syId}
            canMutate={canMutate}
            onDataChange={fetchReadiness}
          />
        </>
      )}

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
              className="resize-none font-medium text-sm"
            />
            {revertReason.length > 0 && revertReason.trim().length < 5 && (
              <p className="text-xs text-destructive font-bold">
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
      <Dialog open={flushDialogOpen} onOpenChange={setFlushDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Flush No-Shows
            </DialogTitle>
            <DialogDescription>
              All SCP applicants in READY_FOR_ENROLLMENT and PENDING_BEEF status
              will be set to WITHDRAWN. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive font-bold">
            This is a destructive bulk operation. Only proceed if these learners
            have confirmed they will not be attending.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFlushDialogOpen(false)}
              disabled={flushBusy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={flushBusy}
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
    </motion.div>
  );
}
