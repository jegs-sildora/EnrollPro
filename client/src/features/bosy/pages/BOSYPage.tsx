import { useState, useEffect, useCallback, startTransition } from "react";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  Users,
  GraduationCap,
  Loader2,
} from "lucide-react";
import { sileo } from "sileo";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { motion } from "motion/react";
import type { RowSelectionState } from "@tanstack/react-table";
import type { BOSYReadiness, BOSYQueueItem, JHSCompleter } from "../types";
import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  bulkConfirm,
  getJHSCompleters,
} from "../api/bosy.api";
import { QueueTable } from "../components/QueueTable";
import { BulkConfirmBar } from "../components/BulkConfirmBar";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { PaginationBar } from "@/shared/components/PaginationBar";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/shared/lib/utils";

const JHS_COMPLETER_COLUMNS: ColumnDef<JHSCompleter>[] = [
  {
    id: "learner",
    accessorKey: "lastName",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="LEARNER"
      />
    ),
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-xs">
          <span className="font-bold uppercase truncate">
            {r.lastName}, {r.firstName}
            {r.middleName ? ` ${r.middleName.charAt(0)}.` : ""}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            LRN: {r.lrn ?? "NO LRN"}
          </span>
        </div>
      );
    },
  },
  {
    id: "lastGradeLevel",
    accessorKey: "lastGradeLevel",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="LAST GRADE"
        className="justify-center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center">
        <Badge
          variant="outline"
          className="text-[10px] font-black uppercase">
          {row.original.lastGradeLevel ?? "—"}
        </Badge>
      </div>
    ),
    size: 90,
  },
  {
    id: "lastSection",
    accessorKey: "lastSectionName",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="LAST SECTION"
      />
    ),
    cell: ({ row }) => (
      <span className="text-xs font-semibold">
        {row.original.lastSectionName ?? "—"}
      </span>
    ),
  },
  {
    id: "lastYear",
    accessorKey: "lastYearEnrolled",
    header: ({ column }) => (
      <DataTableColumnHeader
        column={column}
        title="LAST SY"
        className="justify-center"
      />
    ),
    cell: ({ row }) => (
      <div className="text-center text-xs text-muted-foreground">
        {row.original.lastYearEnrolled ?? "—"}
      </div>
    ),
    size: 90,
  },
];

