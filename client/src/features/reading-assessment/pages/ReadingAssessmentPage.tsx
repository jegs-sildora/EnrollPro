import { useState, startTransition, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  BookOpen,
  CheckCircle2,
  Loader2,
  RefreshCw,
  FileCheck2,
  Lock,
  Users,
  UserCheck,
  GraduationCap,
  ScrollText,
  ClipboardList,
  FileText,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { PaginationBar } from "@/shared/components/PaginationBar";
import type { ColumnDef } from "@tanstack/react-table";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { queryKeys } from "@/shared/lib/queryKeys";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";

import {
  fetchAdviserQueue,
  fetchContinuingQueue,
  submitReadingLevel,
  type AdviserQueueItem,
  type ContinuingQueueItem,
  type ReadingLevel,
} from "../api/reading-assessment.api";
import { apiVerifyBeef, apiConfirmScpSlot, confirmReturn } from "@/features/bosy/api/bosy.api";

// ── Constants ────────────────────────────────────────────────────────────────

const READING_LEVELS: {
  value: ReadingLevel;
  label: string;
  description: string;
  colorClass: string;
  badgeClass: string;
}[] = [
    {
      value: "INDEPENDENT",
      label: "Independent",
      description: "Reads fluently with full comprehension",
      colorClass: "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      value: "INSTRUCTIONAL",
      label: "Instructional",
      description: "Reads with some support; grade-level with guidance",
      colorClass: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    },
    {
      value: "FRUSTRATION",
      label: "Frustration",
      description: "Struggles even with support; below grade level",
      colorClass: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    },
    {
      value: "NON_READER",
      label: "Non-Reader",
      description: "Cannot decode or read independently",
      colorClass: "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white",
      badgeClass: "bg-red-50 text-red-700 border-red-200",
    },
  ];

function getReadingLevelMeta(level: ReadingLevel | null) {
  return READING_LEVELS.find((r) => r.value === level) ?? null;
}

// ── Document Checklist ────────────────────────────────────────────────────────

interface DocItem {
  label: string;
  key: string;
  note: string;
  Icon: React.ElementType;
}

function getDocumentChecklist(applicantType: string, isScpTrack: boolean): DocItem[] {
  const docs: DocItem[] = [
    {
      label: "SF9 / Report Card",
      key: "sf9",
      note: "Most recent grade level",
      Icon: FileText,
    },
    {
      label: "PSA Birth Certificate",
      key: "psa",
      note: "Original or authenticated photocopy (RA 9048)",
      Icon: ScrollText,
    },
  ];

  const type = (applicantType ?? "").toUpperCase();

  if (type === "NEW") {
    docs.push(
      {
        label: "Certificate of Elementary Completion",
        key: "cert_elem",
        note: "DepEd-issued Form 137-A or from previous school",
        Icon: GraduationCap,
      },
      {
        label: "Good Moral Character Certificate",
        key: "good_moral",
        note: "Signed by Elementary School Principal",
        Icon: ScrollText,
      },
    );
  } else if (type === "TRANSFEREE") {
    docs.push(
      {
        label: "Certificate of Transfer / Form 137 Request",
        key: "transfer_cert",
        note: "Requested from previous school's registrar",
        Icon: ClipboardList,
      },
      {
        label: "Good Moral Character Certificate",
        key: "good_moral",
        note: "Signed by previous school's Principal",
        Icon: ScrollText,
      },
    );
  }

  if (isScpTrack) {
    docs.push({
      label: "SCP Qualifying Assessment Sheet",
      key: "scp_test",
      note: "Signed result from SCP selection panel",
      Icon: FileCheck2,
    });
  }

  return docs;
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ReadingAssessmentPage() {
  const { activeSchoolYearId, viewingSchoolYearId, activeSchoolYearLabel } =
    useSettingsStore();
  const schoolYearId = viewingSchoolYearId ?? activeSchoolYearId;
  const queryClient = useQueryClient();



  const {
    inputValue: searchInput,
    setInputValue: setSearchInput,
    activeFilter: search,
    isSearching,
  } = useDebouncedSearch();

  const {
    inputValue: continuingSearchInput,
    setInputValue: setContinuingSearchInput,
    activeFilter: continuingSearch,
    isSearching: isContinuingSearching,
  } = useDebouncedSearch();

  const [activeTab, setActiveTab] = useState<"pending" | "ready" | "continuing">("pending");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);
  const isUserInteracting = isSearchFocused || isTableHovered;

  // ── React Query: live-polling adviser queue ─────────────────────────────
  const {
    data: queue = [],
    isFetching,
    isLoading,
  } = useQuery({
    queryKey: queryKeys.adviserQueue(schoolYearId ?? 0, search || undefined),
    queryFn: () => fetchAdviserQueue(schoolYearId!, search || undefined),
    enabled: !!schoolYearId,
    refetchInterval: isUserInteracting ? false : 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  // ── React Query: continuing (BOSY PENDING_CONFIRMATION) learners ───────────
  const {
    data: continuingPage,
    isLoading: isContinuingLoading,
  } = useQuery({
    queryKey: queryKeys.continuingQueue(schoolYearId ?? 0, continuingSearch || undefined),
    queryFn: () => fetchContinuingQueue(schoolYearId!, continuingSearch || undefined),
    enabled: !!schoolYearId,
    refetchInterval: isUserInteracting ? false : 5_000,
    refetchOnWindowFocus: true,
    staleTime: 3_000,
  });

  const pendingPhilIriItems = queue.filter((a) => a.readingProfileLevel === null);
  const readyToConfirmItems = queue.filter((a) => a.readingProfileLevel !== null);
  const continuingItems: ContinuingQueueItem[] = continuingPage?.items ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AdviserQueueItem | null>(null);
  const [philIriSaving, setPhilIriSaving] = useState(false);
  const [localLevel, setLocalLevel] = useState<ReadingLevel | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [docsChecked, setDocsChecked] = useState<Record<string, boolean>>({});
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());

  const effectiveLevel = localLevel ?? selected?.readingProfileLevel ?? null;
  const step1Done = effectiveLevel !== null;
  const isScpTrack = selected?.status === "READY_FOR_ENROLLMENT";
  const docList = selected
    ? getDocumentChecklist(selected.applicantType, isScpTrack)
    : [];
  const allDocsChecked = docList.length > 0 && docList.every((d) => docsChecked[d.key]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adviserQueue(schoolYearId ?? 0) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.continuingQueue(schoolYearId ?? 0) });
  };

  const handleSelect = (app: AdviserQueueItem) => {
    setSelected(app);
    setLocalLevel(null);
    setDocsChecked({});
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setTimeout(() => {
      setSelected(null);
      setLocalLevel(null);
      setDocsChecked({});
    }, 300);
  };

  const handleGradePhilIRI = async (level: ReadingLevel) => {
    if (!selected || philIriSaving) return;
    setPhilIriSaving(true);
    try {
      await submitReadingLevel(selected.id, level);
      setLocalLevel(level);
      // Optimistic update in the React Query cache
      queryClient.setQueryData(
        queryKeys.adviserQueue(schoolYearId ?? 0, search || undefined),
        (prev: AdviserQueueItem[] | undefined) =>
          prev?.map((a) =>
            a.id === selected.id ? { ...a, readingProfileLevel: level } : a,
          ),
      );
      sileo.success({
        title: "Phil-IRI Recorded",
        description: `${selected.learner.firstName} — ${getReadingLevelMeta(level)?.label ?? level
          }`,
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setPhilIriSaving(false);
    }
  };

  const handleConfirmEnrollment = async () => {
    if (!selected || confirmSaving || !step1Done) return;
    setConfirmSaving(true);
    try {
      if (isScpTrack) {
        await apiConfirmScpSlot(selected.id, false);
      } else {
        await apiVerifyBeef(selected.id);
      }
      sileo.success({
        title: "Enrollment Confirmed",
        description: `${selected.learner.firstName} ${selected.learner.lastName} is ready for sectioning.`,
      });
      // Invalidate adviser queue AND sectioning pool (learner is now ready for sectioning)
      void queryClient.invalidateQueries({ queryKey: queryKeys.adviserQueue(schoolYearId ?? 0) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
      handleDialogClose();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setConfirmSaving(false);
    }
  };

  const handleConfirmContinuing = async (app: ContinuingQueueItem) => {
    setConfirmingIds((prev) => new Set(prev).add(app.applicationId));
    try {
      await confirmReturn(app.applicationId);
      sileo.success({
        title: "Learner Return Confirmed",
        description: `${app.firstName} ${app.lastName} is confirmed for sectioning.`,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.continuingQueue(schoolYearId ?? 0),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sectioningPool() });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(app.applicationId);
        return next;
      });
    }
  };

  const selectedFullName = selected
    ? `${selected.learner.lastName}, ${selected.learner.firstName}${selected.learner.middleName ? ` ${selected.learner.middleName[0]}.` : ""
    }`
    : "";

  const INTAKE_TABS = [
    { key: "pending" as const, label: "Needs Phil-IRI", count: pendingPhilIriItems.length },
    { key: "ready" as const, label: "Ready to Confirm", count: readyToConfirmItems.length },
    { key: "continuing" as const, label: "Continuing Learners", count: continuingItems.length },
  ];

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6"
    >
      {/* Header */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-extrabold">Adviser Intake Hub</h1>
          <p className="text-base leading-tight font-extrabold">
            Phil-IRI Assessment &amp; Enrollment Confirmation
            {activeSchoolYearLabel ? ` · ${activeSchoolYearLabel}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold",
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
            size="icon"
            className="h-10 w-10 shrink-0 hover:bg-muted"
            title="Refresh Data"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-5 w-5", isFetching && "")} />
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-4 gap-3"
      >
        {[
          { Icon: Users, label: "Total in Queue", value: queue.length },
          { Icon: BookOpen, label: "Needs Phil-IRI", value: pendingPhilIriItems.length },
          { Icon: CheckCircle2, label: "Ready to Confirm", value: readyToConfirmItems.length },
          { Icon: UserCheck, label: "Continuing Learners", value: continuingItems.length },
        ].map(({ Icon, label, value }) => (
          <Card key={label} className="border-none shadow-sm bg-[hsl(var(--card))]">
            <CardHeader className="p-3 pb-1 flex-row items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted shrink-0">
                <Icon className="h-3.5 w-3.5 text-foreground" />
              </div>
              <p className="text-[10px] font-extrabold uppercase text-foreground leading-tight">
                {label}
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {isLoading ? (
                <Loader2 className="h-5 w-5  text-foreground" />
              ) : (
                <p className="text-2xl font-extrabold">{value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setIsSearchFocused(false);
          setIsTableHovered(false);
          startTransition(() => setActiveTab(v as "pending" | "ready" | "continuing"));
        }}
        className="w-full"
      >
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          {INTAKE_TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="flex-1 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg"
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="adviser-active-pill"
                  className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <span className={cn("relative z-20 inline-flex items-center gap-2 text-base leading-tight uppercase", activeTab === tab.key ? "text-primary-foreground" : "text-foreground")}>
                {tab.label}
                {tab.count > 0 && (
                  <Badge
                    variant={activeTab === tab.key ? "secondary" : "outline"}
                    className="h-5 px-1.5 text-base font-extrabold border-0"
                  >
                    {tab.count}
                  </Badge>
                )}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 w-full"
            >
              <TabsContent value="pending" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <QueueCard
                  items={pendingPhilIriItems}
                  loading={isLoading}
                  isSearching={isSearching}
                  searchInput={searchInput}
                  onSearchChange={setSearchInput}
                  onSearchFocus={() => setIsSearchFocused(true)}
                  onSearchBlur={() => setIsSearchFocused(false)}
                  onTableHoverChange={setIsTableHovered}
                  onSelect={handleSelect}
                  emptyTitle="All Phil-IRI Assessments Complete"
                  emptyDescription={
                    search
                      ? "No learners match your search."
                      : "All learners in your queue have been assessed."
                  }
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 w-full"
            >
              <TabsContent value="ready" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <QueueCard
                  items={readyToConfirmItems}
                  loading={isLoading}
                  isSearching={isSearching}
                  searchInput={searchInput}
                  onSearchChange={setSearchInput}
                  onSearchFocus={() => setIsSearchFocused(true)}
                  onSearchBlur={() => setIsSearchFocused(false)}
                  onTableHoverChange={setIsTableHovered}
                  onSelect={handleSelect}
                  emptyTitle={pendingPhilIriItems.length > 0 ? "No Learners Ready Yet" : "All Done!"}
                  emptyDescription={
                    pendingPhilIriItems.length > 0
                      ? "Complete Phil-IRI assessments first."
                      : "All learners have been confirmed for this school year."
                  }
                />
              </TabsContent>
            </motion.div>
          )}

          {activeTab === "continuing" && (
            <motion.div
              key="continuing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 w-full"
            >
              <TabsContent value="continuing" forceMount className="mt-0 focus-visible:outline-none ring-0">
                <ContinuingQueueCard
                  items={continuingItems}
                  loading={isContinuingLoading}
                  isSearching={isContinuingSearching}
                  searchInput={continuingSearchInput}
                  onSearchChange={setContinuingSearchInput}
                  onSearchFocus={() => setIsSearchFocused(true)}
                  onSearchBlur={() => setIsSearchFocused(false)}
                  onTableHoverChange={setIsTableHovered}
                  confirmingIds={confirmingIds}
                  onConfirm={handleConfirmContinuing}
                  emptyTitle="No Continuing Learners"
                  emptyDescription={
                    search
                      ? "No continuing learners match your search."
                      : "There are no continuing learners in your advisory queue."
                  }
                />
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>

      {/* ── Two-Step Intake Dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleDialogClose();
        }}
      >
        <DialogContent className="w-full max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold">Adviser Intake</DialogTitle>
            {selected && (
              <DialogDescription asChild>
                <div className="space-y-1.5 pt-0.5">
                  <span className="block font-extrabold text-foreground text-base">
                    {selectedFullName}
                  </span>
                  <span className="block text-base font-extrabold text-foreground">
                    LRN: {selected.learner.lrn ?? "None"} &middot;{" "}
                    {selected.gradeLevel.name}
                  </span>
                  <Badge
                    variant={isScpTrack ? "default" : "secondary"}
                    className="text-[10px] font-extrabold"
                  >
                    {isScpTrack ? "SCP Track" : "BEC / BEEF Track"}
                  </Badge>
                </div>
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Step 1: Phil-IRI */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-base font-extrabold shrink-0",
                  step1Done
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {step1Done ? <CheckCircle2 className="size-3.5" /> : "1"}
              </div>
              <p className="font-extrabold text-base leading-tight">Phil-IRI Reading Assessment</p>
            </div>

            {step1Done ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-base leading-tight font-extrabold text-emerald-800">
                    {getReadingLevelMeta(effectiveLevel as ReadingLevel)?.label ??
                      effectiveLevel}
                  </p>
                  <p className="text-base text-emerald-600">Reading level recorded</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <p className="text-base leading-tight text-foreground">
                  Select the learner&apos;s Phil-IRI reading proficiency level.
                </p>
                {READING_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => void handleGradePhilIRI(level.value)}
                    disabled={philIriSaving}
                    className={cn(
                      "w-full min-h-[58px] rounded-xl font-extrabold text-base px-4 py-3",
                      "flex flex-col items-start justify-center gap-0.5",
                      "transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                      level.colorClass,
                    )}
                  >
                    <span>{level.label}</span>
                    <span className="text-base leading-tight font-normal opacity-90">
                      {level.description}
                    </span>
                  </button>
                ))}
                {philIriSaving && (
                  <div className="flex items-center justify-center gap-2 text-base leading-tight text-foreground">
                    <Loader2 className="size-4 " />
                    <span>Saving…</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Document Verification — slides in after Phil-IRI */}
          <div
            className={cn(
              "transition-[max-height,opacity] duration-500 ease-out overflow-hidden",
              step1Done ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <Separator className="my-4" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-extrabold shrink-0">
                  2
                </div>
                <p className="font-extrabold text-base leading-tight">Document Verification</p>
              </div>
              <p className="text-base leading-tight text-foreground">
                Physically verify the following DepEd-required documents before confirming
                enrollment.
              </p>

              <div className="rounded-xl border divide-y overflow-hidden">
                {docList.map((doc) => {
                  const checked = docsChecked[doc.key] ?? false;
                  return (
                    <button
                      key={doc.key}
                      onClick={() =>
                        setDocsChecked((prev) => ({ ...prev, [doc.key]: !prev[doc.key] }))
                      }
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
                        checked ? "bg-emerald-50" : "bg-card hover:bg-muted/40",
                      )}
                    >
                      <div
                        className={cn(
                          "size-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          checked
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-muted-foreground/50",
                        )}
                      >
                        {checked && <CheckCircle2 className="size-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-base leading-tight font-extrabold",
                            checked ? "text-emerald-700" : "text-foreground",
                          )}
                        >
                          {doc.label}
                        </p>
                        <p className="text-base text-foreground mt-0.5">{doc.note}</p>
                      </div>
                      <doc.Icon
                        className={cn(
                          "size-4 shrink-0 mt-0.5",
                          checked ? "text-emerald-500" : "text-foreground",
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <Button
                className="w-full h-12 text-base leading-tight font-extrabold"
                disabled={!allDocsChecked || confirmSaving}
                onClick={() => void handleConfirmEnrollment()}
              >
                {confirmSaving ? (
                  <>
                    <Loader2 className="size-4  mr-2" />
                    Confirming…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 mr-2" />
                    Confirm Enrollment
                  </>
                )}
              </Button>

              {!allDocsChecked && (
                <p className="text-base text-foreground text-center">
                  Check off all documents above to enable confirmation.
                </p>
              )}
            </div>
          </div>

          {/* Locked placeholder when Step 1 not yet done */}
          {!step1Done && (
            <div className="mt-3">
              <Separator className="mb-3" />
              <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/40 px-4 py-3">
                <Lock className="size-4 text-foreground shrink-0" />
                <div>
                  <p className="text-base leading-tight font-extrabold text-foreground">
                    Document Verification (Step 2)
                  </p>
                  <p className="text-base text-foreground">
                    Complete Phil-IRI assessment above to unlock.
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── QueueCard ─────────────────────────────────────────────────────────────────

interface QueueCardProps {
  items: AdviserQueueItem[];
  loading: boolean;
  isSearching: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onTableHoverChange: (hovered: boolean) => void;
  onSelect: (app: AdviserQueueItem) => void;
  emptyTitle: string;
  emptyDescription: string;
}

function QueueCard({
  items,
  loading,
  isSearching,
  searchInput,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onTableHoverChange,
  onSelect,
  emptyTitle,
  emptyDescription,
}: QueueCardProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  const columns = useMemo<ColumnDef<AdviserQueueItem>[]>(
    () => [
      {
        id: "learner",
        accessorKey: "learner",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="LEARNER" />
        ),
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex flex-col text-left py-0.5 leading-tight">
              <span className="font-extrabold uppercase text-base">
                {a.learner.lastName}, {a.learner.firstName}
                {a.learner.middleName ? ` ${a.learner.middleName[0]}.` : ""}
              </span>
              <span className="text-[10px] text-foreground font-extrabold">
                LRN: {a.learner.lrn ?? "NO LRN"}
              </span>
            </div>
          );
        },
      },
      {
        id: "gradeLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="GRADE"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-[10px] font-extrabold uppercase">
              {row.original.gradeLevel.name}
            </Badge>
          </div>
        ),
        size: 90,
        enableSorting: false,
      },
      {
        id: "track",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="TRACK"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const isScpTrack = row.original.status === "READY_FOR_ENROLLMENT";
          return (
            <div className="flex justify-center">
              <Badge
                variant={isScpTrack ? "default" : "secondary"}
                className="text-[10px] font-extrabold uppercase"
              >
                {isScpTrack ? "SCP" : "BEC/BEEF"}
              </Badge>
            </div>
          );
        },
        size: 90,
        enableSorting: false,
      },
      {
        id: "philIri",
        accessorKey: "readingProfileLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="PHIL-IRI"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const levelMeta = getReadingLevelMeta(row.original.readingProfileLevel);
          return (
            <div className="flex justify-center">
              {levelMeta ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border",
                    levelMeta.badgeClass,
                  )}
                >
                  <BookOpen className="size-2.5" />
                  {levelMeta.label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  <BookOpen className="size-2.5" />
                  Pending
                </span>
              )}
            </div>
          );
        },
        size: 120,
      },
      {
        id: "actions",
        header: () => (
          <div className="text-center font-extrabold text-primary-foreground text-base uppercase">
            Action
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-base font-extrabold text-primary hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(row.original);
              }}
            >
              Open Intake
            </Button>
          </div>
        ),
        size: 110,
        enableSorting: false,
      },
    ],
    [onSelect],
  );

  const pagedItems = items.slice((page - 1) * limit, page * limit);

  return (
    <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
      <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
          <Input
            placeholder="Search LRN, First Name, Last Name…"
            className="pl-10 h-11 text-base leading-tight font-extrabold bg-muted/30 border-2 border-transparent focus:border-primary transition-all uppercase"
            value={searchInput}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col min-h-0">
        <div
          onMouseEnter={() => onTableHoverChange(true)}
          onMouseLeave={() => onTableHoverChange(false)}
        >
          <DataTable
            columns={columns}
            data={pagedItems}
            loading={loading}
            forceEmptyState={isSearching}
            prependBodyRow={isSearching ? <TableSearchIndicator colSpan={5} /> : null}
            virtualize={false}
            onRowClick={onSelect}
            rowSelection={{}}
            onRowSelectionChange={() => { }}
            emptyStateContent={
              !loading && !isSearching && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
                  <CheckCircle2 className="size-10 text-emerald-500" />
                  <p className="font-extrabold text-base">{emptyTitle}</p>
                  <p className="text-base leading-tight text-foreground max-w-xs">{emptyDescription}</p>
                </div>
              ) : undefined
            }
          />
        </div>
        <PaginationBar
          page={page}
          total={items.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          itemName="Learners"
        />
      </CardContent>
    </Card>
  );
}


// ── ContinuingQueueCard ───────────────────────────────────────────────────────

interface ContinuingQueueCardProps {
  items: ContinuingQueueItem[];
  loading: boolean;
  isSearching: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onTableHoverChange: (hovered: boolean) => void;
  confirmingIds: Set<number>;
  onConfirm: (app: ContinuingQueueItem) => Promise<void>;
  emptyTitle: string;
  emptyDescription: string;
}

function ContinuingQueueCard({
  items,
  loading,
  isSearching,
  searchInput,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onTableHoverChange,
  confirmingIds,
  onConfirm,
  emptyTitle,
  emptyDescription,
}: ContinuingQueueCardProps) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [searchInput]);

  const columns = useMemo<ColumnDef<ContinuingQueueItem>[]>(
    () => [
      {
        id: "learner",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="LEARNER" />
        ),
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex flex-col text-left py-0.5 leading-tight">
              <span className="font-extrabold uppercase text-base">
                {a.lastName}, {a.firstName}
                {a.middleName ? ` ${a.middleName[0]}.` : ""}
              </span>
              <span className="text-[10px] text-foreground font-extrabold">
                LRN: {a.lrn ?? "NO LRN"}
              </span>
            </div>
          );
        },
      },
      {
        id: "gradeLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="GRADE"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Badge variant="outline" className="text-[10px] font-extrabold uppercase">
              {row.original.gradeLevelName}
            </Badge>
          </div>
        ),
        size: 90,
        enableSorting: false,
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="STATUS"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const isConfirmed = row.original.status === "READY_FOR_SECTIONING";
          return (
            <div className="flex justify-center">
              {isConfirmed ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="size-2.5" />
                  Confirmed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                  Pending
                </span>
              )}
            </div>
          );
        },
        size: 110,
      },
      {
        id: "actions",
        header: () => (
          <div className="text-center font-extrabold text-primary-foreground text-base uppercase">
            Action
          </div>
        ),
        cell: ({ row }) => {
          const app = row.original;
          const isConfirmed = app.status === "READY_FOR_SECTIONING";
          const confirming = confirmingIds.has(app.applicationId);
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 text-base font-extrabold transition-opacity",
                  isConfirmed
                    ? "text-foreground cursor-not-allowed opacity-50"
                    : "text-primary hover:text-primary hover:bg-primary/10",
                )}
                disabled={isConfirmed || confirming}
                onClick={(e) => {
                  e.stopPropagation();
                  void onConfirm(app);
                }}
              >
                {confirming ? (
                  <>
                    <Loader2 className="size-3.5  mr-1.5" />
                    Confirming...
                  </>
                ) : isConfirmed ? (
                  "Confirmed"
                ) : (
                  "Confirm Return"
                )}
              </Button>
            </div>
          );
        },
        size: 130,
        enableSorting: false,
      },
    ],
    [confirmingIds, onConfirm],
  );

  const pagedItems = items.slice((page - 1) * limit, page * limit);

  return (
    <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex flex-col min-h-0 overflow-hidden">
      <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
          <Input
            placeholder="Search LRN, First Name, Last Name…"
            className="pl-10 h-11 text-base leading-tight font-extrabold bg-muted/30 border-2 border-transparent focus:border-primary transition-all uppercase"
            value={searchInput}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col min-h-0">
        <div
          onMouseEnter={() => onTableHoverChange(true)}
          onMouseLeave={() => onTableHoverChange(false)}
        >
          <DataTable
            columns={columns}
            data={pagedItems}
            loading={loading}
            forceEmptyState={isSearching}
            prependBodyRow={isSearching ? <TableSearchIndicator colSpan={4} /> : null}
            virtualize={false}
            getRowId={(row) => String(row.applicationId)}
            rowSelection={{}}
            onRowSelectionChange={() => { }}
            emptyStateContent={
              !loading && !isSearching && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-6">
                  <UserCheck className="size-10 text-emerald-500" />
                  <p className="font-extrabold text-base">{emptyTitle}</p>
                  <p className="text-base leading-tight text-foreground max-w-xs">{emptyDescription}</p>
                </div>
              ) : undefined
            }
          />
        </div>
        <PaginationBar
          page={page}
          total={items.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          itemName="Learners"
        />
      </CardContent>
    </Card>
  );
}

