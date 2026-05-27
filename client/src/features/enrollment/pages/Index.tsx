import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  startTransition,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Eye,
  RefreshCw,
  FileCheck2,
  School,
  UserPlus,
  LogOut,
  RotateCcw,
  Info,
  MoreVertical,
  Loader2,
  Lock,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { useSchoolYearContext } from "@/shared/hooks/useSchoolYearContext";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { useScpConfigs } from "@/features/admission/hooks/useScpConfigs";
import {
  SCP_ACRONYMS,
  SCP_LABELS,
  cn,
  formatScpType,
  getLearnerTypeLabel,
} from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Checkbox } from "@/shared/ui/checkbox";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { format } from "date-fns";
import {
  getReducedMotionProps,
  panelTransition,
  sectionVariants,
} from "@/shared/lib/motion";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";
import type {
  CellContext,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { BatchSectioningWizard } from "@/features/enrollment/components/BatchSectioningWizard";
import { BatchSectioningParamsModal } from "@/features/enrollment/components/BatchSectioningParamsModal";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { AdminPinInput } from "@/shared/components/AdminPinInput";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { EnrollmentWorkflowTabs } from "@/features/enrollment/components/EnrollmentWorkflowTabs";
import { BatchConfirmationModal } from "@/features/enrollment/components/BatchConfirmationModal";
import { PinHandoverModal } from "@/features/enrollment/components/PinHandoverModal";
import { LearnerExitModal } from "@/features/enrollment/components/LearnerExitModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { useSectioningStore } from "@/store/sectioning.slice";
import { PaginationBar } from "@/shared/components/PaginationBar";
import {
  ENROLLMENT_SUB_MENU_DESCRIPTIONS,
  ENROLLMENT_SUB_MENU_OPTIONS,
  UNSECTIONED_POOL_STATUSES,
  BATCH_WORKSPACE_STATUSES,
  OFFICIAL_ROSTER_STATUSES,
  type EnrollmentSubMenu,
} from "@/features/enrollment/workflow.constants";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";

interface Application {
  id: number;
  lrn: string;
  isPendingLrnCreation: boolean;
  learnerType?: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  trackingNumber: string;
  status: string;
  applicantType: string;
  gradeLevelId: number;
  gradeLevel: { name: string };
  createdAt: string;
  generalAverage?: number | null;
  readingProfileLevel?: ReadingProfileLevel | null;
  readingProfileNotes?: string | null;
  readingProfileAssessedAt?: string | null;
  readingProfileAssessedById?: number | null;
  academicStatus?: string | null;
  isRemedialRequired?: boolean;
  enrollmentRecord?: {
    sectionId: number;
    section?: { id: number; name: string } | null;
    transferOutDate?: string | null;
    transferOutReason?: string | null;
    dropOutDate?: string | null;
    dropOutReason?: string | null;
    sf1Remarks?: string | null;
  } | null;
  section?: { name: string } | null;
  studentPhoto?: string | null;
  earlyRegistrationId?: number | null;
  source?: "ENROLLMENT" | "EARLY_REGISTRATION" | null;
  learner: {
    sex: string;
    firstName: string;
    lastName: string;
    lrn: string | null;
  };
}

interface GradeLevel {
  id: number;
  name: string;
}

interface SectionOption {
  id: number;
  name: string;
  maxCapacity: number;
  enrolledCount: number;
  availableSlots: number;
  isFull: boolean;
  programType: string;
}

type PendingQueueFilter = "ALL" | "PENDING_BEEF" | "AWAITING_VERIFICATION";
type ReadingProfileLevel =
  | "INDEPENDENT"
  | "INSTRUCTIONAL"
  | "FRUSTRATION"
  | "NON_READER";

const PENDING_QUEUE_FILTER_OPTIONS: Array<{
  value: PendingQueueFilter;
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "PENDING_BEEF", label: "Pending BEEF" },
  { value: "AWAITING_VERIFICATION", label: "Awaiting Verification" },
];

const TABLE_NO_RESULTS_MESSAGES: Record<EnrollmentSubMenu, string> = {
  UNSECTIONED_POOL: "No unsectioned learners found in the holding pool.",
  BATCH_WORKSPACE: "No learners in the batch sectioning workspace.",
  OFFICIAL_ROSTERS: "No finalized class rosters found for this SY.",
  BOSY_FINALIZATION: "Review BOSY readiness and lockdown controls below.",
};

const READING_PROFILE_LEVEL_OPTIONS: Array<{
  value: ReadingProfileLevel;
  label: string;
}> = [
  { value: "INDEPENDENT", label: "Independent" },
  { value: "INSTRUCTIONAL", label: "Instructional" },
  { value: "FRUSTRATION", label: "Frustration" },
  { value: "NON_READER", label: "Non-reader" },
];