export default function BOSYPage() {
  // BOSY always operates on the active school year — never the viewing year
  const { activeSchoolYearId, activeSchoolYearLabel } = useSettingsStore();
  const syId = activeSchoolYearId;

  const [readiness, setReadiness] = useState<BOSYReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("pending");
  const [queueSearch, setQueueSearch] = useState("");
  const [jhsSearch, setJhsSearch] = useState("");

  // Pending Confirmation state
  const [pendingItems, setPendingItems] = useState<BOSYQueueItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLimit, setPendingLimit] = useState(25);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Ready for Sectioning state
  const [confirmedItems, setConfirmedItems] = useState<BOSYQueueItem[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedPage, setConfirmedPage] = useState(1);
  const [confirmedLimit, setConfirmedLimit] = useState(25);
  const [confirmedLoading, setConfirmedLoading] = useState(false);

  // JHS Completers state
  const [jhsItems, setJhsItems] = useState<JHSCompleter[]>([]);
  const [jhsTotal, setJhsTotal] = useState(0);
  const [jhsPage, setJhsPage] = useState(1);
  const [jhsLimit, setJhsLimit] = useState(25);
  const [jhsLoading, setJhsLoading] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchReadiness = useCallback(async () => {
    if (!syId) return;
    setReadinessLoading(true);
    try {
      const data = await getBOSYReadiness(syId);
      setReadiness(data);
    } catch (e) {
      toastApiError(e);
    } finally {
      setReadinessLoading(false);
    }
  }, [syId]);

  const fetchPending = useCallback(async () => {
    if (!syId) return;
    setPendingLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "PENDING_CONFIRMATION",
        search: queueSearch || undefined,
        page: pendingPage,
        limit: pendingLimit,
      });
      setPendingItems(data.items);
      setPendingTotal(data.total);
    } catch (e) {
      toastApiError(e);
    } finally {
      setPendingLoading(false);
    }
  }, [syId, queueSearch, pendingPage, pendingLimit]);

  const fetchConfirmed = useCallback(async () => {
    if (!syId) return;
    setConfirmedLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        status: "READY_FOR_SECTIONING",
        search: queueSearch || undefined,
        page: confirmedPage,
        limit: confirmedLimit,
      });
      setConfirmedItems(data.items);
      setConfirmedTotal(data.total);
    } catch (e) {
      toastApiError(e);
    } finally {
      setConfirmedLoading(false);
    }
  }, [syId, queueSearch, confirmedPage, confirmedLimit]);

  const fetchJHS = useCallback(async () => {
    if (!syId) return;
    setJhsLoading(true);
    try {
      const data = await getJHSCompleters({
        schoolYearId: syId,
        search: jhsSearch || undefined,
        page: jhsPage,
        limit: jhsLimit,
      });
      setJhsItems(data.items);
      setJhsTotal(data.total);
    } catch (e) {
      toastApiError(e);
    } finally {
      setJhsLoading(false);
    }
  }, [syId, jhsSearch, jhsPage, jhsLimit]);

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
    if (activeTab === "jhs") void fetchJHS();
  }, [activeTab, fetchJHS]);

  const handleRefresh = () => {
    void fetchReadiness();
    if (activeTab === "pending") void fetchPending();
    else if (activeTab === "confirmed") void fetchConfirmed();
    else if (activeTab === "jhs") void fetchJHS();
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
      toastApiError(e);
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((k) => {
      const item = pendingItems[Number(k)];
      return item?.applicationId;
    })
    .filter((id): id is number => id !== undefined);

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
      toastApiError(e);
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
      label: "Ready for Sectioning",
      count: readiness?.readyForSectioningCount,
    },
    {
      key: "jhs",
      label: "JHS Completers",
      count: readiness?.jhsCompleterCount,
    },
  ];

  return (
    <div className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6">
      {/* IRREGULAR blocker warning */}
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
          <h1 className="text-3xl font-bold">BOSY Registration</h1>
          <p className="text-sm font-bold">
            Beginning of School Year — Continuing Learner Management
            {activeSchoolYearLabel ? ` · ${activeSchoolYearLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center w-full md:w-auto gap-2">
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
              jhsLoading
            }>
            <RefreshCw
              className={cn(
                "h-5 w-5",
                (readinessLoading ||
                  pendingLoading ||
                  confirmedLoading ||
                  jhsLoading) &&
                  "animate-spin",
              )}
            />
          </Button>
        </div>
      </div>

      {/* Readiness stat cards — no hardcoded color classes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            icon: AlertCircle,
            label: "Pending Confirmation",
            value: readiness?.pendingConfirmationCount ?? 0,
          },
          {
            icon: CheckCircle2,
            label: "Ready for Sectioning",
            value: readiness?.readyForSectioningCount ?? 0,
          },
          {
            icon: Users,
            label: "Already Enrolled",
            value: readiness?.enrolledCount ?? 0,
          },
          {
            icon: GraduationCap,
            label: "JHS Completers",
            value: readiness?.jhsCompleterCount ?? 0,
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
                <p className="text-2xl font-black tabular-nums">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs — animated spring style matching Enrollment Management */}
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
                  showConfirmAction
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

        {/* READY FOR SECTIONING */}
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

        {/* JHS COMPLETERS */}
        <TabsContent
          value="jhs"
          className="mt-3">
          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                <Input
                  placeholder="Search LRN, First Name, Last Name..."
                  className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                  value={jhsSearch}
                  onChange={(e) => {
                    setJhsSearch(e.target.value);
                    startTransition(() => {
                      setJhsPage(1);
                    });
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col min-h-0">
              <div className="overflow-auto bg-muted/5">
                <DataTable
                  columns={JHS_COMPLETER_COLUMNS}
                  data={jhsItems}
                  loading={jhsLoading}
                />
              </div>
              <PaginationBar
                page={jhsPage}
                total={jhsTotal}
                limit={jhsLimit}
                onPageChange={setJhsPage}
                onLimitChange={(l) => {
                  setJhsLimit(l);
                  setJhsPage(1);
                }}
                itemName="Learners"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BulkConfirmBar
        selectedCount={selectedIds.length}
        loading={bulkLoading}
        onConfirm={() => void handleBulkConfirm()}
        onClear={() => setRowSelection({})}
      />
    </div>
  );
}
