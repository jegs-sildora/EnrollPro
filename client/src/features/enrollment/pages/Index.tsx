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
  Download,
  RefreshCw,
  FileCheck2,
  School,
  UserPlus,
  LogOut,
  Loader2,
} from "lucide-react";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { cn, formatScpType, getLearnerTypeLabel } from "@/shared/lib/utils";
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
import type {
  CellContext,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { BatchSectioningWizard } from "@/features/enrollment/components/BatchSectioningWizard";
import { BatchSectioningParamsModal } from "@/features/enrollment/components/BatchSectioningParamsModal";
import { ApplicationDetailPanel } from "@/features/enrollment/components/ApplicationDetailPanel";
import { ScheduleExamDialog } from "@/features/enrollment/components/ScheduleExamDialog";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { EnrollmentWorkflowTabs } from "@/features/enrollment/components/EnrollmentWorkflowTabs";
import { useSectioningStore } from "@/store/sectioning.slice";
import {
  ENROLLMENT_SUB_MENU_DESCRIPTIONS,
  ENROLLMENT_SUB_MENU_OPTIONS,
  PENDING_VERIFICATION_STATUSES,
  SECTION_ASSIGNMENT_STATUSES,
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
  enrollmentRecord?: {
    sectionId: number;
    section?: { id: number; name: string } | null;
  } | null;
  section?: { name: string } | null;
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

type PendingQueueFilter = "ALL" | "INCOMING_G7" | "CONTINUING_JHS";
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
  { value: "INCOMING_G7", label: "Incoming G7" },
  { value: "CONTINUING_JHS", label: "Continuing JHS" },
];

const TABLE_NO_RESULTS_MESSAGES: Record<EnrollmentSubMenu, string> = {
  PENDING_VERIFICATION: "No learners awaiting verification.",
  SECTION_ASSIGNMENT: "No learners ready for section assignment.",
  OFFICIAL_ROSTER: "No enrolled learners in official roster.",
};

const UNENROLL_REASONS = [
  "Data Entry Error",
  "Transferred before opening of classes",
  "Requested withdrawal by guardian",
  "Duplicate enrollment record",
  "Other registrar correction",
] as const;

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
    return "PENDING_VERIFICATION";
  }

  const matched = ENROLLMENT_SUB_MENU_OPTIONS.some(
    (option) => option.value === value,
  );

  return matched ? (value as EnrollmentSubMenu) : "PENDING_VERIFICATION";
}