const READING_PROFILE_LABELS: Record<ReadingProfileLevel, string> =
  Object.fromEntries(
    READING_PROFILE_LEVEL_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<ReadingProfileLevel, string>;

function resolveReadingProfileLabel(level?: string | null): string {
  if (!level) {
    return "Not Set";
  }

  return (
    READING_PROFILE_LABELS[level as ReadingProfileLevel] ??
    level
      .toLowerCase()
      .split("_")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ")
  );
}

function extractGradeLevelNumber(rawGradeLevel: string): number | null {
  const match = rawGradeLevel.match(/\d+/);
  if (!match) return null;

  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatGradeLevelLabel(gradeLevelName: string): string {
  if (/^grade\s+/i.test(gradeLevelName)) {
    return gradeLevelName;
  }
  return `Grade ${gradeLevelName}`;
}

function resolveApplicationSectionName(
  application: Application,
): string | null {
  return (
    application.enrollmentRecord?.section?.name ??
    application.section?.name ??
    null
  );
}

function resolveSelectedApplicationSectionName(
  selectedApp: Application | ApplicantDetail | null,
): string | null {
  if (!selectedApp) return null;

  if ("enrollment" in selectedApp && selectedApp.enrollment?.section?.name) {
    return selectedApp.enrollment.section.name;
  }

  if (
    "enrollmentRecord" in selectedApp &&
    selectedApp.enrollmentRecord?.section?.name
  ) {
    return selectedApp.enrollmentRecord.section.name;
  }

  if ("section" in selectedApp && selectedApp.section?.name) {
    return selectedApp.section.name;
  }

  return null;
}

function resolveWorkflowFromQuery(value: string | null): EnrollmentSubMenu {
  if (!value) {
    return "UNSECTIONED_POOL";
  }
  const matched = ENROLLMENT_SUB_MENU_OPTIONS.some(
    (option) => option.value === value,
  );
  return matched ? (value as EnrollmentSubMenu) : "UNSECTIONED_POOL";
}

function SectionListForBulk({
  applicationId,
  applicantType,
  onSelect,
  loading,
}: {
  applicationId: number;
  applicantType: string;
  onSelect: (sectionId: number) => void;
  loading: boolean;
}) {
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/applications/${applicationId}/sections`);
        setSections(res.data.sections ?? []);
      } catch {
        setSections([]);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [applicationId]);

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const filtered = sections.filter((s) => {
    if (applicantType === "REGULAR") return s.programType === "REGULAR";
    return s.programType === applicantType;
  });

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-sm font-bold text-foreground bg-muted/20 rounded-xl border-2 border-dashed">
        No compatible sections found.
      </div>
    );
  }

  return (
    <>
      {filtered.map((section) => {
        const isFull = section.enrolledCount >= section.maxCapacity;
        return (
          <button
            key={section.id}
            disabled={loading || isFull}
            onClick={() => onSelect(section.id)}
            type="button"
            className="flex items-center justify-between p-3 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:bg-muted group w-full">
            <div className="flex flex-col">
              <span className="font-bold text-sm uppercase">
                {section.name.replace(/\s*-\s*G\d+$/i, "")}
              </span>
              <span className="text-xs font-black text-foreground uppercase ">
                {formatScpType(section.programType)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={isFull ? "destructive" : "outline"}
                className="h-6 px-2 font-black tabular-nums">
                {section.enrolledCount}/{section.maxCapacity}
              </Badge>
              {isFull ? "🛑" : "🟢"}
            </div>
          </button>
        );
      })}
    </>
  );
}

export default function Enrollment() {
  const {
    activeSchoolYearId,
    viewingSchoolYearId,
    systemStatus,
    setSettings,
  } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { ayLabel } = useSchoolYearContext();
  const isBosyLocked = systemStatus === "BOSY_LOCKED";
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate = !isHistoricalReadOnly || hasOverride;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const workflowParam = searchParams.get("workflow");
  const searchParam = searchParams.get("search");
  const applicantTypeTabParam = searchParams.get("tab") || "REGULAR";

  const { configs } = useScpConfigs();
  const [applicantTypeTab, setApplicantTypeTab] = useState(
    applicantTypeTabParam,
  );
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  // Filters - Moved up to prevent initialization errors
  const {
    inputValue: searchInputValue,
    setInputValue: setSearchInputValue,
    activeFilter: search,
    isSearching,
  } = useDebouncedSearch(searchParam?.trim() ?? "");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [pendingQueueFilter, setPendingQueueFilter] =
    useState<PendingQueueFilter>("ALL");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">(
    "ALL",
  );

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workflowView, setWorkflowView] = useState<EnrollmentSubMenu>(() =>
    resolveWorkflowFromQuery(workflowParam),
  );
  const workflowViewRef = useRef<EnrollmentSubMenu>(workflowView);

  const [preLockStats, setPreLockStats] = useState<{
    pendingCount: number;
    unsectionedCount: number;
    sectionedCount: number;
  } | null>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockConfirmLabel, setLockConfirmLabel] = useState("");
  const [lockConfirmTouched, setLockConfirmTouched] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [pinTouched, setPinTouched] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const isLockConfirmValid = lockConfirmLabel === ayLabel;
  const isPinValid = /^\d{6}$/.test(adminPin);
  const totalIncomplete =
    (preLockStats?.pendingCount ?? 0) +
    (preLockStats?.unsectionedCount ?? 0);
  const isLockBlocked = !isBosyLocked && totalIncomplete > 0;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const motionState = getReducedMotionProps(shouldReduceMotion);

  const fetchPreLockStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/system/status");
      if (res.data.preLockStats) {
        setPreLockStats(res.data.preLockStats);
      }
    } catch (err) {
      console.error("Failed to fetch pre-lock stats", err);
    }
  }, []);

  useEffect(() => {
    void fetchPreLockStats();
  }, [fetchPreLockStats, systemStatus]);

  const tabs = useMemo(
    () => [
      {
        key: "REGULAR",
        label: "Regular",
        fullLabel: SCP_LABELS.REGULAR ?? "Regular",
      },
      ...configs.map((c) => ({
        key: c.scpType,
        label: SCP_ACRONYMS[c.scpType] || c.scpType,
        fullLabel: SCP_LABELS[c.scpType] || c.scpType,
      })),
    ],
    [configs],
  );

  const fetchTabCount = useCallback(
    async (applicantType: string) => {
      if (!ayId) return 0;
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));

      if (workflowView === "BATCH_WORKSPACE") {
        params.append("status", Array.from(BATCH_WORKSPACE_STATUSES).join(","));
        params.append("withoutSection", "true");
        if (genderFilter !== "ALL") params.append("sex", genderFilter);
      } else {
        params.append("status", Array.from(OFFICIAL_ROSTER_STATUSES).join(","));
        params.append("withSection", "true");
      }

      params.append("applicantType", applicantType);
      params.append("page", "1");
      params.append("limit", "1");

      const res = await api.get(`/applications?${params.toString()}`);
      return Number(res.data?.total ?? res.data?.pagination?.total ?? 0);
    },
    [ayId, workflowView, genderFilter],
  );

  const refreshTabCounts = useCallback(async () => {
    if (
      workflowView !== "OFFICIAL_ROSTERS" &&
      workflowView !== "BATCH_WORKSPACE"
    )
      return;
    try {
      const countEntries = await Promise.all(
        tabs.map(async (tab) => {
          const count = await fetchTabCount(tab.key);
          return [tab.key, count] as const;
        }),
      );
      setTabCounts(Object.fromEntries(countEntries));
    } catch {
      setTabCounts({});
    }
  }, [fetchTabCount, tabs, workflowView]);

  useEffect(() => {
    if (
      workflowView === "OFFICIAL_ROSTERS" ||
      workflowView === "BATCH_WORKSPACE"
    ) {
      void refreshTabCounts();
    }
  }, [refreshTabCounts, workflowView]);

  const handleTabChange = useCallback(
    (value: string) => {
      setApplicantTypeTab(value);
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);
          nextParams.set("tab", value);
          return nextParams;
        },
        { replace: true },
      );
      setPage(1);
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (
      (workflowView === "OFFICIAL_ROSTERS" ||
        workflowView === "BATCH_WORKSPACE") &&
      !tabs.some((t) => t.key === applicantTypeTab)
    ) {
      setApplicantTypeTab("REGULAR");
    }
  }, [applicantTypeTab, tabs, workflowView]);

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const sorting = useMemo<SortingState>(
    () => [{ id: sortBy, desc: sortOrder === "desc" }],
    [sortBy, sortOrder],
  );

  const onSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updaterOrValue === "function"
          ? updaterOrValue(sorting)
          : updaterOrValue;
      if (newSorting.length > 0) {
        setSortBy(newSorting[0].id);
        setSortOrder(newSorting[0].desc ? "desc" : "asc");
      } else {
        setSortBy("name");
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sorting],
  );

  const [sectionOptionsByApplicationId, setSectionOptionsByApplicationId] =
    useState<Record<number, SectionOption[]>>({});
  const [sectionSelectionByApplicationId, setSectionSelectionByApplicationId] =
    useState<Record<number, string>>({});
  const [
    loadingSectionOptionsByApplicationId,
    setLoadingSectionOptionsByApplicationId,
  ] = useState<Record<number, boolean>>({});
  const [savingSectionByApplicationId, setSavingSectionByApplicationId] =
    useState<Record<number, boolean>>({});

  // Detail/Action state
  const [selectedApp, setSelectedApp] = useState<
    Application | ApplicantDetail | null
  >(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<AssessmentStep | null>(null);

  const [exitModal, setExitModal] = useState<{
    open: boolean;
    application: Application | null;
    mode: "create" | "view";
  }>({ open: false, application: null, mode: "create" });

  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    application: Application | null;
  }>({ open: false, application: null });
  const [restoring, setRestoring] = useState(false);

  const [readingProfileDialog, setReadingProfileDialog] = useState<{
    open: boolean;
    application: Application | null;
    level: ReadingProfileLevel | "";
    notes: string;
    saving: boolean;
  }>({
    open: false,
    application: null,
    level: "",
    notes: "",
    saving: false,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sf1ExportOpen, setSf1ExportOpen] = useState(false);
  const [selectedExportSection, setSelectedExportSection] =
    useState<string>("");
  const [sections, setSections] = useState<
    { id: number; name: string; gradeLevelName: string }[]
  >([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Bulk Actions
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  const selectedRows = useMemo(() => {
    return applications.filter((_app, index) => rowSelection[index]);
  }, [applications, rowSelection]);

  const handleBulkAssign = async (sectionId: number) => {
    if (selectedRows.length === 0) return;
    setBulkAssigning(true);
    try {
      lifecycleFeedback.progress(
        "Assigning Learners",
        `Assigning ${selectedRows.length} learner(s) to the selected section.`,
      );
      await api.post("/enrollment/batch-assign-manual", {
        applicationIds: selectedRows.map((r) => r.id),
        sectionId,
      });

      lifecycleFeedback.success(
        "Bulk Assignment Complete",
        `Successfully assigned ${selectedRows.length} learners to section.`,
      );

      setRowSelection({});
      setIsBulkAssignOpen(false);
      void fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setBulkAssigning(false);
    }
  };

  const fetchSections = useCallback(async () => {
    if (!ayId) return;
    setLoadingSections(true);
    try {
      const res = await api.get(`/sections/${ayId}`);
      // The API returns { gradeLevels: [ { gradeLevelName: 'Grade 7', sections: [...] }, ... ] }
      const allSections = res.data.gradeLevels.flatMap(
        (gl: {
          gradeLevelName: string;
          sections: { id: number; name: string }[];
        }) =>
          gl.sections.map((s: { id: number; name: string }) => ({
            ...s,
            gradeLevelName: gl.gradeLevelName,
          })),
      );
      setSections(allSections);
    } catch (err) {
      console.error("Failed to load sections for export", err);
    } finally {
      setLoadingSections(false);
    }
  }, [ayId]);

  const handleExportLis = async () => {
    if (!ayId) return;
    setExporting(true);
    try {
      const response = await api.get("/export/lis-master", {
        params: { schoolYearId: ayId },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `LIS-Master-${ayLabel}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSf1 = async (sectionId: number, sectionName: string) => {
    setExporting(true);
    try {
      lifecycleFeedback.progress(
        "Preparing SF1 Export",
        `Generating School Form 1 for ${sectionName}.`,
      );
      const response = await api.get(`/export/sf1/${sectionId}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `SF1_${sectionName.replace(/\s+/g, "_")}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      lifecycleFeedback.success(
        "Export Complete",
        `School Form 1 for ${sectionName} generated.`,
      );
      setSf1ExportOpen(false);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setExporting(false);
    }
  };

  // Batch Selection state
  const [isBatchWizardOpen, setIsBatchWizardOpen] = useState(false);
  const [isBatchParamsModalOpen, setIsBatchParamsModalOpen] = useState(false);
  const [batchGradeLevelId, setBatchGradeLevelId] = useState<number | null>(
    null,
  );
  const [batchGradeLevelName, setBatchGradeLevelName] = useState<string>("");
  const [isGradeSelectDialogOpen, setIsGradeSelectDialogOpen] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [loadingGradeLevels, setLoadingGradeLevels] = useState(false);

  const [isWalkInGateOpen, setIsWalkInGateOpen] = useState(false);
  const [isBatchConfirmSlipModalOpen, setIsBatchConfirmSlipModalOpen] =
    useState(false);
  const [pinHandover, setPinHandover] = useState<{
    open: boolean;
    learnerName: string;
    pin: string;
  }>({
    open: false,
    learnerName: "",
    pin: "",
  });
  const [walkInLrn, setWalkInLrn] = useState("");
  const [walkInNoLrn, setWalkInNoLrn] = useState(false);
  const [isWalkInGateChecking, setIsWalkInGateChecking] = useState(false);
  const latestFetchRequestRef = useRef(0);

  useEffect(() => {
    workflowViewRef.current = workflowView;
  }, [workflowView]);

  const handleWorkflowViewChange = useCallback(
    (nextView: EnrollmentSubMenu) => {
      if (nextView === workflowViewRef.current) {
        return;
      }

      workflowViewRef.current = nextView;

      // Invalidate in-flight requests before switching views to prevent stale table flashes.
      latestFetchRequestRef.current += 1;
      setWorkflowView(nextView);
      setApplications([]);
      setTotal(0);
      setSelectedId(null);
      setLoading(true);
      setPage(1);

      // Reset sorting to contextual defaults
      if (nextView === "UNSECTIONED_POOL") {
        setSortBy("name");
        setSortOrder("asc");
      } else if (nextView === "BATCH_WORKSPACE") {
        setSortBy("genAve");
        setSortOrder("desc");
      } else if (nextView === "OFFICIAL_ROSTERS") {
        setSortBy("sex");
        setSortOrder("asc");
      } else if (nextView === "BOSY_FINALIZATION") {
        setSortBy("name");
        setSortOrder("asc");
      }
    },
    [],
  );

  const handleLockBosy = useCallback(async () => {
    if (!isLockConfirmValid) {
      setLockConfirmTouched(true);
      lifecycleFeedback.warning(
        "Validation Failed",
        "School year label does not match.",
      );
      return;
    }

    if (!isPinValid) {
      setPinTouched(true);
      lifecycleFeedback.warning(
        "Invalid PIN",
        "Please enter a valid 6-digit Admin PIN.",
      );
      return;
    }

    lifecycleFeedback.progress(
      "Authorizing BOSY Lockdown",
      "Finalizing class rosters and transitioning to academic operations.",
    );
    setIsLocking(true);
    try {
      const res = await api.post("/admin/system/lock-bosy", {
        pin: adminPin,
        yearLabel: lockConfirmLabel,
      });

      lifecycleFeedback.success("BOSY Lockdown Completed", res.data.message);
      const pubRes = await api.get("/settings/public");
      setSettings(pubRes.data);

      setIsLockModalOpen(false);
      setLockConfirmLabel("");
      setLockConfirmTouched(false);
      setAdminPin("");
      setPinTouched(false);

      await fetchPreLockStats();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response: { data?: { message?: string } } }).response
              .data?.message
          : err instanceof Error
            ? err.message
            : "Failed to lock BOSY.";

      lifecycleFeedback.error(
        "BOSY Lockdown Failed",
        message || "An unexpected error occurred.",
      );
    } finally {
      setIsLocking(false);
    }
  }, [
    adminPin,
    fetchPreLockStats,
    isLockConfirmValid,
    isPinValid,
    lockConfirmLabel,
    setSettings,
  ]);

  const fetchGradeLevels = useCallback(async () => {
    if (!ayId) return;
    setLoadingGradeLevels(true);
    try {
      const response = await api.get("/school-years/grade-levels", {
        params: { schoolYearId: ayId },
      });

      const allLevels: GradeLevel[] = response.data.gradeLevels || [];

      // Map to normalize and filter only JHS (7-10)
      const jhsLevels = allLevels.filter((gl) => {
        const num = extractGradeLevelNumber(gl.name);
        return num !== null && num >= 7 && num <= 10;
      });

      // Sort ascending: 7, 8, 9, 10
      const order = [7, 8, 9, 10];
      jhsLevels.sort((a, b) => {
        const numA = extractGradeLevelNumber(a.name) || 0;
        const numB = extractGradeLevelNumber(b.name) || 0;
        return order.indexOf(numA) - order.indexOf(numB);
      });

      setGradeLevels(jhsLevels);
    } catch (err: unknown) {
      toastApiError(err as never);
    } finally {
      setLoadingGradeLevels(false);
    }
  }, [ayId]);

  const openBatchAssignModal = useCallback(() => {
    // If we are currently filtered by a specific grade level, we could auto-select it.
    // For now, always show the selection dialog to be explicit.
    void fetchGradeLevels();
    setIsGradeSelectDialogOpen(true);
  }, [fetchGradeLevels]);

  const handleStartBatchSectioning = useCallback(
    (gradeLevelId: number, gradeLevelName: string) => {
      setBatchGradeLevelId(gradeLevelId);
      setBatchGradeLevelName(gradeLevelName);
      setIsGradeSelectDialogOpen(false);
      setIsBatchParamsModalOpen(true);
    },
    [],
  );

  const visibleApplications = useMemo(() => {
    if (pendingQueueFilter === "ALL") {
      return applications;
    }

    return applications.filter((application) => {
      if (pendingQueueFilter === "PENDING_BEEF") {
        return application.status === "PENDING_BEEF";
      }

      if (pendingQueueFilter === "AWAITING_VERIFICATION") {
        return (
          application.status === "AWAITING_VERIFICATION" ||
          application.status === "SUBMITTED_BEEF"
        );
      }

      return application.status === pendingQueueFilter;
    });
  }, [applications, pendingQueueFilter]);

  const resetWalkInGate = useCallback(() => {
    setWalkInLrn("");
    setWalkInNoLrn(false);
    setIsWalkInGateChecking(false);
  }, []);

  const handleProceedWalkInGate = useCallback(async () => {
    if (walkInNoLrn) {
      setIsWalkInGateOpen(false);
      navigate("/monitoring/enrollment/walk-in?noLrn=true");
      return;
    }

    const normalizedLrn = walkInLrn.trim();
    if (!/^\d{12}$/.test(normalizedLrn)) {
      lifecycleFeedback.error(
        "LRN Required",
        "Enter a valid 12-digit LRN or enable the no-LRN path.",
      );
      return;
    }

    setIsWalkInGateChecking(true);
    try {
      const response = await api.get(
        `/early-registrations/check-lrn/${normalizedLrn}`,
      );
      const existingRecord = Boolean(response.data?.exists);
      const existingStatus = String(response.data?.status ?? "").toUpperCase();
      const existingEnrollmentId = Number(response.data?.enrollmentId ?? 0);
      const isPendingBeefLane =
        existingStatus === "PENDING_BEEF" ||
        existingStatus === "AWAITING_VERIFICATION" ||
        existingStatus === "SUBMITTED_BEEF";

      if (existingRecord) {
        if (response.data?.type === "ENROLLMENT" && isPendingBeefLane) {
          setIsWalkInGateOpen(false);
          navigate(
            `/monitoring/enrollment/walk-in?lrn=${encodeURIComponent(normalizedLrn)}${existingEnrollmentId > 0 ? `&enrollmentId=${existingEnrollmentId}` : ""}`,
          );
          return;
        }

        lifecycleFeedback.progress(
          "Existing Learner Found",
          response.data?.type === "EARLY_REGISTRATION"
            ? "This learner pre-registered in February. Redirecting to Enrollment queue for Delta updates."
            : "This learner already exists in the active enrollment queue. Redirecting now.",
        );

        setIsWalkInGateOpen(false);
        navigate(
          `/monitoring/enrollment?workflow=UNSECTIONED_POOL&search=${encodeURIComponent(normalizedLrn)}`,
        );
        return;
      }

      setIsWalkInGateOpen(false);
      navigate(
        `/monitoring/enrollment/walk-in?lrn=${encodeURIComponent(normalizedLrn)}`,
      );
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsWalkInGateChecking(false);
    }
  }, [navigate, walkInLrn, walkInNoLrn]);

  const openReadingProfileDialog = useCallback((application: Application) => {
    const isKnownReadingProfile = READING_PROFILE_LEVEL_OPTIONS.some(
      (option) => option.value === application.readingProfileLevel,
    );

    setReadingProfileDialog({
      open: true,
      application,
      level: isKnownReadingProfile
        ? (application.readingProfileLevel as ReadingProfileLevel)
        : "",
      notes: application.readingProfileNotes ?? "",
      saving: false,
    });
  }, []);

  const closeReadingProfileDialog = useCallback(() => {
    setReadingProfileDialog({
      open: false,
      application: null,
      level: "",
      notes: "",
      saving: false,
    });
  }, []);

  const handleSaveReadingProfile = useCallback(async () => {
    if (!readingProfileDialog.application) {
      return;
    }

    if (!readingProfileDialog.level) {
      lifecycleFeedback.error(
        "Reading Profile Required",
        "Select a Reading Profile level before saving.",
      );
      return;
    }

    const applicationId = readingProfileDialog.application.id;
    const readingProfileLevel: ReadingProfileLevel = readingProfileDialog.level;
    const readingProfileNotes = readingProfileDialog.notes.trim() || null;

    setReadingProfileDialog((prev) => ({ ...prev, saving: true }));

    try {
      await api.patch(`/applications/${applicationId}/reading-profile`, {
        readingProfileLevel,
        readingProfileNotes,
      });

      setApplications((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                readingProfileLevel,
                readingProfileNotes,
              }
            : application,
        ),
      );

      lifecycleFeedback.success(
        "Reading Profile Saved",
        "Reading Profile was encoded successfully. You can now proceed to section assignment.",
      );

      closeReadingProfileDialog();
    } catch (err) {
      toastApiError(err as never);
      setReadingProfileDialog((prev) => ({ ...prev, saving: false }));
    }
  }, [closeReadingProfileDialog, readingProfileDialog]);

  const fetchData = useCallback(async () => {
    const requestId = ++latestFetchRequestRef.current;

    if (!ayId) {
      if (requestId === latestFetchRequestRef.current) {
        setApplications([]);
        setTotal(0);
        setLoading(false);
      }
      return;
    }

    if (workflowView === "BOSY_FINALIZATION") {
      if (requestId === latestFetchRequestRef.current) {
        setApplications([]);
        setTotal(0);
        setRowSelection({});
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      if (search) params.append("search", search);

      if (workflowView === "UNSECTIONED_POOL") {
        params.append(
          "status",
          Array.from(UNSECTIONED_POOL_STATUSES).join(","),
        );
        params.append("withoutSection", "true");
      }

      if (workflowView === "BATCH_WORKSPACE") {
        params.append("status", Array.from(BATCH_WORKSPACE_STATUSES).join(","));
        params.append("withoutSection", "true");
        if (applicantTypeTab !== "ALL") {
          params.append("applicantType", applicantTypeTab);
        }
        if (genderFilter !== "ALL") {
          params.append("sex", genderFilter);
        }
      }

      if (workflowView === "OFFICIAL_ROSTERS") {
        params.append("status", Array.from(OFFICIAL_ROSTER_STATUSES).join(","));
        params.append("withSection", "true");
        if (applicantTypeTab !== "ALL") {
          params.append("applicantType", applicantTypeTab);
        }
      }

      params.append("page", String(page));
      params.append("limit", String(limit));
      params.append("sortBy", sortBy);
      params.append("sortOrder", sortOrder);

      const res = await api.get(`/applications?${params.toString()}`);

      if (requestId !== latestFetchRequestRef.current) {
        return;
      }

      let filteredApps = (res.data.applications as Application[]).map(
        (app) => ({
          ...app,
          lrn: app.lrn || "",
          isPendingLrnCreation: Boolean(
            (app as unknown as { isPendingLrnCreation?: boolean })
              .isPendingLrnCreation,
          ),
        }),
      );

      filteredApps = filteredApps.filter((app) => {
        const hasSection = Boolean(resolveApplicationSectionName(app));

        if (workflowView === "UNSECTIONED_POOL") {
          return UNSECTIONED_POOL_STATUSES.has(app.status) && !hasSection;
        }

        if (workflowView === "BATCH_WORKSPACE") {
          return BATCH_WORKSPACE_STATUSES.has(app.status) && !hasSection;
        }

        return OFFICIAL_ROSTER_STATUSES.has(app.status) && hasSection;
      });

      setApplications(filteredApps);
      setRowSelection({}); // Clear selection on fetch

      const apiTotal = Number(
        res.data?.total ?? res.data?.pagination?.total ?? filteredApps.length,
      );
      setTotal(apiTotal);
    } catch (err) {
      if (requestId !== latestFetchRequestRef.current) {
        return;
      }
      toastApiError(err as never);
    } finally {
      if (requestId === latestFetchRequestRef.current) {
        setLoading(false);
      }
    }
  }, [
    ayId,
    search,
    page,
    limit,
    workflowView,
    sortBy,
    sortOrder,
    applicantTypeTab,
    genderFilter,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ensureSectionOptionsLoaded = useCallback(
    async (applicationId: number) => {
      if (sectionOptionsByApplicationId[applicationId]) {
        return;
      }

      setLoadingSectionOptionsByApplicationId((prev) => ({
        ...prev,
        [applicationId]: true,
      }));

      try {
        const response = await api.get(
          `/applications/${applicationId}/sections`,
        );
        setSectionOptionsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: response.data.sections ?? [],
        }));
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setLoadingSectionOptionsByApplicationId((prev) => ({
          ...prev,
          [applicationId]: false,
        }));
      }
    },
    [sectionOptionsByApplicationId],
  );

  const handleAssignAndEnroll = useCallback(
    async (application: Application) => {
      if (!application.readingProfileLevel) {
        lifecycleFeedback.error(
          "Reading Profile Required",
          "Encode Reading Profile before assigning this learner to a section.",
        );
        openReadingProfileDialog(application);
        return;
      }

      const selectedSectionId = sectionSelectionByApplicationId[application.id];
      if (!selectedSectionId) {
        lifecycleFeedback.error(
          "Section Required",
          "Select a section before assigning and enrolling.",
        );
        return;
      }

      const sectionOptions =
        sectionOptionsByApplicationId[application.id] || [];
      const selectedSection = sectionOptions.find(
        (s) => String(s.id) === selectedSectionId,
      );

      if (
        selectedSection &&
        selectedSection.enrolledCount >= selectedSection.maxCapacity
      ) {
        const proceed = window.confirm(
          ` Section "${selectedSection.name}" is over capacity (${selectedSection.enrolledCount}/${selectedSection.maxCapacity}). Proceed anyway?`,
        );
        if (!proceed) return;
      }

      setSavingSectionByApplicationId((prev) => ({
        ...prev,
        [application.id]: true,
      }));

      try {
        lifecycleFeedback.progress(
          "Assigning And Enrolling Learner",
          `Processing section placement and enrollment for ${application.lastName}, ${application.firstName}.`,
        );
        const approveResponse = await api.patch(
          `/applications/${application.id}/approve`,
          {
            sectionId: Number(selectedSectionId),
          },
        );

        // If the application was auto-migrated from Phase 1, the new ID will be in the response
        // Note: approve returns an EnrollmentRecord which has enrollmentApplicationId
        const migratedId =
          approveResponse.data.enrollmentApplicationId || application.id;

        const enrollResponse = await api.patch(
          `/applications/${migratedId}/enroll`,
        );

        setSectionSelectionByApplicationId((prev) => {
          const next = { ...prev };
          delete next[application.id];
          return next;
        });

        lifecycleFeedback.success(
          "Assigned & Enrolled",
          `${application.lastName}, ${application.firstName} is now officially enrolled.`,
        );

        if (enrollResponse.data?.rawPortalPin) {
          setPinHandover({
            open: true,
            learnerName: `${application.lastName}, ${application.firstName}`,
            pin: enrollResponse.data.rawPortalPin,
          });
        }

        await fetchData();
      } catch (err) {
        toastApiError(err as never);
      } finally {
        setSavingSectionByApplicationId((prev) => ({
          ...prev,
          [application.id]: false,
        }));
      }
    },
    [
      sectionSelectionByApplicationId,
      sectionOptionsByApplicationId,
      fetchData,
      openReadingProfileDialog,
    ],
  );

  const openExitModal = useCallback(
    (app: Application, mode: "create" | "view" = "create") => {
      setExitModal({ open: true, application: app, mode });
    },
    [],
  );

  const closeExitModal = useCallback(() => {
    setExitModal({ open: false, application: null, mode: "create" });
  }, []);

  const openRestoreDialog = useCallback((app: Application) => {
    setRestoreDialog({ open: true, application: app });
  }, []);

  const closeRestoreDialog = useCallback(() => {
    setRestoreDialog({ open: false, application: null });
  }, []);

  const handleRestoreConfirm = useCallback(async () => {
    if (!restoreDialog.application) return;
    setRestoring(true);
    try {
      await api.patch(
        `/applications/${restoreDialog.application.id}/restore-status`,
      );
      lifecycleFeedback.success(
        "Learner Restored",
        "The learner has been returned to active enrolled status.",
      );
      closeRestoreDialog();
      void fetchData();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setRestoring(false);
    }
  }, [restoreDialog.application, closeRestoreDialog, fetchData]);

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [];

    // Checkbox column for Section Assignment
    if (workflowView === "BATCH_WORKSPACE") {
      cols.push({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            className="translate-y-[2px] border-white data-[state=checked]:bg-white data-[state=checked]:text-primary"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      });
    }

    cols.push({
      id: "photo",
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <UserPhoto
            photo={row.original.studentPhoto}
            containerClassName="w-10 h-10 rounded-full border shadow-sm shrink-0"
            alt={`${row.original.lastName} photo`}
          />
        </div>
      ),
      size: 60,
    });

    cols.push({
      id: "name",
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="NAME"
        />
      ),
      cell: ({ row }) => (
        <span className="font-bold text-sm uppercase leading-tight text-left block min-w-[140px]">
          {row.original.lastName}, {row.original.firstName}
        </span>
      ),
    });

    cols.push({
      id: "lrn",
      accessorKey: "lrn",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="LRN"
        />
      ),
      cell: ({ row }) => (
        <span className="font-bold text-sm block whitespace-nowrap text-center">
          {row.original.lrn ||
            (row.original.isPendingLrnCreation ? "PENDING" : "N/A")}
        </span>
      ),
    });

    // SEX Column
    cols.push({
      id: "sex",
      accessorKey: "learner.sex",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="SEX"
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const sex = row.original.learner.sex;
        return (
          <span className="font-bold text-sm block text-center">
            {sex === "MALE" ? "M" : sex === "FEMALE" ? "F" : "N/A"}
          </span>
        );
      },
      size: 60,
    });

    cols.push({
      id: "program",
      accessorKey: "applicantType",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PROGRAM"
        />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center whitespace-nowrap">
          <Badge
            variant="outline"
            className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
            {formatScpType(row.original.applicantType)}
          </Badge>
        </div>
      ),
    });

    cols.push({
      id: "genAve",
      accessorKey: "generalAverage",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="GEN AVE"
        />
      ),
      cell: ({ row }) => (
        <span className="font-bold text-sm block text-center tabular-nums">
          {row.original.generalAverage?.toFixed(2) || "-"}
        </span>
      ),
    });

    if (workflowView === "UNSECTIONED_POOL") {
      cols.push({
        id: "academicStatus",
        accessorKey: "academicStatus",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="PROMOTION"
          />
        ),
        cell: ({ row }) => {
          const status = row.original.academicStatus;
          const isRemedial = row.original.isRemedialRequired;

          let variant: "default" | "secondary" | "destructive" | "outline" =
            "outline";
          const label = status || "—";

          if (status === "PROMOTED") variant = "secondary";
          if (status === "RETAINED") variant = "destructive";
          if (status === "CONDITIONALLY_PROMOTED") variant = "default";

          return (
            <div className="flex flex-col items-center gap-1">
              <Badge
                variant={variant}
                className="font-bold px-2 py-0.5 h-auto text-xs leading-tight text-center uppercase">
                {label.replace(/_/g, " ")}
              </Badge>
              {isRemedial && (
                <Badge
                  variant="destructive"
                  className="text-[8px] h-4 px-1 font-black animate-pulse">
                  REMEDIAL REQ.
                </Badge>
              )}
            </div>
          );
        },
      });
    }

    if (
      workflowView !== "BATCH_WORKSPACE" &&
      workflowView !== "UNSECTIONED_POOL"
    ) {
      cols.push({
        id: "gradeLevel",
        accessorKey: "gradeLevelId",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="GRADE LEVEL"
          />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm block whitespace-nowrap">
            {formatGradeLevelLabel(row.original.gradeLevel.name)}
          </span>
        ),
      });
    }

    if (
      workflowView === "BATCH_WORKSPACE" ||
      workflowView === "UNSECTIONED_POOL"
    ) {
      cols.push({
        id: "readingProfile",
        accessorKey: "readingProfileLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="READING"
          />
        ),
        cell: ({ row }: CellContext<Application, unknown>) => {
          const app = row.original;

          if (!app.readingProfileLevel) {
            return (
              <div
                className="flex justify-center"
                onClick={(event) => event.stopPropagation()}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-sm font-bold whitespace-nowrap"
                  onClick={() => openReadingProfileDialog(app)}>
                  <FileCheck2 className="h-3 w-3 mr-1" />
                  Set Profile
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-center whitespace-nowrap">
              <Badge
                variant="outline"
                className="font-bold px-2 py-0.5 h-auto border-emerald-300 text-emerald-700 text-sm leading-tight text-center">
                {resolveReadingProfileLabel(app.readingProfileLevel)}
              </Badge>
            </div>
          );
        },
      });
    }

    cols.push({
      id: "context",
      header: workflowView === "UNSECTIONED_POOL" ? "TYPE" : "SECTION",
      cell: ({ row }) => {
        const app = row.original;
        const sectionName = resolveApplicationSectionName(app);
        const hasSection = Boolean(sectionName);
        const isPendingVerification = workflowView === "UNSECTIONED_POOL";
        const isSectionAssignment =
          workflowView === "BATCH_WORKSPACE" ||
          workflowView === "UNSECTIONED_POOL";
        const selectedSectionId = sectionSelectionByApplicationId[app.id] ?? "";
        const sectionOptions = sectionOptionsByApplicationId[app.id] ?? [];
        const isLoadingOptions =
          loadingSectionOptionsByApplicationId[app.id] === true;

        if (isPendingVerification) {
          return (
            <div className="flex justify-center whitespace-nowrap">
              <Badge
                variant="outline"
                className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center">
                {getLearnerTypeLabel(app.learnerType)}
              </Badge>
            </div>
          );
        }

        if (isSectionAssignment && !hasSection) {
          return (
            <div
              className="flex items-center justify-center gap-2"
              onClick={(e) => e.stopPropagation()}>
              <Select
                value={selectedSectionId}
                onValueChange={(value) =>
                  setSectionSelectionByApplicationId((prev) => ({
                    ...prev,
                    [app.id]: value,
                  }))
                }
                onOpenChange={(open) => {
                  if (open) {
                    void ensureSectionOptionsLoaded(app.id);
                  }
                }}>
                <SelectTrigger className="h-9 w-44 text-sm font-bold border-2">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingOptions && (
                    <SelectItem
                      value="LOADING"
                      disabled>
                      Loading sections...
                    </SelectItem>
                  )}
                  {!isLoadingOptions && sectionOptions.length === 0 && (
                    <SelectItem
                      value="NO_SECTION_AVAILABLE"
                      disabled>
                      No sections available
                    </SelectItem>
                  )}
                  {sectionOptions
                    .filter((section) => {
                      if (app.applicantType === "REGULAR") {
                        return section.programType === "REGULAR";
                      }
                      return section.programType === app.applicantType;
                    })
                    .map((section) => {
                      const isOverCapacity =
                        section.enrolledCount >= section.maxCapacity;
                      const fillPercent =
                        (section.enrolledCount / section.maxCapacity) * 100;

                      let capacityColor = "text-emerald-600";
                      let indicator = "🟢";
                      if (fillPercent >= 100) {
                        capacityColor = "text-red-600";
                        indicator = "🛑";
                      } else if (fillPercent >= 90) {
                        capacityColor = "text-amber-600";
                        indicator = "⚠️";
                      }

                      return (
                        <SelectItem
                          key={section.id}
                          value={String(section.id)}
                          disabled={isOverCapacity}
                          className="font-bold">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>
                              {section.name.replace(/\s*-\s*G\d+$/i, "")}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-black tabular-nums flex items-center gap-1.5",
                                capacityColor,
                              )}>
                              ({section.enrolledCount}/{section.maxCapacity})
                              {indicator}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          );
        }

        return (
          <div className="flex justify-center whitespace-nowrap">
            <Badge
              variant="outline"
              className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center text-primary uppercase">
              {(sectionName ?? "Not Assigned").replace(/\s*-\s*G\d+$/i, "")}
            </Badge>
          </div>
        );
      },
    });

    if (
      workflowView !== "BATCH_WORKSPACE" &&
      workflowView !== "UNSECTIONED_POOL"
    ) {
      cols.push({
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="STATUS"
          />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col items-center gap-1">
            <StatusBadge
              status={row.original.status}
              className="text-xs font-bold"
            />
            {row.original.applicantType === "LATE_ENROLLEE" && (
              <Badge className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200 shadow-none px-2 py-0.5 h-auto">
                LATE ENROLLEE
              </Badge>
            )}
          </div>
        ),
      });
    }

    if (
      workflowView !== "BATCH_WORKSPACE" &&
      workflowView !== "UNSECTIONED_POOL"
    ) {
      cols.push({
        id: "createdAt",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="DATE"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold block text-center whitespace-nowrap">
            {format(new Date(row.original.createdAt), "MMMM dd, yyyy")}
          </span>
        ),
      });
    }

    cols.push({
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => {
        const app = row.original;
        const hasReadingProfile = Boolean(app.readingProfileLevel);
        const isPendingBeefStatus =
          app.status === "PENDING_BEEF" ||
          app.status === "READY_FOR_ENROLLMENT";
        const selectedSectionId = sectionSelectionByApplicationId[app.id] ?? "";
        const isSavingSection = savingSectionByApplicationId[app.id] === true;

        if (workflowView === "OFFICIAL_ROSTERS") {
          const isTerminalExit = [
            "TRANSFERRED_OUT",
            "DROPPED_OUT",
            "NO_LONGER_PARTICIPATING",
          ].includes(app.status);
          return (
            <div className="flex items-center justify-center gap-1">
              {/* Primary: View Profile */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(app.id);
                    }}>
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">View Profile</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">View Profile</TooltipContent>
              </Tooltip>

              {/* Overflow: contextual admin actions */}
              {canMutate && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    {isTerminalExit ? (
                      <>
                        <DropdownMenuItem
                          className="gap-2 text-sm cursor-pointer"
                          onClick={() => openExitModal(app, "view")}>
                          <Info className="h-4 w-4 shrink-0" />
                          View Exit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 text-sm cursor-pointer text-amber-600 focus:text-amber-600"
                          onClick={() => openRestoreDialog(app)}>
                          <RotateCcw className="h-4 w-4 shrink-0" />
                          Restore Learner
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer"
                        onClick={() => openExitModal(app)}>
                        <LogOut className="h-4 w-4 shrink-0" />
                        Process Exit
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        }

        const isUnsectionedPool = workflowView === "UNSECTIONED_POOL";
        const isBatchWorkspace = workflowView === "BATCH_WORKSPACE";

        return (
          <div className="flex justify-center">
            <Button
              variant={
                isUnsectionedPool || isBatchWorkspace ? "default" : "secondary"
              }
              size="sm"
              className={
                isUnsectionedPool || isBatchWorkspace
                  ? "h-8 bg-primary text-sm font-bold text-primary-foreground hover:opacity-90 whitespace-nowrap"
                  : "h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground whitespace-nowrap"
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isUnsectionedPool && isPendingBeefStatus) {
                  if (app.lrn) {
                    navigate(
                      `/monitoring/enrollment/walk-in?lrn=${encodeURIComponent(app.lrn)}&enrollmentId=${app.id}`,
                    );
                  } else {
                    navigate(
                      `/monitoring/enrollment/walk-in?noLrn=true&enrollmentId=${app.id}`,
                    );
                  }
                  return;
                }

                if (isUnsectionedPool || isBatchWorkspace) {
                  if (!hasReadingProfile) {
                    openReadingProfileDialog(app);
                    return;
                  }
                  void handleAssignAndEnroll(app);
                  return;
                }
                setSelectedId(app.id);
              }}
              disabled={
                (!canMutate && (isUnsectionedPool || isBatchWorkspace)) ||
                ((isUnsectionedPool || isBatchWorkspace) &&
                  (isSavingSection || !selectedSectionId))
              }>
              {isUnsectionedPool ? (
                isPendingBeefStatus ? (
                  <>
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Encode BEEF
                  </>
                ) : !hasReadingProfile ? (
                  <>
                    <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                    Encode Reading
                  </>
                ) : isSavingSection ? (
                  "Assigning..."
                ) : (
                  <>
                    <School className="h-3.5 w-3.5 mr-1" />
                    Finalize Rollover
                  </>
                )
              ) : isBatchWorkspace ? (
                !hasReadingProfile ? (
                  <>
                    <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                    Encode Reading
                  </>
                ) : isSavingSection ? (
                  "Assigning..."
                ) : (
                  <>
                    <School className="h-3.5 w-3.5 mr-1" />
                    Finalize + Assign
                  </>
                )
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" /> View
                </>
              )}
            </Button>
          </div>
        );
      },
    });

    return cols;
  }, [
    workflowView,
    sectionSelectionByApplicationId,
    sectionOptionsByApplicationId,
    loadingSectionOptionsByApplicationId,
    savingSectionByApplicationId,
    ensureSectionOptionsLoaded,
    handleAssignAndEnroll,
    openReadingProfileDialog,
    openExitModal,
    openRestoreDialog,
    navigate,
    setSelectedId,
    canMutate,
  ]);

  // --- Resizable Panel Logic (Fluid Percentage) ---
  const [panelPercentage, setPanelPercentage] = useState(45);
  const isResizing = useRef(false);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidthPercent =
      ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
    if (newWidthPercent > 20 && newWidthPercent < 95) {
      setPanelPercentage(newWidthPercent);
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", stopResizing);
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, [handleMouseMove]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", stopResizing);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [handleMouseMove, stopResizing]);
  // ------------------------------------------------

  useEffect(() => {
    if (!workflowParam && searchParam === null) {
      return;
    }

    if (workflowParam) {
      handleWorkflowViewChange(resolveWorkflowFromQuery(workflowParam));
    }

    if (searchParam !== null) {
      setSearchInputValue(searchParam.trim());
    }

    setPage(1);
  }, [workflowParam, searchParam, handleWorkflowViewChange]);

  const handleEnroll = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.patch(`/applications/${selectedApp.id}/enroll`);

      setIsEnrollModalOpen(false);
      fetchData();

      if (res.data.rawPortalPin) {
        setPinHandover({
          open: true,
          learnerName: `${selectedApp.lastName}, ${selectedApp.firstName}`,
          pin: res.data.rawPortalPin,
        });
      } else {
        lifecycleFeedback.success(
          "Enrolled",
          "Official enrollment confirmed.",
        );
      }
    } catch (err) {
      toastApiError(err as never);
    }
  };

  const selectedAppSectionName =
    resolveSelectedApplicationSectionName(selectedApp);
  const canConfirmOfficialEnrollment = Boolean(selectedAppSectionName);

  // Persistence: Check for pending batch on mount
  const {
    isBatchPending,
    gradeLevelId: storedGlId,
    previewData: storedPreview,
    setSectioningParams,
  } = useSectioningStore();

  useEffect(() => {
    if (isBatchPending && storedGlId && storedPreview) {
      setBatchGradeLevelId(storedGlId);
      setBatchGradeLevelName(storedPreview.gradeLevelName);
      setIsBatchWizardOpen(true);
    }
  }, [isBatchPending, storedGlId, storedPreview]);

  return (
    <div className="flex flex-col w-full min-w-0 overflow-hidden space-y-4 sm:space-y-6">
      {isBosyLocked && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-lg border-2 border-emerald-400/30">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-black uppercase  leading-none">
                BOSY Locked ({ayLabel})
              </p>
              <p className="text-xs font-bold text-emerald-100 mt-1">
                System is currently processing Late Enrollees only via Inline
                Slotting.
              </p>
            </div>{" "}
          </div>
          <Badge className="bg-white text-emerald-700 font-black hover:bg-white uppercase ">
            Academic Phase
          </Badge>
        </motion.div>
      )}

      <div className="flex relative w-full min-w-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold ">Enrollment Management</h1>
              <p className="text-sm font-bold">
                {ENROLLMENT_SUB_MENU_DESCRIPTIONS[workflowView]}
              </p>
            </div>
            <div className="flex items-center w-full md:w-auto gap-2">
              {workflowView === "OFFICIAL_ROSTERS" && (
                <Button
                  variant="default"
                  className="h-10 px-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 shrink-0"
                  onClick={() => {
                    void fetchSections();
                    setSf1ExportOpen(true);
                  }}
                  disabled={exporting || loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Export LIS Batch
                </Button>
              )}

              {workflowView === "BATCH_WORKSPACE" && (
                <Button
                  variant="default"
                  disabled={isBosyLocked || !canMutate}
                  className="h-10 px-3 text-sm font-bold bg-primary hover:bg-primary/90 disabled:bg-slate-200 disabled:text-slate-500 shrink-0"
                  onClick={() => {
                    void openBatchAssignModal();
                  }}>
                  <School className="h-4 w-4 mr-2" />
                  Open Batch Section Assignment
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 hover:bg-muted"
                title="Refresh Data"
                onClick={() => {
                  void fetchData();
                }}
                disabled={loading || exporting || !ayId}>
                <RefreshCw
                  className={cn("h-5 w-5", loading && "animate-spin")}
                />
              </Button>
            </div>
          </div>

          <EnrollmentWorkflowTabs
            value={workflowView}
            onValueChange={(nextView) => {
              handleWorkflowViewChange(nextView);
            }}
          />

          {workflowView === "OFFICIAL_ROSTERS" && (
            <div className="space-y-4">
              {applications.some(
                (a) => a.status === "TEMPORARILY_ENROLLED",
              ) && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-800 uppercase ">
                      Compliance Warning: Temporary Enrollments
                    </h4>
                    <p className="text-xs font-bold text-amber-700 mt-1 leading-relaxed">
                      {
                        applications.filter(
                          (a) => a.status === "TEMPORARILY_ENROLLED",
                        ).length
                      }{" "}
                      learners in this view have pending PSA/SF9 requirements.
                      Ensure all documents are collected before the{" "}
                      <span className="underline decoration-2 underline-offset-2 font-black">
                        October 31
                      </span>{" "}
                      national LIS deadline.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="w-full">
                <Tabs
                  value={applicantTypeTab}
                  onValueChange={handleTabChange}
                  className="w-full">
                  <TabsList
                    className="grid w-full h-auto gap-1 p-1 bg-white border border-border relative"
                    style={{
                      gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
                    }}>
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        title={tab.fullLabel}
                        className="w-full min-w-0 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                        {applicantTypeTab === tab.key && (
                          <motion.div
                            layoutId="roster-pipeline-active-pill"
                            className="absolute inset-0 bg-primary rounded-md"
                            transition={{
                              type: "spring",
                              bounce: 0.15,
                              duration: 0.5,
                            }}
                          />
                        )}
                        <span className="relative z-20 inline-flex w-full items-center justify-center gap-2 text-xs sm:text-sm">
                          {tab.label}
                          <Badge
                            variant={
                              applicantTypeTab === tab.key
                                ? "secondary"
                                : "outline"
                            }
                            className="h-5 px-1.5 text-xs font-bold">
                            {tabCounts[tab.key] ?? 0}
                          </Badge>
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          )}

          {workflowView === "BATCH_WORKSPACE" && (
            <div className="w-full">
              <Tabs
                value={applicantTypeTab}
                onValueChange={handleTabChange}
                className="w-full">
                <TabsList
                  className="grid w-full h-auto gap-1 p-1 bg-white border border-border relative"
                  style={{
                    gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
                  }}>
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.key}
                      value={tab.key}
                      title={tab.fullLabel}
                      className="w-full min-w-0 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                      {applicantTypeTab === tab.key && (
                        <motion.div
                          layoutId="assignment-pipeline-active-pill"
                          className="absolute inset-0 bg-primary rounded-md"
                          transition={{
                            type: "spring",
                            bounce: 0.15,
                            duration: 0.5,
                          }}
                        />
                      )}
                      <span className="relative z-20 inline-flex w-full items-center justify-center gap-2 text-xs sm:text-sm">
                        {tab.label}
                        <Badge
                          variant={
                            applicantTypeTab === tab.key
                              ? "secondary"
                              : "outline"
                          }
                          className="h-5 px-1.5 text-xs font-bold">
                          {tabCounts[tab.key] ?? 0}
                        </Badge>
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          {workflowView === "BOSY_FINALIZATION" && (
            <motion.div
              variants={sectionVariants}
              transition={panelTransition}
              {...motionState}>
            <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
              <CardHeader className="px-4 sm:px-6 py-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase">BOSY Finalization</h3>
                    <p className="text-sm font-bold text-foreground/70">
                      Review blockers and authorize BOSY lockdown for {ayLabel}.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-5">
                {isBosyLocked && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-black text-emerald-800 uppercase">
                        BOSY Locked - Enrollment Finalized
                      </p>
                      <p className="text-xs font-bold text-emerald-700 mt-0.5">
                        Official class rosters are sealed and grading operations are active.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-foreground/60">Learners Sectioned</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-2xl font-black tabular-nums">
                        {preLockStats?.sectionedCount?.toLocaleString() ?? "..."}
                      </span>
                      <BarChart3 className="h-4 w-4 text-foreground/50" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-foreground/60">Unsectioned Learners</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("text-2xl font-black tabular-nums", (preLockStats?.unsectionedCount ?? 1) === 0 ? "text-foreground" : "text-primary")}>
                        {preLockStats?.unsectionedCount?.toLocaleString() ?? "..."}
                      </span>
                      {(preLockStats?.unsectionedCount ?? 1) === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] font-black uppercase tracking-wide text-foreground/60">Pending Verifications</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={cn("text-2xl font-black tabular-nums", (preLockStats?.pendingCount ?? 1) === 0 ? "text-foreground" : "text-primary")}>
                        {preLockStats?.pendingCount?.toLocaleString() ?? "..."}
                      </span>
                      {(preLockStats?.pendingCount ?? 1) === 0 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                </div>

                {!isBosyLocked && isLockBlocked && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-black uppercase text-primary">Lockdown Blocked</p>
                      <p className="text-xs font-bold text-primary/90 mt-1">
                        {totalIncomplete} learner(s) remain unsectioned or pending verification.
                        Resolve all blockers before locking BOSY.
                      </p>
                    </div>
                  </div>
                )}

                {!isBosyLocked && (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      className="h-12 px-6 text-sm font-black uppercase tracking-wide"
                      disabled={isLockBlocked || isLocking || !canMutate}
                      onClick={() => setIsLockModalOpen(true)}>
                      <Lock className="h-4 w-4 mr-2" />
                      Initiate BOSY Lockdown
                    </Button>
                    <p className="text-xs text-foreground/60 font-bold">
                      Locking BOSY finalizes class rosters, enables SF1 generation, and transitions operations to post-lock workflows.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            </motion.div>
          )}

          {workflowView !== "BOSY_FINALIZATION" && (

          <Card className="border-none shadow-sm bg-[hsl(var(--card))] flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <CardHeader className="px-3 sm:px-6 py-4 border-b border-border/50 shrink-0">
              <div className="flex flex-col xl:flex-row items-center gap-4">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground" />
                  <Input
                    placeholder="Search LRN, First Name, Last Name..."
                    className="pl-10 h-11 text-sm font-bold bg-muted/30 border-2 border-transparent focus:border-primary transition-all"
                    value={searchInputValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchInputValue(val);
                      startTransition(() => {
                        setPage(1);
                      });
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 shrink-0">
                  {workflowView === "BATCH_WORKSPACE" && (
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                      <span className="text-xs font-black uppercase  text-foreground ml-2 mr-1">
                        Gender:
                      </span>
                      {(["ALL", "MALE", "FEMALE"] as const).map((g) => (
                        <Button
                          key={g}
                          variant={genderFilter === g ? "secondary" : "ghost"}
                          size="sm"
                          className={cn(
                            "h-7 px-3 text-xs font-black uppercase rounded-md  transition-all",
                            genderFilter === g
                              ? "bg-white shadow-sm text-primary"
                              : "text-foreground hover:text-primary",
                          )}
                          onClick={() => {
                            setGenderFilter(g);
                            setPage(1);
                          }}>
                          {g === "ALL"
                            ? "All"
                            : g === "MALE"
                              ? "Boys"
                              : "Girls"}
                        </Button>
                      ))}
                    </div>
                  )}

                  {workflowView === "UNSECTIONED_POOL" && (
                    <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg border">
                      <span className="text-xs font-black uppercase  text-foreground ml-2 mr-1">
                        Filter:
                      </span>
                      {PENDING_QUEUE_FILTER_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          variant={
                            pendingQueueFilter === option.value
                              ? "secondary"
                              : "ghost"
                          }
                          size="sm"
                          className={cn(
                            "h-7 px-3 text-xs font-black uppercase rounded-md  transition-all",
                            pendingQueueFilter === option.value
                              ? "bg-white shadow-sm text-primary"
                              : "text-foreground hover:text-primary",
                          )}
                          onClick={() => {
                            setPendingQueueFilter(option.value);
                          }}>
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    className="h-11 px-6 text-sm font-bold border-2 hover:bg-muted"
                    onClick={() => {
                      setSearchInputValue("");
                      setGenderFilter("ALL");
                      setPendingQueueFilter("ALL");
                      setPage(1);
                    }}>
                    Reset Filters
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-auto bg-muted/5 relative">
                <DataTable<Application, unknown>
                  columns={columns}
                  data={visibleApplications}
                  loading={loading}
                  forceEmptyState={isSearching}
                  virtualize={true}
                  estimatedRowHeight={60}
                  className="border-none rounded-none h-full"
                  containerHeight="100%"
                  onRowClick={(app) => {
                    setSelectedId(app.id);
                  }}
                  noResultsMessage={TABLE_NO_RESULTS_MESSAGES[workflowView]}
                  sorting={sorting}
                  onSortingChange={onSortingChange}
                  rowSelection={rowSelection}
                  onRowSelectionChange={setRowSelection}
                  prependBodyRow={isSearching ? <TableSearchIndicator colSpan={11} /> : null}
                />
              </div>

              <PaginationBar
                page={page}
                total={total}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
                itemName="Learners"
              />
            </CardContent>

            {/* STICKY BULK ACTION BAR */}
            <AnimatePresence>
              {selectedRows.length > 0 && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
                  <div className="bg-primary text-primary-foreground px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-8 border-2 border-white/20 backdrop-blur-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase  opacity-80">
                        Bulk Actions
                      </span>
                      <span className="text-lg font-bold">
                        {selectedRows.length} Learners Selected
                      </span>
                    </div>

                    <div className="h-10 w-[1px] bg-white/20" />

                    <div className="flex items-center gap-3">
                      <Dialog
                        open={isBulkAssignOpen}
                        onOpenChange={setIsBulkAssignOpen}>
                        <Button
                          asChild
                          variant="secondary"
                          className="font-bold shadow-lg">
                          <button onClick={() => setIsBulkAssignOpen(true)}>
                            Assign to Section...
                          </button>
                        </Button>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="text-sm font-bold uppercase ">
                              Bulk Section Assignment
                            </DialogTitle>
                            <DialogDescription className="text-sm font-bold">
                              Assign {selectedRows.length} learners to a
                              specific section.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="py-4">
                            <Label className="text-xs font-black uppercase  text-foreground block mb-3">
                              Select Target Section
                            </Label>
                            {/* Simple section list for bulk */}
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                              {/* We fetch sections for the first learner as a representative sample */}
                              {selectedRows[0] && (
                                <SectionListForBulk
                                  applicationId={selectedRows[0].id}
                                  applicantType={selectedRows[0].applicantType}
                                  onSelect={handleBulkAssign}
                                  loading={bulkAssigning}
                                />
                              )}
                            </div>
                          </div>

                          <DialogFooter>
                            <Button
                              variant="ghost"
                              className="font-bold"
                              onClick={() => setIsBulkAssignOpen(false)}>
                              Cancel
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        className="font-bold text-white hover:bg-white/10"
                        onClick={() => setRowSelection({})}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
          )}
        </div>
      </div>

      {/* TIER 1 - SLIDE-OVER PANEL */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}>
        <SheetContent
          side="right"
          className="p-0 flex flex-row border-l overflow-visible w-full sm:w-auto sm:max-w-none"
          style={
            typeof window !== "undefined" && window.innerWidth >= 640
              ? { width: `${panelPercentage}vw` }
              : undefined
          }>
          {/* Resize Handle — hidden on mobile */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          {selectedId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <ApplicationDetailPanel
                id={selectedId}
                onClose={() => setSelectedId(null)}
                onApprove={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setIsEnrollModalOpen(true);
                  }
                }}
                onReject={() => {
                  /* not applicable in enrollment phase */
                }}
                onScheduleExam={async () => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setLoading(true);
                    try {
                      const fullRes = await api.get(
                        `/applications/${selectedId}`,
                      );
                      setSelectedApp(fullRes.data);
                      setScheduleStep(null);
                      setIsScheduleDialogOpen(true);
                    } catch (err) {
                      toastApiError(err as never);
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                onScheduleStep={async (step: AssessmentStep) => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/applications/${selectedId}`,
                    );
                    setSelectedApp(fullRes.data);
                    setScheduleStep(step);
                    setIsScheduleDialogOpen(true);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onRecordStepResult={async (step: AssessmentStep) => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/applications/${selectedId}`,
                    );
                    setSelectedApp(fullRes.data);
                    setScheduleStep(step);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onRecordResult={() => {
                  /* not primary in enrollment phase */
                }}
                onPass={async () => {
                  try {
                    await api.patch(`/applications/${selectedId}/pass`);
                    lifecycleFeedback.success(
                      "Passed",
                      "Applicant marked as PASSED.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onFail={async () => {
                  try {
                    await api.patch(`/applications/${selectedId}/fail`);
                    lifecycleFeedback.success(
                      "Failed",
                      "Applicant marked as FAILED.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onOfferRegular={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setIsEnrollModalOpen(true);
                  }
                }}
                onTemporarilyEnroll={async () => {
                  if (
                    !confirm(
                      "Mark this applicant as temporarily enrolled? This means they can attend classes while documents are pending.",
                    )
                  )
                    return;
                  try {
                    await api.patch(
                      `/applications/${selectedId}/temporarily-enroll`,
                    );
                    lifecycleFeedback.success(
                      "Updated",
                      "Applicant is now temporarily enrolled.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onAssignLrn={async () => {
                  const raw = window.prompt(
                    "Enter the learner's 12-digit LRN:",
                  );
                  if (!raw) return;
                  const lrn = raw.trim();

                  if (!/^\d{12}$/.test(lrn)) {
                    lifecycleFeedback.error(
                      "Invalid LRN",
                      "LRN must be exactly 12 digits.",
                    );
                    return;
                  }

                  try {
                    await api.patch(`/applications/${selectedId}/assign-lrn`, {
                      lrn,
                    });
                    lifecycleFeedback.success(
                      "LRN Assigned",
                      "Learner record updated successfully.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onEnroll={() => {
                  const app = applications.find((a) => a.id === selectedId);
                  if (app) {
                    setSelectedApp(app);
                    setIsEnrollModalOpen(true);
                  }
                }}
                onScheduleInterview={async () => {
                  setLoading(true);
                  try {
                    const fullRes = await api.get(
                      `/applications/${selectedId}`,
                    );
                    const fullApp = fullRes.data as ApplicantDetail;
                    setSelectedApp(fullApp);
                    const interviewStep = fullApp.assessmentSteps?.find(
                      (s) => s.kind === "INTERVIEW" && s.status !== "COMPLETED",
                    );
                    setScheduleStep(interviewStep || null);
                    setIsScheduleDialogOpen(true);
                  } catch (err) {
                    toastApiError(err as never);
                  } finally {
                    setLoading(false);
                  }
                }}
                onMarkVerified={async () => {
                  try {
                    const res = await api.patch(
                      `/applications/${selectedId}/verify`,
                    );

                    // Handle ID change if migrated from Early Registration
                    if (res.data.id && res.data.id !== selectedId) {
                      setSelectedId(res.data.id);
                    }

                    lifecycleFeedback.success(
                      "Verified",
                      "Physical documents verified. Learner is now ready for section assignment.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onSetProfileLock={async (lock) => {
                  if (selectedId === null) return;

                  const actionVerb = lock ? "lock" : "unlock";
                  const confirmed = window.confirm(
                    `Are you sure you want to ${actionVerb} this enrollment profile?`,
                  );
                  if (!confirmed) return;

                  const reasonInput = window
                    .prompt(
                      `Optional reason to ${actionVerb} this enrollment profile:`,
                    )
                    ?.trim();

                  try {
                    await api.patch(
                      `/applications/${selectedId}/profile-lock`,
                      {
                        lock,
                        reason: reasonInput || undefined,
                      },
                    );
                    lifecycleFeedback.success(
                      lock ? "Profile Locked" : "Profile Unlocked",
                      lock
                        ? "Enrollment profile updates are now restricted."
                        : "Enrollment profile updates are now allowed.",
                    );
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Enrollment Confirmation Dialog */}
      <Dialog
        open={isEnrollModalOpen}
        onOpenChange={setIsEnrollModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase ">
              Official Enrollment Confirmation
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              Confirming enrollment for {selectedApp?.lastName},{" "}
              {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm font-bold">
              This action confirms the{" "}
              <span className="font-bold text-green-700">
                OFFICIAL ENROLLMENT
              </span>{" "}
              for Phase 2.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700 font-bold">Section:</span>
                <span className="font-bold">
                  {selectedAppSectionName ?? "Not Assigned"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700 font-bold">Grade Level:</span>
                <span className="font-bold">
                  {selectedApp?.gradeLevel?.name
                    ? formatGradeLevelLabel(selectedApp.gradeLevel.name)
                    : "N/A"}
                </span>
              </div>
            </div>
            {!canConfirmOfficialEnrollment && (
              <p className="text-sm mt-2 font-bold text-amber-700">
                Official enrollment is locked until a section is assigned.
              </p>
            )}
            <p className="text-sm mt-4 italic text-foreground font-bold">
              Ensure all physical documents (PSA, SF9) have been verified in
              person before proceeding.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEnrollModalOpen(false)}
              className="text-sm font-bold">
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-sm font-bold"
              disabled={!canConfirmOfficialEnrollment}
              onClick={handleEnroll}>
              Confirm Official Enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScheduleExamDialog
        open={isScheduleDialogOpen}
        onOpenChange={isScheduleDialogOpen ? setIsScheduleDialogOpen : () => {}}
        applicant={selectedApp as ApplicantDetail | null}
        step={scheduleStep}
        onSuccess={fetchData}
        onCloseSheet={() => setSelectedId(null)}
      />

      <Dialog
        open={isLockModalOpen}
        onOpenChange={(open) => {
          setIsLockModalOpen(open);
          if (!open) {
            setLockConfirmLabel("");
            setLockConfirmTouched(false);
            setAdminPin("");
            setPinTouched(false);
          }
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase">
              Authorize BOSY Lockdown
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              Confirm official lock for S.Y. {ayLabel}. This action requires a
              valid System Admin PIN.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="confirm-sy-bosy"
                className="text-xs font-black uppercase">
                Type {ayLabel} to confirm
              </Label>
              <Input
                id="confirm-sy-bosy"
                value={lockConfirmLabel}
                onChange={(event) => setLockConfirmLabel(event.target.value)}
                onBlur={() => setLockConfirmTouched(true)}
                className={cn(
                  "h-10 text-sm font-bold uppercase",
                  lockConfirmTouched &&
                    !isLockConfirmValid &&
                    "border-primary focus-visible:ring-primary",
                )}
              />
              {lockConfirmTouched && !isLockConfirmValid && (
                <p className="text-xs font-bold text-primary uppercase">
                  School year label does not match.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">
                Enter 6-digit admin PIN
              </Label>
              <AdminPinInput
                value={adminPin}
                onChange={setAdminPin}
                invalid={pinTouched && !isPinValid}
                onBlur={() => setPinTouched(true)}
                autoFocus={isLockModalOpen}
                disabled={isLocking}
                ariaLabel="Enrollment BOSY lock admin PIN"
              />
              {pinTouched && !isPinValid && (
                <p className="text-xs font-bold text-primary uppercase">
                  Valid 6-digit administrative PIN required.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="font-bold"
              disabled={isLocking}
              onClick={() => setIsLockModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="font-bold"
              onClick={handleLockBosy}
              disabled={isLocking || !isLockConfirmValid || !isPinValid}>
              {isLocking ? "Locking..." : "Confirm Lockdown"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isWalkInGateOpen}
        onOpenChange={(open) => {
          setIsWalkInGateOpen(open);
          if (!open) {
            resetWalkInGate();
          }
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase ">
              Verify LRN / Existing Record
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              Check the learner first before opening Direct Intake to avoid
              duplicate BOSY records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="walkInLrn"
                className="text-sm font-bold uppercase ">
                Enter 12-Digit LRN
              </Label>
              <Input
                id="walkInLrn"
                value={walkInLrn}
                maxLength={12}
                disabled={walkInNoLrn || isWalkInGateChecking}
                placeholder="109988776655"
                className="h-10 text-sm font-bold"
                onChange={(event) => {
                  const normalized = event.target.value
                    .replace(/[^\d]/g, "")
                    .slice(0, 12);
                  setWalkInLrn(normalized);
                }}
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <Checkbox
                id="walkInNoLrn"
                checked={walkInNoLrn}
                disabled={isWalkInGateChecking}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setWalkInNoLrn(enabled);
                  if (enabled) {
                    setWalkInLrn("");
                  }
                }}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="walkInNoLrn"
                  className="text-sm font-bold ">
                  Learner has no LRN yet
                </Label>
                <p className="text-[11px] font-bold text-foreground">
                  Use only for incoming Grade 7 or transferee walk-ins.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-sm font-bold"
              disabled={isWalkInGateChecking}
              onClick={() => setIsWalkInGateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="text-sm font-bold"
              disabled={isWalkInGateChecking}
              onClick={() => {
                void handleProceedWalkInGate();
              }}>
              {isWalkInGateChecking ? "Checking..." : "Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={readingProfileDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeReadingProfileDialog();
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase ">
              Encode Reading Profile
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              Reading Profile is required before section assignment and official
              enrollment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase ">Learner</Label>
              <p className="text-sm font-bold">
                {readingProfileDialog.application
                  ? `${readingProfileDialog.application.lastName}, ${readingProfileDialog.application.firstName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="readingProfileLevel"
                className="text-sm font-bold uppercase ">
                Reading Profile Level
              </Label>
              <Select
                value={readingProfileDialog.level}
                onValueChange={(value) => {
                  setReadingProfileDialog((prev) => ({
                    ...prev,
                    level: value as ReadingProfileLevel,
                  }));
                }}>
                <SelectTrigger
                  id="readingProfileLevel"
                  className="h-10 text-sm font-bold">
                  <SelectValue placeholder="Select reading profile" />
                </SelectTrigger>
                <SelectContent>
                  {READING_PROFILE_LEVEL_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="readingProfileNotes"
                className="text-sm font-bold uppercase ">
                Notes (Optional)
              </Label>
              <Textarea
                id="readingProfileNotes"
                value={readingProfileDialog.notes}
                onChange={(event) => {
                  setReadingProfileDialog((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }));
                }}
                placeholder="Record assessment notes or remarks"
                className="min-h-24 text-sm font-bold"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-sm font-bold"
              onClick={closeReadingProfileDialog}
              disabled={readingProfileDialog.saving}>
              Cancel
            </Button>
            <Button
              className="text-sm font-bold"
              disabled={
                readingProfileDialog.saving || !readingProfileDialog.level
              }
              onClick={() => {
                void handleSaveReadingProfile();
              }}>
              {readingProfileDialog.saving
                ? "Saving..."
                : "Save Reading Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LearnerExitModal
        open={exitModal.open}
        mode={exitModal.mode}
        application={exitModal.application}
        onClose={closeExitModal}
        onSuccess={() => {
          closeExitModal();
          void fetchData();
        }}
      />

      {/* Restore Learner Confirmation Dialog */}
      <Dialog
        open={restoreDialog.open}
        onOpenChange={(open) => {
          if (!open) closeRestoreDialog();
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-wide">
              Restore Learner to Active Status?
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">
              You are about to reverse this learner's exit. This will clear
              their exit date and reason, returning them to the active Official
              Class Roster and resuming their inclusion in DepEd SF4 and grading
              reports.
            </p>
            <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-300 rounded-md px-3 py-2">
              Only do this to correct an administrative error.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="text-sm font-bold"
              onClick={closeRestoreDialog}
              disabled={restoring}>
              Cancel
            </Button>
            <Button
              className="text-sm font-bold bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                void handleRestoreConfirm();
              }}
              disabled={restoring}>
              {restoring ? "Restoring..." : "Confirm Restoration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Level Selection for Batch Sectioning */}
      <Dialog
        open={isGradeSelectDialogOpen}
        onOpenChange={setIsGradeSelectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase ">
              Select Grade Level for Batch Sectioning
            </DialogTitle>
            <DialogDescription className="text-sm font-bold">
              The Batch Wizard will run on the entire unassigned pool of
              learners for the selected grade level.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase ">
                Target Grade Level
              </Label>
              <div className="grid grid-cols-1 gap-3">
                {loadingGradeLevels ? (
                  <div className="col-span-2 flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  gradeLevels.map((gl) => {
                    const gradeNum = extractGradeLevelNumber(gl.name);
                    const isG7 = gradeNum === 7;

                    return (
                      <div
                        key={gl.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className="flex-1">
                          <p className="font-bold text-sm">
                            {formatGradeLevelLabel(gl.name)}
                          </p>
                          <p className="text-xs text-foreground uppercase font-black ">
                            {isG7
                              ? "Uses Early Reg Assessment Score"
                              : "Uses Final General Average from EnrollPro records"}
                          </p>
                        </div>

                        <Button
                          variant="default"
                          size="sm"
                          className="h-9 px-4 font-bold text-sm bg-primary hover:bg-primary/90"
                          onClick={() =>
                            handleStartBatchSectioning(gl.id, gl.name)
                          }>
                          Open Wizard
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsGradeSelectDialogOpen(false)}
              className="text-sm font-bold">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BatchSectioningParamsModal
        isOpen={isBatchParamsModalOpen}
        onClose={() => setIsBatchParamsModalOpen(false)}
        onRun={(params) => {
          setSectioningParams(params);
          setIsBatchParamsModalOpen(false);
          setIsBatchWizardOpen(true);
        }}
        gradeLevelId={batchGradeLevelId || 0}
        gradeLevelName={batchGradeLevelName}
        schoolYearId={ayId || 0}
        isGrade7={batchGradeLevelName.includes("7")}
      />

      <BatchSectioningWizard
        isOpen={isBatchWizardOpen}
        onClose={() => setIsBatchWizardOpen(false)}
        onSuccess={() => {
          fetchData();
          setSearchInputValue(""); // Phase 4: Search Reset
        }}
        gradeLevelId={batchGradeLevelId || 0}
        gradeLevelName={batchGradeLevelName}
        schoolYearId={ayId || 0}
      />

      <BatchConfirmationModal
        open={isBatchConfirmSlipModalOpen}
        onOpenChange={setIsBatchConfirmSlipModalOpen}
        activeSchoolYearId={ayId}
        onSuccess={fetchData}
      />

      <PinHandoverModal
        open={pinHandover.open}
        onOpenChange={(open) => setPinHandover((prev) => ({ ...prev, open }))}
        learnerName={pinHandover.learnerName}
        pin={pinHandover.pin}
      />

      <Dialog
        open={sf1ExportOpen}
        onOpenChange={setSf1ExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <Download className="h-5 w-5 text-emerald-600" />
              </div>
              <DialogTitle className="text-sm font-bold uppercase ">
                Export LIS Batch / SF1
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm font-bold">
              Select an export format. School Form 1 (SF1) requires selecting a
              specific section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Option 1: Full LIS Master */}
            <div className="p-4 rounded-xl border-2 border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 transition-all">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-emerald-800">
                    LIS Master Extract (XLSX)
                  </h4>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5">
                    Official BOSY/EOSY data extract for all sections in{" "}
                    {ayLabel}.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9"
                  onClick={handleExportLis}
                  disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Export XLSX"
                  )}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-foreground font-black ">
                  OR
                </span>
              </div>
            </div>

            {/* Option 2: SF1 by Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-black uppercase  text-foreground">
                  School Form 1 (SF1 Excel)
                </Label>
                <Badge className="h-4 px-1.5 text-[8px] font-black bg-primary/10 text-primary border-none">
                  Official Template
                </Badge>
              </div>

              <div className="flex flex-col gap-3">
                <Select
                  value={selectedExportSection}
                  onValueChange={setSelectedExportSection}>
                  <SelectTrigger className="h-11 font-bold text-sm bg-muted/30 border-2">
                    <SelectValue placeholder="Select a section to export..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {loadingSections ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    ) : sections.length === 0 ? (
                      <div className="text-center py-4 text-xs font-bold text-foreground">
                        No sections found for this year.
                      </div>
                    ) : (
                      sections.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={String(s.id)}
                          className="font-bold">
                          {s.name} ({s.gradeLevelName})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  className="w-full h-11 font-bold bg-primary hover:opacity-90"
                  disabled={exporting || !selectedExportSection}
                  onClick={() => {
                    const sec = sections.find(
                      (s) => String(s.id) === selectedExportSection,
                    );
                    if (sec) {
                      void handleExportSf1(sec.id, sec.name);
                    }
                  }}>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Generate SF1 Excel
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="text-xs font-bold uppercase "
              onClick={() => setSf1ExportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
