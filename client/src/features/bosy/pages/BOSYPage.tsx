import { motion, AnimatePresence } from "motion/react";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  startTransition,
} from "react";
import { usePaginationLimit } from '@/shared/hooks/usePaginationLimit';

import {
  Search,
} from "lucide-react";

import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { useHeaderStore } from "@/store/header.slice";
import type { RowSelectionState } from "@tanstack/react-table";

import {
  getBOSYReadiness,
  getBOSYQueue,
  confirmReturn,
  markTransferRequest,
  revokeConfirmedReturn,
  markConfirmedTransferOut,
  bulkConfirm,
  getPreviousSections,
  syncBOSYQueue,
} from "../api/bosy.api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/queryKeys";
import type {
  BOSYReadiness,
  BOSYQueueItem,
  BOSYQueueState,
} from "../types";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import {
  createFadeShiftVariants,
  createMotionTransition,
  getReducedMotionProps,
  motionTokens,
  useMotionPreferences,
} from "@/shared/lib/motion";
import { QueueTable } from "../components/QueueTable";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { BulkConfirmBar } from "../components/BulkConfirmBar";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { VerificationWorkspace } from "@/features/enrollment/components/VerificationWorkspace";
import { useRealtimeRefresh } from "@/shared/hooks/useRealtimeRefresh";
import type { RealtimeInvalidationTopic } from "@enrollpro/shared";
import { useGuardedTabChange } from "@/shared/hooks/useUnsavedChanges";
import { useSearchParams } from "react-router";

import { sileo } from "sileo";

const BOSY_REALTIME_TOPICS: RealtimeInvalidationTopic[] = [
  "bosy:queue",
  "bosy:readiness",
  "enrollment:applications",
  "students:list",
  "school-years:list",
];