export default function Enrollment() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workflowParam = searchParams.get("workflow");
  const searchParam = searchParams.get("search");

  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isExportingLis, setIsExportingLis] = useState(false);
  const [workflowView, setWorkflowView] = useState<EnrollmentSubMenu>(() =>
    resolveWorkflowFromQuery(workflowParam),
  );
  const workflowViewRef = useRef<EnrollmentSubMenu>(workflowView);

  // Filters
  const [search, setSearch] = useState(() => searchParam?.trim() ?? "");
  const [page, setPage] = useState(1);
  const [pendingQueueFilter, setPendingQueueFilter] =
    useState<PendingQueueFilter>("ALL");

  const [sortBy, setSortBy] = useState<string>("createdAt");
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
        setSortBy("createdAt");
        setSortOrder("desc");
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

  const [unenrollDialog, setUnenrollDialog] = useState<{
    open: boolean;
    application: Application | null;
    reason: string;
    note: string;
  }>({
    open: false,
    application: null,
    reason: "",
    note: "",
  });

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

  // Batch Selection state
  const [isBatchWizardOpen, setIsBatchWizardOpen] = useState(false);
  const [isBatchParamsModalOpen, setIsBatchParamsModalOpen] = useState(false);
  const [batchGradeLevelId, setBatchGradeLevelId] = useState<number | null>(
    null,
  );
  const [batchGradeLevelName, setBatchGradeLevelName] = useState<string>("");
  const [isGradeSelectDialogOpen, setIsGradeSelectDialogOpen] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<any[]>([]);
  const [loadingGradeLevels, setLoadingGradeLevels] = useState(false);

  const [isWalkInGateOpen, setIsWalkInGateOpen] = useState(false);
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
    },
    [],
  );

  const fetchGradeLevels = useCallback(async () => {
    if (!ayId) return;
    setLoadingGradeLevels(true);
    try {
      const response = await api.get("/school-years/grade-levels", {
        params: { schoolYearId: ayId },
      });

      const allLevels = response.data.gradeLevels || [];

      // Map to normalize and filter only JHS (7-10)
      const jhsLevels = allLevels.filter((gl: any) => {
        const num = extractGradeLevelNumber(gl.name);
        return num !== null && num >= 7 && num <= 10;
      });

      // Sort according to user preference: 7, 9, 8, 10
      const order = [7, 9, 8, 10];
      jhsLevels.sort((a: any, b: any) => {
        const numA = extractGradeLevelNumber(a.name) || 0;
        const numB = extractGradeLevelNumber(b.name) || 0;
        return order.indexOf(numA) - order.indexOf(numB);
      });

      setGradeLevels(jhsLevels);
    } catch (err) {
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
    if (workflowView !== "PENDING_VERIFICATION") {
      return applications;
    }

    if (pendingQueueFilter === "ALL") {
      return applications;
    }

    return applications.filter((application) => {
      const gradeLevelNumber = extractGradeLevelNumber(
        application.gradeLevel.name,
      );

      if (pendingQueueFilter === "INCOMING_G7") {
        return gradeLevelNumber === 7;
      }

      return application.learnerType === "CONTINUING";
    });
  }, [applications, pendingQueueFilter, workflowView]);

  const resetWalkInGate = useCallback(() => {
    setWalkInLrn("");
    setWalkInNoLrn(false);
    setIsWalkInGateChecking(false);
  }, []);

  const openWalkInGate = useCallback(() => {
    resetWalkInGate();
    setIsWalkInGateOpen(true);
  }, [resetWalkInGate]);

  const handleProceedWalkInGate = useCallback(async () => {
    if (walkInNoLrn) {
      setIsWalkInGateOpen(false);
      navigate("/monitoring/enrollment/walk-in?noLrn=true");
      return;
    }

    const normalizedLrn = walkInLrn.trim();
    if (!/^\d{12}$/.test(normalizedLrn)) {
      sileo.error({
        title: "LRN Required",
        description: "Enter a valid 12-digit LRN or enable the no-LRN path.",
      });
      return;
    }

    setIsWalkInGateChecking(true);
    try {
      const response = await api.get(
        `/early-registrations/check-lrn/${normalizedLrn}`,
      );
      const existingRecord = Boolean(response.data?.exists);

      if (existingRecord) {
        sileo.info({
          title: "Existing Learner Found",
          description:
            response.data?.type === "EARLY_REGISTRATION"
              ? "This learner pre-registered in February. Redirecting to Enrollment queue for Delta updates."
              : "This learner already exists in the active enrollment queue. Redirecting now.",
        });

        setIsWalkInGateOpen(false);
        navigate(
          `/monitoring/enrollment?workflow=PENDING_VERIFICATION&search=${encodeURIComponent(normalizedLrn)}`,
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
      sileo.error({
        title: "Reading Profile Required",
        description: "Select a Reading Profile level before saving.",
      });
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

      sileo.success({
        title: "Reading Profile Saved",
        description:
          "Reading Profile was encoded successfully. You can now proceed to section assignment.",
      });

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
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("schoolYearId", String(ayId));
      if (search) params.append("search", search);

      if (workflowView === "PENDING_VERIFICATION") {
        params.append(
          "status",
          Array.from(PENDING_VERIFICATION_STATUSES).join(","),
        );
        params.append("withoutSection", "true");
      }

      if (workflowView === "SECTION_ASSIGNMENT") {
        params.append("status", "VERIFIED");
        params.append("withoutSection", "true");
      }

      if (workflowView === "OFFICIAL_ROSTER") {
        params.append("status", Array.from(OFFICIAL_ROSTER_STATUSES).join(","));
        params.append("withSection", "true");
      }

      params.append("page", String(page));
      params.append("limit", "15");
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

        if (workflowView === "PENDING_VERIFICATION") {
          return PENDING_VERIFICATION_STATUSES.has(app.status) && !hasSection;
        }

        if (workflowView === "SECTION_ASSIGNMENT") {
          return SECTION_ASSIGNMENT_STATUSES.has(app.status) && !hasSection;
        }

        return OFFICIAL_ROSTER_STATUSES.has(app.status as any) && hasSection;
      });

      setApplications(filteredApps);

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
  }, [ayId, search, page, workflowView, sortBy, sortOrder]);

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
        sileo.error({
          title: "Reading Profile Required",
          description:
            "Encode Reading Profile before assigning this learner to a section.",
        });
        openReadingProfileDialog(application);
        return;
      }

      const selectedSectionId = sectionSelectionByApplicationId[application.id];
      if (!selectedSectionId) {
        sileo.error({
          title: "Section Required",
          description: "Select a section before assigning and enrolling.",
        });
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
          `⚠️ Section "${selectedSection.name}" is over capacity (${selectedSection.enrolledCount}/${selectedSection.maxCapacity}). Proceed anyway?`,
        );
        if (!proceed) return;
      }

      setSavingSectionByApplicationId((prev) => ({
        ...prev,
        [application.id]: true,
      }));

      try {
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

        sileo.success({
          title: "Assigned & Enrolled",
          description: `${application.lastName}, ${application.firstName} is now officially enrolled.`,
        });

        if (enrollResponse.data?.rawPortalPin) {
          alert(
            `SUCCESS: Official enrollment confirmed.\n\nIMPORTANT: The Learner Portal PIN is ${enrollResponse.data.rawPortalPin}\n\nPlease write this down on the enrollment slip. This PIN will only be shown once.`,
          );
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
    [sectionSelectionByApplicationId, fetchData, openReadingProfileDialog],
  );

  const openUnenrollDialog = useCallback((app: Application) => {
    setUnenrollDialog({
      open: true,
      application: app,
      reason: "",
      note: "",
    });
  }, []);

  const closeUnenrollDialog = useCallback(() => {
    setUnenrollDialog({
      open: false,
      application: null,
      reason: "",
      note: "",
    });
  }, []);

  const handleUnenrollSubmit = useCallback(async () => {
    if (!unenrollDialog.application) return;

    if (!unenrollDialog.reason) {
      sileo.error({
        title: "Reason Required",
        description: "Select a reason before un-enrolling this learner.",
      });
      return;
    }

    try {
      await api.patch(
        `/applications/${unenrollDialog.application.id}/unenroll`,
        {
          reason: unenrollDialog.reason,
          note: unenrollDialog.note.trim() || undefined,
        },
      );

      sileo.success({
        title: "Un-enrolled",
        description: "Learner has been removed from the official roster.",
      });

      closeUnenrollDialog();
      await fetchData();
    } catch (err) {
      toastApiError(err as never);
    }
  }, [closeUnenrollDialog, fetchData, unenrollDialog]);

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [];

    cols.push({
      id: "student",
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="LEARNER"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col text-left min-w-[200px]">
          <span className="font-bold text-sm uppercase">
            {row.original.lastName}, {row.original.firstName}
          </span>
          <span className="text-[11px] font-black text-muted-foreground tracking-tighter">
            {row.original.lrn ||
              (row.original.isPendingLrnCreation ? "PENDING" : "NO LRN")}
          </span>
        </div>
      ),
    });

    if (workflowView !== "SECTION_ASSIGNMENT") {
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
          <span className="font-bold text-sm block">
            {row.original.lrn ||
              (row.original.isPendingLrnCreation ? "PENDING" : "N/A")}
          </span>
        ),
      });
    }

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
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className="font-bold px-2 py-0.5 h-auto border-slate-300 text-xs leading-tight text-center">
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
        <span className="font-bold text-sm block text-center">
          {row.original.generalAverage?.toFixed(2) || "-"}
        </span>
      ),
    });

    if (workflowView !== "SECTION_ASSIGNMENT") {
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
          <span className="font-bold text-sm block">
            {formatGradeLevelLabel(row.original.gradeLevel.name)}
          </span>
        ),
      });
    }

    if (workflowView === "SECTION_ASSIGNMENT") {
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
                  className="h-7 text-xs font-bold"
                  onClick={() => openReadingProfileDialog(app)}>
                  <FileCheck2 className="h-3 w-3 mr-1" />
                  Set Profile
                </Button>
              </div>
            );
          }

          return (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="font-bold px-2 py-0.5 h-auto border-emerald-300 text-emerald-700 text-xs leading-tight text-center">
                {resolveReadingProfileLabel(app.readingProfileLevel)}
              </Badge>
            </div>
          );
        },
      });
    }

    cols.push({
      id: "context",
      header: workflowView === "PENDING_VERIFICATION" ? "TYPE" : "SECTION",
      cell: ({ row }) => {
        const app = row.original;
        const sectionName = resolveApplicationSectionName(app);
        const hasSection = Boolean(sectionName);
        const isPendingVerification = workflowView === "PENDING_VERIFICATION";
        const isSectionAssignment = workflowView === "SECTION_ASSIGNMENT";
        const selectedSectionId = sectionSelectionByApplicationId[app.id] ?? "";
        const sectionOptions = sectionOptionsByApplicationId[app.id] ?? [];
        const isLoadingOptions =
          loadingSectionOptionsByApplicationId[app.id] === true;

        if (isPendingVerification) {
          return (
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="font-bold px-2 py-0.5 h-auto border-slate-300 text-xs leading-tight text-center">
                {getLearnerTypeLabel(app.learnerType)}
              </Badge>
            </div>
          );
        }

        if (isSectionAssignment && !hasSection) {
          return (
            <div
              className="flex items-center justify-center gap-2 min-w-[160px]"
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
                <SelectTrigger className="h-8 w-40 text-xs font-bold border-2">
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
                      if (fillPercent >= 100) capacityColor = "text-red-600";
                      else if (fillPercent >= 90)
                        capacityColor = "text-amber-600";

                      return (
                        <SelectItem
                          key={section.id}
                          value={String(section.id)}
                          className="font-bold">
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{section.name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-black tabular-nums",
                                capacityColor,
                              )}>
                              ({section.enrolledCount}/{section.maxCapacity})
                              {isOverCapacity && " ⚠️"}
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
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="font-bold px-2 py-0.5 h-auto border-slate-300 text-sm leading-tight text-center text-primary">
              {sectionName ?? "Not Assigned"}
            </Badge>
          </div>
        );
      },
    });

    if (workflowView !== "SECTION_ASSIGNMENT") {
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
          <div className="flex justify-center">
            <StatusBadge
              status={row.original.status}
              className="text-sm font-bold"
            />
          </div>
        ),
      });
    }

    if (workflowView !== "SECTION_ASSIGNMENT") {
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
          <span className="text-sm font-bold block text-center min-w-[140px]">
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
        const isPendingVerification = workflowView === "PENDING_VERIFICATION";
        const isSectionAssignment = workflowView === "SECTION_ASSIGNMENT";
        const hasReadingProfile = Boolean(app.readingProfileLevel);
        const selectedSectionId = sectionSelectionByApplicationId[app.id] ?? "";
        const isSavingSection = savingSectionByApplicationId[app.id] === true;

        if (workflowView === "OFFICIAL_ROSTER") {
          return (
            <div className="flex items-center justify-center gap-2 min-w-[200px]">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(app.id);
                }}>
                <Eye className="h-3 w-3 mr-1" /> View
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-sm font-bold border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  openUnenrollDialog(app);
                }}>
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Un-enrol
              </Button>
            </div>
          );
        }

        return (
          <div className="flex justify-center min-w-[150px]">
            <Button
              variant={
                isPendingVerification || isSectionAssignment
                  ? "default"
                  : "secondary"
              }
              size="sm"
              className={
                isPendingVerification || isSectionAssignment
                  ? "h-8 bg-primary text-sm font-bold text-primary-foreground hover:opacity-90"
                  : "h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isSectionAssignment) {
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
                isSectionAssignment && (isSavingSection || !selectedSectionId)
              }>
              {isPendingVerification ? (
                <>
                  <FileCheck2 className="h-3.5 w-3.5 mr-1" />
                  Verify Docs
                </>
              ) : isSectionAssignment ? (
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
    openUnenrollDialog,
    setSelectedId,
  ]);

  useEffect(() => {
    if (workflowView !== "PENDING_VERIFICATION") {
      setPendingQueueFilter("ALL");
    }
  }, [workflowView]);

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
      setSearch(searchParam.trim());
    }

    setPage(1);
  }, [workflowParam, searchParam, handleWorkflowViewChange]);

  const handleExportLis = async () => {
    if (workflowView !== "OFFICIAL_ROSTER") {
      sileo.error({
        title: "Official Roster Required",
        description:
          "Switch to Official Roster before exporting LIS Master CSV.",
      });
      return;
    }

    if (!ayId) return;

    setIsExportingLis(true);
    try {
      const response = await api.get("/applications/exports/lis-master", {
        params: { schoolYearId: ayId },
        responseType: "blob",
      });

      const contentDisposition =
        (response.headers?.["content-disposition"] as string | undefined) ?? "";
      const fileNameMatch = contentDisposition.match(
        /filename\*?=(?:UTF-8''|")?([^";]+)/i,
      );
      const fileName = fileNameMatch?.[1]
        ? decodeURIComponent(fileNameMatch[1].replace(/"/g, ""))
        : `lis-master-${ayId}.csv`;

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      sileo.success({
        title: "LIS Export Ready",
        description: "Master CSV downloaded successfully.",
      });
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setIsExportingLis(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.patch(`/applications/${selectedApp.id}/enroll`);

      setIsEnrollModalOpen(false);
      fetchData();

      if (res.data.rawPortalPin) {
        alert(
          `SUCCESS: Official enrollment confirmed.\n\nIMPORTANT: The Learner Portal PIN is ${res.data.rawPortalPin}\n\nPlease write this down on the enrollment slip. This PIN will only be shown once.`,
        );
      } else {
        sileo.success({
          title: "Enrolled",
          description: "Official enrollment confirmed.",
        });
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
    <div className="flex relative w-full min-w-0 overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col space-y-4 sm:space-y-6 px-2 sm:px-0 pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Enrollment Management
            </h1>
            <p className="text-xs font-bold">
              {ENROLLMENT_SUB_MENU_DESCRIPTIONS[workflowView]}
            </p>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Button
              variant="default"
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold bg-primary hover:bg-primary/90"
              onClick={() => {
                void openBatchAssignModal();
              }}>
              <School className="h-4 w-4 mr-2" />
              Open Batch Section Assignment
            </Button>
            <Button
              variant="outline"
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
              onClick={openWalkInGate}>
              <UserPlus className="h-4 w-4 mr-2" />+ Walk-In BEEF
            </Button>
            <Button
              variant="outline"
              className="h-10 px-3 flex-1 md:flex-none text-sm font-bold"
              onClick={() => {
                void fetchData();
              }}
              disabled={loading || !ayId}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Button
              variant="outline"
              className={`h-10 px-3 flex-1 md:flex-none text-sm font-bold ${
                workflowView !== "OFFICIAL_ROSTER"
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
              onClick={handleExportLis}
              disabled={
                isExportingLis || !ayId || workflowView !== "OFFICIAL_ROSTER"
              }>
              <Download className="h-4 w-4 mr-2" />
              {isExportingLis
                ? "Exporting LIS..."
                : workflowView === "OFFICIAL_ROSTER"
                  ? "Export LIS Master CSV"
                  : "Export LIS (Official Roster Only)"}
            </Button>
          </div>
        </div>

        <EnrollmentWorkflowTabs
          value={workflowView}
          onValueChange={(nextView) => {
            handleWorkflowViewChange(nextView);
          }}
        />

        <Card className="border-none shadow-sm bg-[hsl(var(--card))] max-w-full overflow-hidden">
          <CardHeader className="px-3 sm:px-6 pb-3">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <Label className="text-sm uppercase tracking-wider font-bold text-muted-foreground">
                  Search Learner
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="LRN, First Name, Last Name..."
                    className="pl-9 h-10 text-sm font-bold"
                    value={search}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearch(val);
                      startTransition(() => {
                        setPage(1);
                      });
                    }}
                  />
                </div>
              </div>

              <Button
                variant="outline"
                className="h-10 px-3 w-full md:w-auto text-sm font-bold"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}>
                Reset
              </Button>
            </div>

            {workflowView === "PENDING_VERIFICATION" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Queue Filter
                </span>
                {PENDING_QUEUE_FILTER_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      pendingQueueFilter === option.value
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className="h-8 text-xs font-bold"
                    onClick={() => {
                      setPendingQueueFilter(option.value);
                    }}>
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="px-3 sm:px-6 max-w-full overflow-hidden">
            <DataTable
              columns={columns}
              data={visibleApplications}
              loading={loading}
              virtualize={true}
              estimatedRowHeight={60}
              className="w-full"
              onRowClick={(app) => {
                setSelectedId(app.id);
              }}
              noResultsMessage={TABLE_NO_RESULTS_MESSAGES[workflowView]}
              sorting={sorting}
              onSortingChange={onSortingChange}
            />

            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
              <span className="text-xs text-muted-foreground">
                Showing {visibleApplications.length} learners in{" "}
                {
                  ENROLLMENT_SUB_MENU_OPTIONS.find(
                    (option) => option.value === workflowView,
                  )?.label
                }
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs font-bold"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Badge
                  variant="secondary"
                  className="px-3 h-8 text-xs font-bold">
                  Page {page}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 sm:h-8 text-xs font-bold"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 15 >= total}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
                    sileo.success({
                      title: "Passed",
                      description: "Applicant marked as PASSED.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
                  }
                }}
                onFail={async () => {
                  try {
                    await api.patch(`/applications/${selectedId}/fail`);
                    sileo.success({
                      title: "Failed",
                      description: "Applicant marked as FAILED.",
                    });
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
                    sileo.success({
                      title: "Updated",
                      description: "Applicant is now temporarily enrolled.",
                    });
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
                    sileo.error({
                      title: "Invalid LRN",
                      description: "LRN must be exactly 12 digits.",
                    });
                    return;
                  }

                  try {
                    await api.patch(`/applications/${selectedId}/assign-lrn`, {
                      lrn,
                    });
                    sileo.success({
                      title: "LRN Assigned",
                      description: "Learner record updated successfully.",
                    });
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
                onMarkInterviewPassed={async () => {
                  try {
                    await api.patch(
                      `/applications/${selectedId}/mark-interview-passed`,
                    );
                    sileo.success({
                      title: "Ready for Enrollment",
                      description:
                        "Learner moved to Ready for Enrollment status.",
                    });
                    fetchData();
                  } catch (e) {
                    toastApiError(e as never);
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

                    sileo.success({
                      title: "Verified",
                      description:
                        "Physical documents verified. Learner is now ready for section assignment.",
                    });
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
                    sileo.success({
                      title: lock ? "Profile Locked" : "Profile Unlocked",
                      description: lock
                        ? "Enrollment profile updates are now restricted."
                        : "Enrollment profile updates are now allowed.",
                    });
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
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Official Enrollment Confirmation
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Confirming enrollment for {selectedApp?.lastName},{" "}
              {selectedApp?.firstName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <p className="text-xs font-medium">
              This action confirms the{" "}
              <span className="font-bold text-green-700">
                OFFICIAL ENROLLMENT
              </span>{" "}
              for Phase 2.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-bold">Section:</span>
                <span className="font-bold">
                  {selectedAppSectionName ?? "Not Assigned"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-emerald-700 font-bold">Grade Level:</span>
                <span className="font-bold">
                  {selectedApp?.gradeLevel?.name
                    ? formatGradeLevelLabel(selectedApp.gradeLevel.name)
                    : "N/A"}
                </span>
              </div>
            </div>
            {!canConfirmOfficialEnrollment && (
              <p className="text-xs mt-2 font-bold text-amber-700">
                Official enrollment is locked until a section is assigned.
              </p>
            )}
            <p className="text-xs mt-4 italic text-muted-foreground font-medium">
              Ensure all physical documents (PSA, SF9) have been verified in
              person before proceeding.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEnrollModalOpen(false)}
              className="text-xs font-bold">
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-xs font-bold"
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
        open={isWalkInGateOpen}
        onOpenChange={(open) => {
          setIsWalkInGateOpen(open);
          if (!open) {
            resetWalkInGate();
          }
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Verify LRN / Existing Record
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Check the learner first before opening Direct Intake to avoid
              duplicate BOSY records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="walkInLrn"
                className="text-xs font-bold uppercase tracking-wider">
                Enter 12-Digit LRN
              </Label>
              <Input
                id="walkInLrn"
                value={walkInLrn}
                maxLength={12}
                disabled={walkInNoLrn || isWalkInGateChecking}
                placeholder="109988776655"
                className="h-10 text-xs font-bold"
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
                  className="text-xs font-bold tracking-wide">
                  Learner has no LRN yet
                </Label>
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Use only for incoming Grade 7 or transferee walk-ins.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              disabled={isWalkInGateChecking}
              onClick={() => setIsWalkInGateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold"
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
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Encode Reading Profile
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Reading Profile is required before section assignment and official
              enrollment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Learner
              </Label>
              <p className="text-xs font-semibold">
                {readingProfileDialog.application
                  ? `${readingProfileDialog.application.lastName}, ${readingProfileDialog.application.firstName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="readingProfileLevel"
                className="text-xs font-bold uppercase tracking-wider">
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
                  className="h-10 text-xs font-bold">
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
                className="text-xs font-bold uppercase tracking-wider">
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
                className="min-h-24 text-xs font-semibold"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={closeReadingProfileDialog}
              disabled={readingProfileDialog.saving}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold"
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

      <Dialog
        open={unenrollDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeUnenrollDialog();
          }
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Un-enrol Learner
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              Record the reason for removing this learner from the official
              roster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Learner
              </Label>
              <p className="text-xs font-semibold">
                {unenrollDialog.application
                  ? `${unenrollDialog.application.lastName}, ${unenrollDialog.application.firstName}`
                  : "N/A"}
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="unenrollReason"
                className="text-xs font-bold uppercase tracking-wider">
                Reason
              </Label>
              <Select
                value={unenrollDialog.reason}
                onValueChange={(value) => {
                  setUnenrollDialog((prev) => ({ ...prev, reason: value }));
                }}>
                <SelectTrigger
                  id="unenrollReason"
                  className="h-10 text-xs font-bold">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {UNENROLL_REASONS.map((reason) => (
                    <SelectItem
                      key={reason}
                      value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="unenrollNote"
                className="text-xs font-bold uppercase tracking-wider">
                Note (Optional)
              </Label>
              <Textarea
                id="unenrollNote"
                value={unenrollDialog.note}
                onChange={(event) => {
                  setUnenrollDialog((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }));
                }}
                placeholder="Add extra details for audit context"
                className="min-h-24 text-xs font-semibold"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={closeUnenrollDialog}>
              Cancel
            </Button>
            <Button
              className="text-xs font-bold bg-destructive hover:bg-destructive/90"
              disabled={!unenrollDialog.reason}
              onClick={() => {
                void handleUnenrollSubmit();
              }}>
              Confirm Un-enrol
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
            <DialogTitle className="text-xs font-bold uppercase tracking-wider">
              Select Grade Level for Batch Sectioning
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold">
              The Batch Wizard will run on the entire unassigned pool of
              learners for the selected grade level.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Target Grade Level
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {loadingGradeLevels ? (
                  <div className="col-span-2 flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  gradeLevels.map((gl) => (
                    <Button
                      key={gl.id}
                      variant="outline"
                      className="h-10 font-bold text-xs"
                      onClick={() =>
                        handleStartBatchSectioning(gl.id, gl.name)
                      }>
                      {formatGradeLevelLabel(gl.name)}
                    </Button>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsGradeSelectDialogOpen(false)}
              className="text-xs font-bold">
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
          setSearch(""); // Phase 4: Search Reset
        }}
        gradeLevelId={batchGradeLevelId || 0}
        gradeLevelName={batchGradeLevelName}
        schoolYearId={ayId || 0}
      />
    </div>
  );
}
