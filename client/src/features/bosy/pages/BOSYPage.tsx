import { useState, useEffect, useCallback, startTransition } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import { motion } from "motion/react";
import { useDebounce } from "@/shared/hooks/useDebounce";
import type { RowSelectionState } from "@tanstack/react-table";

import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirm,
  syncBOSYQueue,
  getJHSCompleters,
} from "../api/bosy.api";
import type { BOSYReadiness, BOSYQueueItem, JHSCompleter } from "../types";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { useSettingsStore } from "@/store/settings.slice";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/utils";
import { QueueTable } from "../components/QueueTable";
import { JHSCompleterTable } from "../components/JHSCompleterTable";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { BulkConfirmBar } from "../components/BulkConfirmBar";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";

export default function BOSYPage() {
  const { activeSchoolYearId, activeSchoolYearLabel, viewingSchoolYearId } =
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

  const [activeTab, setActiveTab] = useState("pending");
  const [queueSearch, setQueueSearch] = useState("");
  const debouncedSearch = useDebounce(queueSearch, 300);

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
    setSyncing(true);
    try {
      const res = await syncBOSYQueue(syId);
      sileo.success({
        title: "Synchronization Complete",
        description: `Successfully repaired ${res.created} learner record(s).`,
      });
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
        search: debouncedSearch || undefined,
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
  }, [syId, debouncedSearch, pendingPage, pendingLimit]);

  const fetchConfirmed = useCallback(async () => {
    if (!syId) return;
    setConfirmedLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "READY_FOR_SECTIONING",
        search: debouncedSearch || undefined,
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
  }, [syId, debouncedSearch, confirmedPage, confirmedLimit]);

  const fetchDropped = useCallback(async () => {
    if (!syId) return;
    setDroppedLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "TRANSFERRED_OUT",
        search: debouncedSearch || undefined,
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
  }, [syId, debouncedSearch, droppedPage, droppedLimit]);

  const fetchCompleters = useCallback(async () => {
    if (!syId) return;
    setCompletersLoading(true);
    try {
      const data = await getJHSCompleters({
        schoolYearId: syId,
        search: debouncedSearch || undefined,
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
  }, [syId, debouncedSearch, completersPage, completersLimit]);

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

  const handleRefresh = () => {
    void fetchReadiness();
    if (activeTab === "pending") void fetchPending();
    else if (activeTab === "confirmed") void fetchConfirmed();
    else if (activeTab === "dropped") void fetchDropped();
    else if (activeTab === "completers") void fetchCompleters();
  };

  const handleConfirmSingle = async (applicationId: number) => {
    setConfirmingIds((prev) => new Set(prev).add(applicationId));
    try {
      await confirmReturn(applicationId);
      sileo.success({
        title: "Return Confirmed",
        description: `Application confirmed for sectioning.`,
      });
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
    setBulkLoading(true);
    try {
      const result = await bulkConfirm({
        applicationIds: selectedIds,
        schoolYearId: syId,
      });
      if (result.confirmed.length > 0) {
        sileo.success({
          title: "Bulk Confirm Complete",
          description: `${result.confirmed.length} learner(s) confirmed for sectioning.`,
        });
        setPendingItems((prev) =>
          prev.filter((item) => !result.confirmed.includes(item.applicationId)),
        );
        setPendingTotal((prev) => Math.max(0, prev - result.confirmed.length));
      }
      if (result.failed.length > 0) {
        sileo.warning({
          title: "Some items failed",
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

  return (
    <div className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">BOSY Confirmation</h1>
          <p className="text-sm font-bold">
            Beginning of School Year — Continuing Learner Management
            {activeSchoolYearLabel ? ` · ${activeSchoolYearLabel}` : ""}
          </p>
          {isHistoricalReadOnly && (
            <p className="text-xs font-bold text-amber-600 mt-0.5">Viewing archived data — all confirmation actions are disabled.</p>
          )}
        </div>
        <div className="flex items-center w-full md:w-auto gap-2">
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
      </div>

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
              <div className="overflow-auto bg-muted/5">
                <QueueTable
                  items={pendingItems}
                  loading={pendingLoading}
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
              <div className="overflow-auto bg-muted/5">
                <QueueTable
                  items={confirmedItems}
                  loading={confirmedLoading}
                  showConfirmAction={false}
                  rowSelection={{}}
                  onRowSelectionChange={() => {}}
                  onConfirmSingle={() => {}}
                  confirmingIds={new Set()}
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
              <div className="overflow-auto bg-muted/5">
                <QueueTable
                  items={droppedItems}
                  loading={droppedLoading}
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
              <div className="overflow-auto bg-muted/5">
                <JHSCompleterTable
                  items={completersItems}
                  loading={completersLoading}
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
    </div>
  );
}