export default function BOSYPage() {
  const [searchParams] = useSearchParams();
  const motionPreferences = useMotionPreferences();
  const tabPanelVariants = createFadeShiftVariants(
    motionPreferences,
    "y",
    "y",
    "sm",
  );

  const queryClient = useQueryClient();
  const { activeSchoolYearId, viewingSchoolYearId } =
    useSettingsStore();
  const { ayLabel } = useSchoolYearContext();
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
  const repairedSchoolYearRef = useRef<number | null>(null);

  const [queueState, setQueueState] = useState<BOSYQueueState>("PENDING");
  const targetGrade = useSettingsStore((s) => s.uiPreferences.bosyGradeId);
  const setTargetGrade = (grade: string) => useSettingsStore.getState().updateUiPreference("bosyGradeId", grade);
  const {
    inputValue: queueSearch,
    setInputValue: setQueueSearch,
    activeFilter: activeQueueSearch,
    isSearching,
  } = useDebouncedSearch();

  const [previousSectionName, setPreviousSectionName] = useState<string>("ALL");
  const [previousSections, setPreviousSections] = useState<string[]>([]);
  const [curricularProgram, setCurricularProgram] = useState<string>("ALL");
  const [intakeCategory, setIntakeCategory] = useState<string>("ALL");
  const [verificationStatus, setVerificationStatus] = useState<string>("ALL");
  const [queueItems, setQueueItems] = useState<BOSYQueueItem[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [repairReadySchoolYearId, setRepairReadySchoolYearId] =
    useState<number | null>(null);
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = usePaginationLimit(50);
  const [queueLoading, setQueueLoading] = useState(false);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [busyActionIds, setBusyActionIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);


  const [confirmSingleTarget, setConfirmSingleTarget] = useState<BOSYQueueItem | null>(null);
  const [confirmSingleBusy, setConfirmSingleBusy] = useState(false);
  const [transferTarget, setTransferTarget] = useState<BOSYQueueItem | null>(null);
  const [transferMode, setTransferMode] = useState<"PENDING" | "CONFIRMED">("PENDING");
  const [transferBusy, setTransferBusy] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<BOSYQueueItem | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);


  const fetchReadiness = useCallback(async () => {
    if (!syId) return;
    try {
      if (
        syId === activeSchoolYearId &&
        canMutate &&
        repairedSchoolYearRef.current !== syId
      ) {
        repairedSchoolYearRef.current = syId;
        try {
          const repairResult = await syncBOSYQueue(syId);
          if (repairResult.created > 0) {
            sileo.success({
              title: "Learner Enrollment Queue Restored",
              description:
                `${repairResult.created} learner record(s) were recovered from the previous school year.`,
            });
          }
        } catch (e) {
          repairedSchoolYearRef.current = null;
          throw e;
        }
      }
      setRepairReadySchoolYearId(syId);
      await Promise.all([
        getBOSYReadiness(syId).then(setReadiness),
        getPreviousSections(syId).then(setPreviousSections),
      ]);
    } catch (e) {
      toastApiError(e as never);
    }
  }, [activeSchoolYearId, canMutate, syId]);



  const fetchQueue = useCallback(async () => {
    if (!syId || repairReadySchoolYearId !== syId) return;
    setQueueLoading(true);
    try {
      const data = await getBOSYQueue({
        schoolYearId: syId,
        queueState,
        targetGradeOrder:
          targetGrade === "ALL" ? undefined : Number(targetGrade),
        search: activeQueueSearch || undefined,
        previousSectionName: previousSectionName !== "ALL" ? previousSectionName : undefined,
        curricularProgram: curricularProgram !== "ALL" ? curricularProgram : undefined,
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
  }, [
    syId,
    queuePage,
    queueLimit,
    queueState,
    targetGrade,
    repairReadySchoolYearId,
    activeQueueSearch,
    previousSectionName,
    curricularProgram,
  ]);

  useEffect(() => {
    void fetchReadiness();
  }, [fetchReadiness]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  const refreshBosyWorkspace = useCallback(() => {
    void fetchReadiness();
    void fetchQueue();
  }, [fetchQueue, fetchReadiness]);

  useRealtimeRefresh({
    topics: BOSY_REALTIME_TOPICS,
    schoolYearId: syId,
    onRefresh: refreshBosyWorkspace,
  });



  const handleConfirmSingle = (applicationId: number) => {
    const item = queueItems.find((i) => i.applicationId === applicationId);
    if (!item) return;
    setConfirmSingleTarget(item);
  };

  const executeConfirmSingle = async () => {
    if (!confirmSingleTarget) return;
    const { applicationId } = confirmSingleTarget;
    sileo.info({
      title: "Processing Learner Enrollment",
      description: "Submitting the learner record for BOSY sectioning readiness.",
    });
    setConfirmSingleBusy(true);
    setConfirmingIds((prev) => new Set(prev).add(applicationId));
    try {
      const result = await confirmReturn(applicationId);
      sileo.success(
        result.intakeState === "TEMPORARY"
          ? {
            title: "Learner Temporarily Enrolled",
            description:
              "The learner may proceed to section assignment while the listed school requirements are completed.",
          }
          : {
            title: "Learner Ready for Section Assignment",
            description:
              "The learner's enrollment and school requirements are confirmed.",
          },
      );
      setQueueItems((prev) =>
        prev.filter((item) => item.applicationId !== applicationId),
      );
      setQueueTotal((prev) => Math.max(0, prev - 1));
      setConfirmSingleTarget(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
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
    setBusyActionIds((prev) => new Set(prev).add(transferTarget.applicationId));
    try {
      if (transferMode === "CONFIRMED") {
        await markConfirmedTransferOut(transferTarget.applicationId);
      } else {
        await markTransferRequest(transferTarget.applicationId);
      }
      sileo.success({
        title:
          transferMode === "CONFIRMED"
            ? "Confirmed Learner Marked for Transfer Out"
            : "Learner Tagged as Not Returning",
        description:
          transferMode === "CONFIRMED"
            ? `${transferTarget.firstName} ${transferTarget.lastName} was removed from the sectioning queue and marked for transfer out.`
            : `${transferTarget.firstName} ${transferTarget.lastName} was cleared from the learner enrollment queue.`,
      });
      setQueueItems((current) =>
        current.filter(
          (item) => item.applicationId !== transferTarget.applicationId,
        ),
      );
      setQueueTotal((current) => Math.max(0, current - 1));
      setTransferTarget(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void fetchReadiness();
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0]);
    } finally {
      setBusyActionIds((prev) => {
        const next = new Set(prev);
        next.delete(transferTarget.applicationId);
        return next;
      });
      setTransferBusy(false);
    }
  };

  const executeRevokeConfirmation = async () => {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    setBusyActionIds((prev) => new Set(prev).add(revokeTarget.applicationId));
    try {
      await revokeConfirmedReturn(revokeTarget.applicationId);
      sileo.success({
        title: "Confirmation Revoked",
        description:
          `${revokeTarget.firstName} ${revokeTarget.lastName} was returned to Pending Enrollment.`,
      });
      setQueueItems((current) =>
        current.filter(
          (item) => item.applicationId !== revokeTarget.applicationId,
        ),
      );
      setQueueTotal((current) => Math.max(0, current - 1));
      setRevokeTarget(null);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void fetchReadiness();
    } catch (error: unknown) {
      toastApiError(error as Parameters<typeof toastApiError>[0]);
    } finally {
      setBusyActionIds((prev) => {
        const next = new Set(prev);
        next.delete(revokeTarget.applicationId);
        return next;
      });
      setRevokeBusy(false);
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
          description:
            `${result.readyForSectioning.length} ready for section assignment; ` +
            `${result.temporarilyEnrolled.length} temporarily enrolled.`,
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
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sectioningPool(),
      });
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      void fetchReadiness();
    } catch (e) {
      toastApiError(e as never);
    } finally {
      setBulkLoading(false);
    }
  };

  const setTitle = useHeaderStore((s) => s.setTitle);
  const activeTab = useSettingsStore((s) => s.uiPreferences.bosyTab);
  const setActiveTab = useCallback((tab: string) => {
    useSettingsStore.getState().updateUiPreference("bosyTab", tab);
  }, []);
  const guardedSetActiveTab = useGuardedTabChange(setActiveTab);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "continuing" || requestedTab === "incoming") {
      setActiveTab(requestedTab);
    }
  }, [searchParams, setActiveTab]);

  useEffect(() => {
    setTitle("Learner Enrollment");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="flex flex-1 h-full w-full min-h-0 flex-col">
      <Tabs value={activeTab} onValueChange={guardedSetActiveTab} className="flex min-h-0 flex-1 flex-col w-full h-full">
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-md relative shadow-sm">
          <TabsTrigger
            value="continuing"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md"
          >
            {activeTab === "continuing" && (
              <motion.div
                layoutId="bosy-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase", activeTab === "continuing" ? "text-primary-foreground" : "text-foreground")}>
              Continuing Learners
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="incoming"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-md"
          >
            {activeTab === "incoming" && (
              <motion.div
                layoutId="bosy-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 text-base uppercase", activeTab === "incoming" ? "text-primary-foreground" : "text-foreground")}>
              Incoming Grade 7 and Transferees
            </span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "continuing" && (
            <motion.div
              key="continuing"
              variants={tabPanelVariants}
              transition={createMotionTransition(motionPreferences, "normal")}
              {...getReducedMotionProps(motionPreferences.reduceMotion)}
              className="flex-1 flex min-h-0 flex-col w-full h-full"
            >
              <TabsContent
                value="continuing"
                forceMount
                className="m-0 flex min-h-0 flex-1 flex-col h-full focus-visible:outline-none ring-0"
              >
                <div className="flex flex-col flex-1 h-full w-full min-w-0 overflow-hidden space-y-4 sm:space-y-4">
                  <div
                    className="flex flex-col md:flex-row md:items-center justify-end gap-4"
                  >
                    <div>
                      {isHistoricalReadOnly && (
                        <p className="text-base font-extrabold text-amber-600 mt-0.5">Viewing archived data — all enrollment actions are disabled.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 p-1">
                    {[
                      {
                        label: "Pending Enrollment",
                        subBadge: "Waiting for learner or parent confirmation",
                        value: readiness?.pendingConfirmationCount ?? 0,
                        filterVal: "PENDING" as const,
                        isPrimaryMetric: false,
                      },
                      {
                        label: "Ready for Section Assignment",
                        subBadge: `Included in the S.Y. ${ayLabel || "2026–2027"} enrollment total`,
                        value: readiness?.confirmedReadyCount ?? 0,
                        filterVal: "CONFIRMED" as const,
                        isPrimaryMetric: true,
                      },
                      {
                        label: "Temporarily Enrolled",
                        subBadge: "Missing school requirements for follow-up",
                        value: readiness?.temporarilyEnrolledCount ?? 0,
                        filterVal: "TEMPORARY" as const,
                        isPrimaryMetric: false,
                      },
                    ].map(({ label, subBadge, value, filterVal, isPrimaryMetric }) => (
                      <button
                        type="button"
                        key={label}
                        onClick={() => {
                          setQueueState(filterVal);
                          setQueuePage(1);
                          setRowSelection({});
                        }}
                        aria-pressed={queueState === filterVal}
                        className={cn(
                          "relative flex h-full flex-col rounded-md border bg-card px-4 pt-4 pb-2 text-left shadow-sm transition-colors text-foreground",
                          queueState === filterVal
                            ? "border-primary ring-1 ring-primary text-primary"
                            : "border-border hover:border-primary",
                        )}>
                        <div className="flex h-full flex-col">
                          <div>
                            <span className="block text-lg font-extrabold leading-snug ">
                              {label}
                            </span>
                          </div>
                          <div className="mt-auto flex flex-col gap-2">
                            <span
                              className={cn(
                                "text-4xl font-extrabold leading-none tracking-tight",
                                isPrimaryMetric && value > 0
                                  ? "text-primary"
                                  : "text-primary",
                              )}>
                              {value}
                            </span>
                            <span className="text-sm font-extrabold mb-2">
                              {subBadge}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col flex-1 h-full min-h-0 overflow-hidden">
                    <div className="flex flex-col xl:flex-row items-center gap-3 w-full bg-muted/20 border-border border-b p-3 sm:px-6">
                      <div className="relative w-full flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="SEARCH LRN, FIRST NAME, LAST NAME..."
                          className="w-full h-10 pl-9 bg-muted border-gray-300 font-extrabold uppercase"
                          value={queueSearch}
                          onChange={(e) => {
                            setQueueSearch(e.target.value);
                            startTransition(() => {
                              setQueuePage(1);
                            });
                          }}
                        />
                      </div>

                      <div className="flex flex-row flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto shrink-0">
                        {canMutate && queueState === "PENDING" && selectedIds.length > 0 ? (
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
                            <Select
                              value={targetGrade}
                              onValueChange={(val) => {
                                setTargetGrade(val);
                                setQueuePage(1);
                                setRowSelection({});
                              }}
                            >
                              <SelectTrigger className="h-10 w-full sm:w-48 leading-tight font-extrabold transition-colors">
                                <SelectValue placeholder="All Incoming Grades" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL" className="leading-tight font-extrabold">All Incoming Grades</SelectItem>
                                <SelectItem value="8" className="leading-tight font-extrabold">Grade 8</SelectItem>
                                <SelectItem value="9" className="leading-tight font-extrabold">Grade 9</SelectItem>
                                <SelectItem value="10" className="leading-tight font-extrabold">Grade 10</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={curricularProgram}
                              onValueChange={(val) => {
                                setCurricularProgram(val);
                                setQueuePage(1);
                                setRowSelection({});
                              }}
                            >
                              <SelectTrigger className="h-10 w-full sm:w-48 leading-tight font-extrabold transition-colors">
                                <SelectValue placeholder="All Programs">
                                  {curricularProgram === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" ? "STE"
                                    : curricularProgram === "SPECIAL_PROGRAM_IN_THE_ARTS" ? "SPA"
                                      : curricularProgram === "SPECIAL_PROGRAM_IN_SPORTS" ? "SPS"
                                        : curricularProgram === "REGULAR" ? "BEC"
                                          : "All Programs"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL" className="leading-tight font-extrabold">All Programs</SelectItem>
                                <SelectItem value="REGULAR" className="leading-tight font-extrabold">Basic Education Curriculum</SelectItem>
                                <SelectItem value="SCIENCE_TECHNOLOGY_AND_ENGINEERING" className="leading-tight font-extrabold">Science Technology and Engineering</SelectItem>
                                <SelectItem value="SPECIAL_PROGRAM_IN_THE_ARTS" className="leading-tight font-extrabold">Special Program in the Arts</SelectItem>
                                <SelectItem value="SPECIAL_PROGRAM_IN_SPORTS" className="leading-tight font-extrabold">Special Program in Sports</SelectItem>
                              </SelectContent>
                            </Select>

                            <Select
                              value={previousSectionName}
                              onValueChange={(val) => {
                                setPreviousSectionName(val);
                                startTransition(() => setQueuePage(1));
                              }}
                            >
                              <SelectTrigger className="h-10 w-full sm:w-48 leading-tight font-extrabold transition-colors">
                                <SelectValue placeholder="All Previous Sections" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL" className="leading-tight font-extrabold">All Previous Sections</SelectItem>
                                {previousSections
                                  .filter((sec) => typeof sec === "string" && sec.trim() !== "")
                                  .map((sec) => (
                                    <SelectItem key={sec} value={sec} className="leading-tight font-extrabold">
                                      {sec}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                      <div className="overflow-hidden bg-muted/5 w-full flex-1 flex flex-col min-h-0">
                        <QueueTable
                          items={queueItems}
                          loading={queueLoading}
                          isSearching={isSearching}
                          queueState={queueState}
                          allowActions={canMutate}
                          rowSelection={queueState === "PENDING" ? rowSelection : {}}
                          onRowSelectionChange={setRowSelection}
                          onConfirmSingle={handleConfirmSingle}
                          onTransferRequest={(item) => {
                            setTransferMode("PENDING");
                            setTransferTarget(item);
                          }}
                          onRevokeConfirmation={setRevokeTarget}
                          onMarkConfirmedTransferOut={(item) => {
                            setTransferMode("CONFIRMED");
                            setTransferTarget(item);
                          }}
                          confirmingIds={confirmingIds}
                          busyActionIds={busyActionIds}
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
                  <ConfirmationModal
                    open={confirmSingleTarget !== null}
                    onOpenChange={(open) => { if (!open) setConfirmSingleTarget(null); }}
                    title="Enroll Learner"
                    variant="success"
                    loading={confirmSingleBusy}
                    confirmText="Enroll"
                    onConfirm={() => { void executeConfirmSingle(); }}
                    description={
                      <>
                        <p className="mb-4 text-base font-bold">
                          Confirm learner enrollment for this school year. Learners with
                          incomplete school requirements will be marked as temporarily
                          enrolled but may still proceed to Class Sectioning and SF1 assignment.
                        </p>
                        {confirmSingleTarget && (
                          <div className="rounded-md border bg-muted px-4 py-3 space-y-1.5 text-left border-primary border-2">
                            <p className="text-base leading-tight font-extrabold uppercase text-foreground">
                              {confirmSingleTarget.lastName}, {confirmSingleTarget.firstName}
                              {confirmSingleTarget.middleName
                                ? ` ${confirmSingleTarget.middleName.charAt(0)}.`
                                : ""}
                            </p>
                            <p className="text-base text-foreground font-extrabold break-all">
                              LRN: {confirmSingleTarget.lrn ?? "No LRN"}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn("text-sm font-extrabold uppercase", getGradeLevelBadgeStyles(confirmSingleTarget.gradeLevelName))}>
                              {confirmSingleTarget.gradeLevelName}
                            </Badge>
                            {confirmSingleTarget.missingDocuments.length > 0 && (
                              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                                <p className="text-sm font-extrabold text-amber-900">
                                  Missing school requirements
                                </p>
                                <p className="mt-1 text-sm font-semibold text-amber-800">
                                  {confirmSingleTarget.missingDocuments.join(", ")}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    }
                  />

                  <ConfirmationModal
                    open={transferTarget !== null}
                    onOpenChange={(open) => {
                      if (!open && !transferBusy) setTransferTarget(null);
                    }}
                    title={transferMode === "CONFIRMED" ? "Mark Transfer Out" : "Tag as Not Returning"}
                    variant="danger"
                    loading={transferBusy}
                    confirmText={transferMode === "CONFIRMED" ? "Mark Transfer Out" : "Tag as Not Returning"}
                    onConfirm={() => { void executeTransferRequest(); }}
                    description={
                      <>
                        <p className="mb-4">
                          {transferMode === "CONFIRMED"
                            ? "Remove this confirmed learner from the sectioning queue and mark the record for transfer out."
                            : "Clear this learner from the Pending Enrollment queue. The learner will no longer appear in pending confirmations for this school year."}
                        </p>
                        {transferTarget && (
                          <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1.5 text-left">
                            <p className="text-base leading-tight font-extrabold uppercase text-foreground">
                              {transferTarget.lastName}, {transferTarget.firstName}
                              {transferTarget.middleName
                                ? ` ${transferTarget.middleName.charAt(0)}.`
                                : ""}
                            </p>
                            <p className="text-base text-foreground font-extrabold break-all">
                              LRN: {transferTarget.lrn ?? "No LRN"}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn("text-sm font-extrabold uppercase", getGradeLevelBadgeStyles(transferTarget.gradeLevelName))}>
                              {transferTarget.gradeLevelName}
                            </Badge>
                          </div>
                        )}
                      </>
                    }
                  />

                  <ConfirmationModal
                    open={revokeTarget !== null}
                    onOpenChange={(open) => {
                      if (!open && !revokeBusy) setRevokeTarget(null);
                    }}
                    title="Unenroll"
                    variant="danger"
                    loading={revokeBusy}
                    confirmText="Unenroll"
                    onConfirm={() => { void executeRevokeConfirmation(); }}
                    description={
                      <>
                        <p className="mb-4">
                          Return this learner to Pending Enrollment. This removes the learner from the unassigned sectioning pool and from the current official BOSY count.
                        </p>
                        {revokeTarget && (
                          <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-1.5 text-left">
                            <p className="text-base leading-tight font-extrabold uppercase text-foreground">
                              {revokeTarget.lastName}, {revokeTarget.firstName}
                              {revokeTarget.middleName
                                ? ` ${revokeTarget.middleName.charAt(0)}.`
                                : ""}
                            </p>
                            <p className="text-base text-foreground font-extrabold break-all">
                              LRN: {revokeTarget.lrn ?? "No LRN"}
                            </p>
                            <Badge
                              variant="outline"
                              className={cn("text-sm font-extrabold uppercase", getGradeLevelBadgeStyles(revokeTarget.gradeLevelName))}>
                              {revokeTarget.gradeLevelName}
                            </Badge>
                          </div>
                        )}
                      </>
                    }
                  />

                </div>
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "incoming" && (
            <motion.div
              key="incoming"
              variants={tabPanelVariants}
              transition={createMotionTransition(motionPreferences, "normal")}
              {...getReducedMotionProps(motionPreferences.reduceMotion)}
              className="flex-1 flex min-h-0 flex-col w-full"
            >
              <TabsContent
                value="incoming"
                forceMount
                className="m-0 flex min-h-0 flex-1 flex-col focus-visible:outline-none ring-0"
              >
                <VerificationWorkspace />
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
