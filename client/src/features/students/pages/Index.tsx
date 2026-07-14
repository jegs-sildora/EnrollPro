import { motion, AnimatePresence } from "motion/react";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { usePaginationLimit } from '@/shared/hooks/usePaginationLimit';
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Eye,
  MoreHorizontal,
  BadgeAlert,
  FileBadge2,
  Fingerprint,
  CalendarDays,
  FilterXIcon,
  AlertTriangle,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";
import { useHeaderStore } from "@/store/header.slice";

import { sileo } from "sileo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import {
  formatManilaDate,
  formatScpType,
  getGradeLevelBadgeStyles,
  SCP_ACRONYMS,
  cn,
} from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Label } from "@/shared/ui/label";
import { Sheet, SheetContent } from "@/shared/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/tabs";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import {
  StudentDetailPanel,
  type StudentDetail as PanelStudentDetail,
  type StudentDropoutPayload,
  type StudentTransferOutPayload,
} from "../components/StudentDetailPanel";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import { useRetainedSheetValue } from "@/shared/hooks/useRetainedSheetValue";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import type { EosyStatus } from "@enrollpro/shared";
import { queryKeys } from "@/shared/lib/queryKeys";
import { useUnsavedChangesPrompt } from "@/shared/hooks/useUnsavedChanges";

interface Student {
  id: number;
  learningProgram: string;
  tleSpecialization?: string | null;
  dateEnrolled: string;
  lrn: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  sex: string;
  birthDate: string;
  address: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  emailAddress: string;
  trackingNumber: string;
  status: string;
  learnerStatus: string;
  applicantType?: string;
  lifecycleOutcome: EosyStatus | null;
  dropOutReason: string | null;
  dropOutDate: string | null;
  transferOutDate: string | null;
  transferOutSchoolName: string | null;
  transferOutReason: string | null;
  gradeLevel: string;
  gradeLevelId: number;
  section: string | null;
  sectionId: number | null;
  sectionIsHomogeneous?: boolean;
  createdAt: string;
  updatedAt: string;
  studentPhoto?: string | null;
  portalStatus?: string;
  schoolYear?: { yearLabel: string } | string;
}


interface GradeLevel {
  id: number;
  name: string;
}

interface Section {
  id: number;
  name: string;
  gradeLevelId: number;
  programType: string;
  isHomogeneous?: boolean;
}

interface ApiSection {
  id: number;
  name: string;
  programType: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: { id: number; name: string } | null;
  isHomogeneous?: boolean;
}

interface ApiGradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: ApiSection[];
}

interface ProgramOptionsResponse {
  programs: string[];
}

interface ProgramFilterOption {
  value: string;
  label: string;
}

function matchesProgramFilter(
  section: Section,
  programFilter: string,
): boolean {
  if (programFilter === "all") return true;
  if (programFilter === "REGULAR_TOP") {
    return section.programType === "REGULAR" && section.isHomogeneous === true;
  }
  return section.programType === programFilter;
}

const VALID_TABS = ["active", "completers", "inactive"] as const;
type StudentTab = (typeof VALID_TABS)[number];

const SECTION_ACRONYMS = new Set(["STE", "SPA", "SPS", "SPJ", "SPFL", "SPTVE"]);

const DROPOUT_REASON_OPTIONS = [
  { value: "ARMED_CONFLICT", label: "Armed Conflict" },
  { value: "ILLNESS", label: "Illness" },
  { value: "FINANCIAL_DIFFICULTY", label: "Financial Difficulty" },
  { value: "FAMILY_PROBLEM", label: "Family Problem" },
  { value: "LACK_OF_INTEREST", label: "Lack of Interest" },
  { value: "EMPLOYMENT", label: "Employment / Working" },
  { value: "OTHER", label: "Other (Specify)" },
] as const;

type DropoutReasonCode = (typeof DROPOUT_REASON_OPTIONS)[number]["value"];

const formatSectionLabel = (rawSection: string | null | undefined): string => {
  if (!rawSection) return "—";

  let sectionName = rawSection.trim();
  if (!sectionName) return "—";

  if (sectionName.includes("--")) {
    const segments = sectionName.split("--").filter(Boolean);
    sectionName = segments[segments.length - 1] || sectionName;
  }

  sectionName = sectionName
    .replace(/^G(?:RADE)?\s*\d+\s*[-_ ]*/i, "")
    .replace(/^(REGULAR|STE|SPA|SPS|SPJ|SPFL|SPTVE)\s*[-_ ]*/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!sectionName) return rawSection;

  return sectionName
    .split(/(\s|-)/)
    .map((part) => {
      if (part === " " || part === "-") return part;

      const upperPart = part.toUpperCase();
      if (SECTION_ACRONYMS.has(upperPart) || /^\d+[A-Z]*$/.test(upperPart)) {
        return upperPart;
      }

      if (upperPart.length <= 1) return upperPart;
      return `${upperPart.charAt(0)}${upperPart.slice(1).toLowerCase()}`;
    })
    .join("");
};

const formatLearningProgramLabel = (
  learningProgram: string | null | undefined,
): string => {
  const normalizedProgram = String(learningProgram || "REGULAR")
    .trim()
    .toUpperCase();

  if (normalizedProgram === "REGULAR") {
    return "Regular Program";
  }

  const displayName = formatScpType(normalizedProgram).replace(
    "Tech-Voc Education",
    "Tech-Voc",
  );
  const acronym = SCP_ACRONYMS[normalizedProgram];

  return acronym && acronym !== "Regular"
    ? `${displayName} (${acronym})`
    : displayName;
};

const getGradeLevelColorDotClass = (gradeLevel: string | null | undefined): string => {
  const normalized = String(gradeLevel || "").trim().toLowerCase();
  if (normalized.includes("7") || normalized.includes("g7")) {
    return "bg-emerald-500";
  }
  if (normalized.includes("8") || normalized.includes("g8")) {
    return "bg-amber-500";
  }
  if (normalized.includes("9") || normalized.includes("g9")) {
    return "bg-rose-500";
  }
  if (normalized.includes("10") || normalized.includes("g10")) {
    return "bg-sky-500";
  }
  return "bg-muted-foreground";
};

const getGradeLevelTextClass = (gradeLevel: string | null | undefined): string => {
  const normalized = String(gradeLevel || "").trim().toLowerCase();
  if (normalized.includes("7") || normalized.includes("g7")) return "text-emerald-700";
  if (normalized.includes("8") || normalized.includes("g8")) return "text-amber-700";
  if (normalized.includes("9") || normalized.includes("g9")) return "text-rose-700";
  if (normalized.includes("10") || normalized.includes("g10")) return "text-sky-700";
  return "text-muted-foreground";
};

const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const f = String(firstName || "").trim().charAt(0).toUpperCase();
  const l = String(lastName || "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "?";
};

export default function Students() {
  const { confirmOrRun } = useUnsavedChangesPrompt();
  const navigate = useNavigate();
  const requestedTab = useSettingsStore((s) => s.uiPreferences.studentsTab);
  const activeTab: StudentTab = VALID_TABS.includes(
    (requestedTab ?? "") as StudentTab,
  )
    ? ((requestedTab as StudentTab) ?? "active")
    : "active";

  const { activeSchoolYearId, viewingSchoolYearId, systemPhase } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canEditProfile = !isHistoricalReadOnly || hasOverride;
  const canMutate = canEditProfile && systemPhase !== "EOSY_CLOSING";
  const queryClient = useQueryClient();

  const { panelPercentage, isDesktopViewport, startResizing } =
    useResizablePanel();

  const {
    inputValue: search,
    setInputValue: setSearch,
    activeFilter: debouncedSearch,
    isSearching,
    clearSearch,
  } = useDebouncedSearch();
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = usePaginationLimit(50);
  const [sortBy, setSortBy] = useState<string>("lastName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
        setSortBy("lastName");
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sorting],
  );

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null,
  );
  const retainedStudentId = useRetainedSheetValue(selectedStudentId);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [showTransferOutDialog, setShowTransferOutDialog] = useState(false);
  const [showDropoutDialog, setShowDropoutDialog] = useState(false);
  const [showLrnDialog, setShowLrnDialog] = useState(false);

  const [actionStudent, setActionStudent] = useState<Student | null>(null);

  const [transferOutDate, setTransferOutDate] = useState("");
  const [transferOutSchoolName, setTransferOutSchoolName] = useState("");
  const [transferOutReason, setTransferOutReason] = useState("");

  const [dropoutReasonCode, setDropoutReasonCode] =
    useState<DropoutReasonCode>("LACK_OF_INTEREST");
  const [dropoutReasonDetails, setDropoutReasonDetails] = useState("");
  const [dropoutDate, setDropoutDate] = useState("");



  const [lrnForm, setLrnForm] = useState({
    lrn: "",
  });

  const {
    enableHomogeneousSections,
    homogeneousSectionCount,
  } = useSettingsStore();

  const studentsQueryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (ayId && activeTab !== "completers") {
      params.schoolYearId = ayId;
    }

    if (activeTab === "completers") {
      params.learnerStatus = "JHS_COMPLETER";
    } else if (activeTab === "inactive") {
      params.learnerStatus = statusFilter !== "all" ? statusFilter : "DROPPED,TRANSFERRED_OUT";
    }

    if (debouncedSearch) params.search = debouncedSearch;
    if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
    if (sectionFilter !== "all") params.sectionId = sectionFilter;

    if (programFilter !== "all") {
      if (programFilter === "REGULAR_TOP") {
        params.programType = "REGULAR";
        params.isHomogeneous = "true";
      } else if (programFilter === "REGULAR") {
        params.programType = "REGULAR";
      } else {
        params.programType = programFilter;
      }
    }

    return params;
  }, [
    page,
    limit,
    sortBy,
    sortOrder,
    activeTab,
    ayId,
    debouncedSearch,
    gradeLevelFilter,
    programFilter,
    sectionFilter,
    statusFilter,
  ]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const studentsQuery = useQuery({
    queryKey: queryKeys.studentsList(studentsQueryParams),
    queryFn: async () => {
      if (!ayId && activeTab !== "completers") {
        return { students: [] as Student[], pagination: { total: 0 } };
      }

      const res = await api.get("/students", { params: studentsQueryParams });
      return {
        students: (res.data.students || []) as Student[],
        pagination: res.data.pagination as { total: number },
      };
    },
    enabled: Boolean(ayId || activeTab === "completers"),
    placeholderData: keepPreviousData,
  });

  const students = studentsQuery.data?.students ?? [];
  const total = studentsQuery.data?.pagination.total ?? 0;
  const loading = studentsQuery.isPending || studentsQuery.isFetching;

  useEffect(() => {
    if (studentsQuery.data) {
      setIsInitialLoad(false);
    }
  }, [studentsQuery.data]);

  const programOptionsQuery = useQuery({
    queryKey: queryKeys.activeAcademicPrograms,
    queryFn: async (): Promise<ProgramOptionsResponse> => {
      const response = await api.get<ProgramOptionsResponse>(
        "/settings/programs",
      );
      return response.data;
    },
    enabled: Boolean(ayId),
  });

  // Fetch grade levels and sections
  useEffect(() => {
    const fetchFilters = async () => {
      if (!ayId) return;
      try {
        const [glRes, secRes] = await Promise.all([
          api.get(`/school-years/grade-levels`),
          api.get(`/sections/${ayId}`),
        ]);
        setGradeLevels(glRes.data.gradeLevels || []);

        // Flatten sections from grade levels in the response
        const allSections = (secRes.data.gradeLevels || []).flatMap(
          (gl: ApiGradeLevelGroup) =>
            (gl.sections || []).map((s: ApiSection) => ({
              ...s,
              gradeLevelId: gl.gradeLevelId,
            })),
        );
        setSections(allSections);
      } catch (err) {
        console.error("Failed to fetch filters:", err);
      }
    };
    fetchFilters();
  }, [ayId]);

  // Filter sections by grade level
  useEffect(() => {
    if (gradeLevelFilter === "all") {
      setFilteredSections(
        programFilter === "all"
          ? sections
          : sections.filter((section) =>
            matchesProgramFilter(section, programFilter),
          ),
      );
    } else {
      setFilteredSections(
        sections.filter((s) => {
          const isGradeMatch =
            s.gradeLevelId === parseInt(gradeLevelFilter, 10);
          const isProgramMatch = matchesProgramFilter(s, programFilter);
          return isGradeMatch && isProgramMatch;
        }),
      );
    }
    setSectionFilter("all");
  }, [gradeLevelFilter, programFilter, sections]);

  const availablePrograms = useMemo<ProgramFilterOption[]>(
    () => {
      const programs = programOptionsQuery.data?.programs ?? [];
      const opts: ProgramFilterOption[] = [];
      const hasTopBecSection = sections.some(
        (section) =>
          section.programType === "REGULAR" &&
          section.isHomogeneous === true,
      );
      programs.forEach((programType) => {
        if (programType === "REGULAR") {
          if (
            hasTopBecSection ||
            (enableHomogeneousSections && homogeneousSectionCount > 0)
          ) {
            opts.push({
              value: "REGULAR_TOP",
              label: `BEC (Top ${homogeneousSectionCount || 5})`,
            });
          }
          opts.push({
            value: "REGULAR",
            label: "BEC",
          });
        } else {
          opts.push({
            value: programType,
            label: SCP_ACRONYMS[programType] ?? formatScpType(programType),
          });
        }
      });
      return opts;
    },
    [
      programOptionsQuery.data?.programs,
      enableHomogeneousSections,
      homogeneousSectionCount,
      sections,
    ],
  );

  useEffect(() => {
    if (
      programFilter !== "all" &&
      programOptionsQuery.data &&
      !programOptionsQuery.data.programs.includes(
        programFilter === "REGULAR_TOP" ? "REGULAR" : programFilter,
      )
    ) {
      setProgramFilter("all");
    }
  }, [programFilter, programOptionsQuery.data]);

  useEffect(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.studentsList(studentsQueryParams),
    });
  }, [queryClient, studentsQueryParams]);

  useEffect(() => {
    if (ayId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.studentsSummary(ayId) });
    }
  }, [queryClient, ayId]);

  const handleViewDetails = useCallback(async (studentId: number) => {
    setSelectedStudentId(studentId);
  }, []);

  const renderLearnerStatus = (student: Student) => {
    let status = student.learnerStatus || "ACTIVE";

    // Override with lifecycle outcome if present and tab is active/inactive
    if (activeTab !== "completers") {
      if (student.lifecycleOutcome === "DROPPED_OUT") status = "DROPPED";
      else if (student.lifecycleOutcome === "TRANSFERRED_OUT") status = "TRANSFERRED_OUT";
    }

    const label = status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase());

    const isEnrolled = status === "ENROLLED" || status === "ACTIVE";
    const isDropped = status === "DROPPED" || status === "DROPPED_OUT";

    return (
      <Badge
        variant="outline"
        className={cn(
          "font-extrabold text-sm px-2.5 py-0.5 rounded-md uppercase tracking-wider",
          isEnrolled
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : isDropped
              ? "bg-red-50 text-red-700 border-red-100"
              : "bg-primary text-primary-foreground"
        )}>
        {label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return formatManilaDate(dateString, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleOpenProfilePage = useCallback(
    (studentId: number) => {
      navigate(`/students/${studentId}`);
    },
    [navigate],
  );

  const toDateInputValue = useCallback((value?: string | null): string => {
    const sourceDate = value ? new Date(value) : new Date();
    if (Number.isNaN(sourceDate.getTime())) {
      return "";
    }

    const tzAdjusted = new Date(
      sourceDate.getTime() - sourceDate.getTimezoneOffset() * 60_000,
    );
    return tzAdjusted.toISOString().slice(0, 10);
  }, []);

  const refreshTables = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.studentsList(studentsQueryParams) }),
      ayId
        ? queryClient.invalidateQueries({ queryKey: queryKeys.studentsSummary(ayId) })
        : Promise.resolve(),
    ]);
  }, [queryClient, studentsQueryParams, ayId]);

  const refreshDetailIfOpen = useCallback(
    async (studentId: number) => {
      if (selectedStudentId !== studentId) {
        return;
      }
    },
    [selectedStudentId],
  );

  /** Helper to map detail from panel to local Student interface */
  const mapPanelDetailToStudent = (detail: PanelStudentDetail): Student => {
    return {
      ...detail,
      learnerStatus: detail.learnerStatus,
      learningProgram: "REGULAR", // Default fallback, though ideally fetched
      tleSpecialization: null,
      dateEnrolled: detail.enrollment?.enrolledAt || detail.createdAt,
      lifecycleOutcome: detail.enrollment?.eosyStatus || null,
      dropOutReason: detail.enrollment?.dropOutReason || null,
      dropOutDate: detail.enrollment?.dropOutDate || null,
      transferOutDate: detail.enrollment?.transferOutDate || null,
      transferOutSchoolName: detail.enrollment?.transferOutSchoolName || null,
      transferOutReason: detail.enrollment?.transferOutReason || null,
      section: detail.enrollment?.section || null,
      sectionId: detail.enrollment?.sectionId || null,
    };
  };

  const openTransferOutDialog = useCallback(
    (student: Student | PanelStudentDetail) => {
      const s =
        "learningProgram" in student
          ? student
          : mapPanelDetailToStudent(student);
      setActionStudent(s);
      setTransferOutDate(toDateInputValue());
      setTransferOutSchoolName("");
      setTransferOutReason("");
      setShowTransferOutDialog(true);
    },
    [toDateInputValue],
  );

  const openDropoutDialog = useCallback(
    (student: Student | PanelStudentDetail) => {
      const s =
        "learningProgram" in student
          ? student
          : mapPanelDetailToStudent(student);
      setActionStudent(s);
      setDropoutDate(toDateInputValue());
      setDropoutReasonCode("LACK_OF_INTEREST");
      setDropoutReasonDetails("");
      setShowDropoutDialog(true);
    },
    [toDateInputValue],
  );


  const handlePanelTransferOut = async (payload: StudentTransferOutPayload) => {
    setActionSubmitting(true);
    try {
      await api.post(`/students/${payload.student.id}/lifecycle/transfer-out`, {
        transferDate: payload.transferDate,
        destinationSchool: payload.destinationSchool,
        reasonNote: payload.reasonNote || undefined,
      });

      sileo.success({
        title: "Transferred out",
        description: "Learner lifecycle was updated successfully.",
      });
      await refreshTables();
      await refreshDetailIfOpen(payload.student.id);
    } catch (err: unknown) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePanelDropout = async (payload: StudentDropoutPayload) => {
    setActionSubmitting(true);
    try {
      await api.post(`/students/${payload.student.id}/lifecycle/dropout`, {
        dropOutDate: payload.dropOutDate,
        reasonCode: payload.reasonCode,
        interventionNotes: payload.interventionNotes || undefined,
      });

      sileo.success({
        title: "Dropped out",
        description: "Learner lifecycle was updated successfully.",
      });
      await refreshTables();
      await refreshDetailIfOpen(payload.student.id);
    } catch (err: unknown) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  };

  const openAssignLrnDialog = useCallback(
    (student: Student | PanelStudentDetail) => {
      const s =
        "learningProgram" in student
          ? student
          : mapPanelDetailToStudent(student);
      setActionStudent(s);
      setLrnForm({
        lrn: /^\d{12}$/.test(s.lrn || "") ? s.lrn : "",
      });
      setShowLrnDialog(true);
    },
    [],
  );

  const handleTabChange = (val: string) => {
    useSettingsStore.getState().updateUiPreference("studentsTab", val);
    setPage(1);
  };

  const submitTransferOut = useCallback(async () => {
    if (!actionStudent) return;
    if (!transferOutDate || !transferOutSchoolName.trim()) {
      sileo.warning({
        title: "Missing transfer details",
        description: "Transfer date and destination school are required.",
      });
      return;
    }

    setActionSubmitting(true);
    try {
      await api.post(`/students/${actionStudent.id}/lifecycle/transfer-out`, {
        transferOutDate,
        destinationSchool: transferOutSchoolName.trim(),
        reason: transferOutReason.trim() || undefined,
      });

      sileo.success({
        title: "Transferred out",
        description: "Learner lifecycle was updated successfully.",
      });
      setShowTransferOutDialog(false);
      await refreshTables();
      await refreshDetailIfOpen(actionStudent.id);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    actionStudent,
    transferOutDate,
    transferOutSchoolName,
    transferOutReason,
    refreshTables,
    refreshDetailIfOpen,
  ]);

  const submitDropout = useCallback(async () => {
    if (!actionStudent) return;
    if (!dropoutDate) {
      sileo.warning({
        title: "Missing dropout date",
        description: "Dropout date is required.",
      });
      return;
    }
    if (dropoutReasonCode === "OTHER" && !dropoutReasonDetails.trim()) {
      sileo.warning({
        title: "Missing reason details",
        description: "Provide details when reason code is OTHER.",
      });
      return;
    }

    setActionSubmitting(true);
    try {
      await api.post(`/students/${actionStudent.id}/lifecycle/dropout`, {
        dropOutDate: dropoutDate,
        reasonCode: dropoutReasonCode,
        reasonNote: dropoutReasonDetails.trim() || undefined,
      });

      sileo.success({
        title: "Dropped out",
        description: "Learner lifecycle was updated successfully.",
      });
      setShowDropoutDialog(false);
      await refreshTables();
      await refreshDetailIfOpen(actionStudent.id);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  }, [
    actionStudent,
    dropoutDate,
    dropoutReasonCode,
    dropoutReasonDetails,
    refreshTables,
    refreshDetailIfOpen,
  ]);



  const submitAssignLrn = useCallback(async () => {
    if (!actionStudent) return;
    const normalizedLrn = lrnForm.lrn.trim();
    if (!/^\d{12}$/.test(normalizedLrn)) {
      sileo.warning({
        title: "Invalid LRN",
        description: "LRN must be exactly 12 digits.",
      });
      return;
    }

    setActionSubmitting(true);
    try {
      await api.post(`/students/${actionStudent.id}/lrn`, {
        lrn: normalizedLrn,
      });

      sileo.success({
        title: "LRN saved",
        description: "Learner reference number was assigned successfully.",
      });
      setShowLrnDialog(false);
      await refreshTables();
      await refreshDetailIfOpen(actionStudent.id);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  }, [actionStudent, lrnForm.lrn, refreshTables, refreshDetailIfOpen]);



  const columns = useMemo<ColumnDef<Student>[]>(
    () => {
      const allColumns: ColumnDef<Student>[] = [
        {
          id: "lastName",
          accessorKey: "lastName",
          size: 350,
          minSize: 260,
          maxSize: 500,
          meta: { skeletonClassName: "w-[200px]" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="LEARNER NAME"
            />
          ),
          cell: ({ row }) => {
            const initials = getInitials(row.original.firstName, row.original.lastName);
            return (
              <div className="flex min-w-0 items-center gap-3 py-3 pl-2">
                <UserPhoto
                  photo={row.original.studentPhoto}
                  containerClassName="w-9 h-9 rounded-full shadow-sm border shrink-0"
                  className="w-full h-full object-cover"
                  alt={row.original.fullName}
                  fallbackIcon={
                    <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold text-sm bg-primary">
                      {initials}
                    </div>
                  }
                />
                <div className="flex min-w-0 flex-col text-left">
                  <span className="break-words font-extrabold uppercase leading-tight">
                    {row.original.fullName}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="font-bold">
                      LRN: {row.original.lrn}
                    </span>
                    {row.original.applicantType === "LATE_ENROLLEE" && (
                      <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase font-extrabold">
                        Late Enrollee
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          },
        },
        {
          id: "gradeLevel",
          accessorKey: "gradeLevel",
          size: 180,
          minSize: 150,
          maxSize: 180,
          meta: { skeletonClassName: "w-[120px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="GRADE LEVEL & SECTION"
              className="justify-center [&_button]:!m-0 text-center"
            />
          ),
          cell: ({ row }) => (
            <div className="flex flex-col items-center justify-center py-2 gap-1 w-full">
              <Badge
                variant="outline"
                className={cn(
                  "font-extrabold px-2.5 py-0.5 rounded-md uppercase",
                  getGradeLevelBadgeStyles(row.original.gradeLevel)
                )}
              >
                {row.original.gradeLevel || "Grade"}
              </Badge>
              <span className="font-extrabold text-sm leading-tight text-center uppercase">
                {formatSectionLabel(row.original.section)}
              </span>
              {activeTab === "completers" && (() => {
                const sy = row.original.schoolYear
                const label = !sy ? null : typeof sy === "string" ? sy : sy.yearLabel
                return label ? (
                  <span className="text-sm text-foreground font-extrabold leading-tight">
                    {label}
                  </span>
                ) : null
              })()}
            </div>
          ),
        },
        {
          id: "status",
          size: 150,
          minSize: 140,
          maxSize: 170,
          meta: { className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="STATUS"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              {renderLearnerStatus(row.original)}
            </div>
          ),
        },
        {
          id: "curriculumProgram",
          accessorKey: "learningProgram",
          size: 160,
          minSize: 150,
          maxSize: 180,
          meta: { skeletonClassName: "w-[140px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="CURRICULUM PROGRAM"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => {
            const normalizedProgram = String(row.original.learningProgram || "REGULAR")
              .trim()
              .toUpperCase();
            const displayName = formatScpType(normalizedProgram).replace("Tech-Voc Education", "Tech-Voc");
            let acronym = SCP_ACRONYMS[normalizedProgram] || displayName;

            if (normalizedProgram === "REGULAR" && row.original.sectionId) {
              const isTopBecSection = row.original.sectionIsHomogeneous === true;
              if (isTopBecSection) {
                acronym = `BEC (Top ${homogeneousSectionCount || 5})`;
              }
            }

            return (
              <div className="flex w-full justify-center py-3">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="leading-tight font-extrabold text-center block cursor-help">
                        {acronym}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-primary text-primary-foreground">
                      <p className="font-bold text-sm">{displayName}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          },
        },
        {
          id: "actions",
          size: 150,
          minSize: 140,
          maxSize: 170,
          meta: { className: "text-center hover:bg-transparent", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Actions"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 items-center justify-center rounded-lg border bg-primary/5 px-4 text-sm text-primary transition-all border-2 border-primary hover:bg-primary hover:text-primary-foreground font-extrabold cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(row.original.id);
                }}
              >
                <Eye className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </div>
          ),
        },
      ];
      return activeTab === "active" ? allColumns.filter(col => col.id !== "status") : allColumns;
    }, [
    activeTab,
    enableHomogeneousSections,
    homogeneousSectionCount,
  ]);

  const renderContent = () => (
    <div className="space-y-6">

      {/* Student List */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        {/* Control Bar (Filters) */}
        <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
            <div className="flex-1 w-full min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="SEARCH LRN, FIRST NAME, LAST NAME..."
                  className="w-full h-10 pl-9 bg-muted border-gray-300 uppercase font-extrabold"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-row flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto shrink-0">
              <Select
                value={gradeLevelFilter}
                onValueChange={(value) => {
                  startTransition(() => {
                    setGradeLevelFilter(value);
                    setPage(1);
                  });
                }}>
                <SelectTrigger className="h-10 w-full leading-tight font-extrabold sm:w-40">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="leading-tight font-extrabold">
                    All Grades
                  </SelectItem>
                  {gradeLevels.map((gl) => (
                    <SelectItem
                      key={gl.id}
                      value={gl.id.toString()}
                      className="leading-tight font-extrabold">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full border border-black/10 shrink-0", getGradeLevelColorDotClass(gl.name))} />
                        <span>{gl.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={programFilter}
                onValueChange={(value) => {
                  startTransition(() => {
                    setProgramFilter(value);
                    setPage(1);
                  });
                }}>
                <SelectTrigger className="h-10 w-full leading-tight font-extrabold sm:w-40">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="leading-tight font-extrabold">
                    All Programs
                  </SelectItem>
                  {programOptionsQuery.isPending && (
                    <SelectItem value="__loading" disabled>
                      Loading programs...
                    </SelectItem>
                  )}
                  {programOptionsQuery.isError && (
                    <SelectItem value="__error" disabled>
                      Programs could not be loaded
                    </SelectItem>
                  )}
                  {availablePrograms.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="leading-tight font-extrabold">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sectionFilter}
                onValueChange={(value) => {
                  startTransition(() => {
                    setSectionFilter(value);
                    setPage(1);
                  });
                }}>
                <SelectTrigger className="h-10 w-full leading-tight font-extrabold transition-colors sm:w-48">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="leading-tight font-extrabold">
                    All Sections
                  </SelectItem>
                  {gradeLevelFilter === "all" ? (
                    gradeLevels.map((gl) => {
                      const glSections = filteredSections.filter((s) => s.gradeLevelId === gl.id);
                      if (glSections.length === 0) return null;
                      return (
                        <SelectGroup key={gl.id}>
                          <SelectLabel className={cn("uppercase font-extrabold", getGradeLevelTextClass(gl.name))}>{gl.name}</SelectLabel>
                          {glSections.map((sec) => (
                            <SelectItem
                              key={sec.id}
                              value={sec.id.toString()}
                              className="leading-tight font-extrabold">
                              {formatSectionLabel(sec.name)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    })
                  ) : (
                    filteredSections.map((sec) => (
                      <SelectItem
                        key={sec.id}
                        value={sec.id.toString()}
                        className="leading-tight font-extrabold">
                        {formatSectionLabel(sec.name)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {activeTab === "inactive" && (
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setStatusFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full leading-tight font-extrabold transition-colors sm:w-48">
                    <SelectValue placeholder="All Inactive" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="leading-tight font-extrabold">
                      All Inactive
                    </SelectItem>
                    <SelectItem value="DROPPED" className="leading-tight font-extrabold text-red-600">
                      Dropped Out
                    </SelectItem>
                    <SelectItem value="TRANSFERRED_OUT" className="leading-tight font-extrabold text-amber-600">
                      Transferred Out
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

              {/* Vertical Divider (Hidden on small screens when wrapped) */}
              <div className="hidden xl:block w-px h-6 bg-border mx-1" />

              {/* Action Buttons */}
              <Button
                className="h-10 px-3 text-gray-600 hover:text-gray-900 shrink-0 font-extrabold"
                variant="ghost"
                onClick={() => {
                  startTransition(() => {
                    clearSearch();
                    setGradeLevelFilter("all");
                    setProgramFilter("all");
                    setSectionFilter("all");
                    setStatusFilter("all");
                    setSortBy("dateEnrolled");
                    setSortOrder("desc");
                    setPage(1);
                  });
                }}>
                <FilterXIcon className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 flex flex-col overflow-hidden">
            <div className="md:hidden space-y-3 p-3 overflow-y-auto flex-1 bg-muted/5">
              {students.length === 0 ? (
                <div className="rounded-xl border p-6 text-center leading-tight font-extrabold">
                  No learners found for the selected filters.
                </div>
              ) : (
                students.map((student, index) => (
                  <div
                    key={`${student.id}-${index}`}
                    className="rounded-xl border bg-[hsl(var(--card))] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserPhoto
                          photo={student.studentPhoto}
                          containerClassName="w-10 h-10 rounded-full shadow-sm border shrink-0"
                          className="w-full h-full object-cover"
                          alt={student.fullName}
                          fallbackIcon={
                            <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold text-sm bg-primary">
                              {getInitials(student.firstName, student.lastName)}
                            </div>
                          }
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold uppercase leading-tight break-words">
                            {student.fullName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-extrabold text-foreground leading-snug">
                              {formatLearningProgramLabel(
                                student.learningProgram,
                              )}
                            </p>
                            {student.applicantType === "LATE_ENROLLEE" && (
                              <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase font-extrabold">
                                Late Enrolled
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {renderLearnerStatus(student)}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 text-base">
                      <div>
                        <p className="uppercase  font-extrabold text-foreground">
                          LRN
                        </p>
                        <p className="font-extrabold">{student.lrn}</p>
                      </div>
                      <div>
                        <p className="uppercase  font-extrabold text-foreground">
                          Sex
                        </p>
                        <p className="font-extrabold uppercase">
                          {student.sex === "MALE" || student.sex === "M"
                            ? "M"
                            : student.sex === "FEMALE" ||
                              student.sex === "F"
                              ? "F"
                              : student.sex || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase font-extrabold text-foreground">
                          Grade Level
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-extrabold px-2.5 py-0.5 mt-0.5 rounded-md",
                            getGradeLevelBadgeStyles(student.gradeLevel)
                          )}
                        >
                          {student.gradeLevel}
                        </Badge>
                      </div>
                      <div>
                        <p className="uppercase  font-extrabold text-foreground">
                          Section
                        </p>
                        <p className="font-extrabold">
                          {formatSectionLabel(student.section)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] font-extrabold text-foreground">
                      {activeTab === "active" ? "Enrolled " : "Updated "}
                      {formatDate(
                        student.dateEnrolled || student.createdAt,
                      )}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-9 flex-1 font-extrabold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                        onClick={() => handleViewDetails(student.id)}>
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 w-10 px-0 font-extrabold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                            aria-label={`Open actions for ${student.fullName}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 font-extrabold">
                          <DropdownMenuItem
                            onClick={() =>
                              handleOpenProfilePage(student.id)
                            }
                            className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            Open Full Profile
                          </DropdownMenuItem>

                          {canMutate && (
                            <DropdownMenuItem
                              onClick={() => openAssignLrnDialog(student)}
                              className="cursor-pointer">
                              <Fingerprint className="mr-2 h-4 w-4" />
                              Update LIS LRN
                            </DropdownMenuItem>
                          )}
                          {canMutate && (
                            <DropdownMenuItem
                              onClick={() => openTransferOutDialog(student)}
                              className="cursor-pointer text-amber-700 focus:text-amber-700">
                              <FileBadge2 className="mr-2 h-4 w-4" />
                              Mark as Transferred Out
                            </DropdownMenuItem>
                          )}
                          {canMutate && (
                            <DropdownMenuItem
                              onClick={() => openDropoutDialog(student)}
                              className="cursor-pointer text-rose-700 focus:text-rose-700">
                              <BadgeAlert className="mr-2 h-4 w-4" />
                              Mark as Dropped Out
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden md:block flex-1 overflow-auto bg-muted/5 relative">
              <DataTable<Student, unknown>
                columns={columns}
                data={students}
                loading={loading && isInitialLoad}
                loadingBehavior="delayed"
                forceEmptyState={isSearching}
                virtualize={true}
                estimatedRowHeight={60}
                className="border-none rounded-md h-full"
                tableClassName="min-w-[1200px] table-fixed"
                containerHeight="100%"
                prependBodyRow={
                  isSearching ? (
                    <TableSearchIndicator colSpan={8} />
                  ) : null
                }
                noResultsMessage="No learners found for the selected filters."
                sorting={sorting}
                onSortingChange={onSortingChange}
                getRowClassName={() => "group"}
              />
            </div>
          </motion.div>

          <PaginationBar
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={setLimit}
            itemName="Learners"
          />
        </CardContent>
      </Card>
    </div>
  );

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-foreground">
                No School Year Selected
              </p>
              <p className="text-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher
                to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Learner Registry");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="flex flex-1 h-full w-full min-h-0 flex-col">


      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-4 p-1 bg-muted border border-border rounded-xl relative shadow-sm">
          <TabsTrigger
            value="active"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
            {activeTab === "active" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase", activeTab === "active" ? "text-primary-foreground" : "text-foreground")}>
              <span className="hidden sm:inline">Active Masterlist</span>
              <span className="sm:hidden">Active</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="completers"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
            {activeTab === "completers" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase", activeTab === "completers" ? "text-primary-foreground" : "text-foreground")}>
              <span className="hidden sm:inline">Completers / Alumni</span>
              <span className="sm:hidden">Alumni</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="inactive"
            className="flex-1 min-w-25 font-extrabold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
            {activeTab === "inactive" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase", activeTab === "inactive" ? "text-primary-foreground" : "text-foreground")}>
              <span className="hidden sm:inline">Inactive (Transferred / Dropped)</span>
              <span className="sm:hidden">Inactive</span>
            </span>
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {activeTab === "active" && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full">
              <TabsContent
                value="active"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0">
                {renderContent()}
              </TabsContent>
            </motion.div>
          )}
          {activeTab === "completers" && (
            <motion.div
              key="completers"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full">
              <TabsContent
                value="completers"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0">
                {renderContent()}
              </TabsContent>
            </motion.div>
          )}
          {activeTab === "inactive" && (
            <motion.div
              key="inactive"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full">
              <TabsContent
                value="inactive"
                forceMount
                className="mt-0 focus-visible:outline-none ring-0">
                {renderContent()}
              </TabsContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Tabs>

      {/* Student Detail Panel */}
      <Sheet
        open={selectedStudentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            confirmOrRun(() => setSelectedStudentId(null));
          }
        }}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="p-0 flex flex-row border-l overflow-visible w-full sm:w-auto sm:max-w-none"
          style={
            isDesktopViewport ? { width: `${panelPercentage}vw` } : undefined
          }>
          {/* Resize Handle — hidden on mobile */}
          <div
            onMouseDown={startResizing}
            className="absolute left-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize z-50 hover:bg-primary/30 transition-colors hidden sm:flex items-center justify-center group">
            <div className="h-8 w-1.5 rounded-full bg-muted-foreground/20 group-hover:bg-primary/50" />
          </div>

          {retainedStudentId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <StudentDetailPanel
                id={retainedStudentId}
                schoolYearId={ayId}
                onClose={() => setSelectedStudentId(null)}
                onRefreshData={refreshTables}
                onTransferOut={handlePanelTransferOut}
                onDropout={handlePanelDropout}
                canEditProfile={canEditProfile}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={showTransferOutDialog}
        onOpenChange={setShowTransferOutDialog}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mark Learner as Transferred Out</DialogTitle>
            <DialogDescription>
              Update transfer-out details for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="font-extrabold">
              Warning: This action will permanently alter the student's status
              on the official School Form 1 (SF1) and School Form 4 (SF4)
              reports.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transferOutDate">Transfer Date</Label>
              <HybridDatePicker
                value={transferOutDate}
                onChange={setTransferOutDate}
                placeholder="Select date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferOutSchool">Destination School</Label>
              <Input
                id="transferOutSchool"
                value={transferOutSchoolName}
                onChange={(event) =>
                  setTransferOutSchoolName(event.target.value)
                }
                placeholder="Enter receiving school"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transferOutReason">Reason (Optional)</Label>
              <Textarea
                id="transferOutReason"
                value={transferOutReason}
                onChange={(event) => setTransferOutReason(event.target.value)}
                placeholder="State reason for transfer"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferOutDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold"
              onClick={() => void submitTransferOut()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Confirm Transfer Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDropoutDialog}
        onOpenChange={setShowDropoutDialog}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mark Learner as Dropped Out</DialogTitle>
            <DialogDescription>
              Update dropout details for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="font-extrabold">
              Warning: This action will permanently alter the student's status
              on the official School Form 1 (SF1) and School Form 4 (SF4)
              reports.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dropOutDate">Dropout Date</Label>
              <HybridDatePicker
                value={dropoutDate}
                onChange={setDropoutDate}
                placeholder="Select date"
              />
            </div>
            <div className="space-y-2">
              <Label>Dropout Reason</Label>
              <Select
                value={dropoutReasonCode}
                onValueChange={(value) =>
                  setDropoutReasonCode(value as DropoutReasonCode)
                }>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {DROPOUT_REASON_OPTIONS.map((option) => (
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
              <Label htmlFor="dropOutNote">Reason Details</Label>
              <Textarea
                id="dropOutNote"
                value={dropoutReasonDetails}
                onChange={(event) =>
                  setDropoutReasonDetails(event.target.value)
                }
                placeholder={
                  dropoutReasonCode === "OTHER"
                    ? "Required for OTHER reason"
                    : "Additional context (optional)"
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDropoutDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-extrabold"
              onClick={() => void submitDropout()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Confirm Dropout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog
        open={showLrnDialog}
        onOpenChange={setShowLrnDialog}>
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle>Input Official DepEd LRN</DialogTitle>
            <DialogDescription>
              Enter the 12-digit Learner Reference Number generated by the
              national DepEd LIS portal for {actionStudent?.fullName}. This will
              clear the student's \"Pending LRN\" status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label
                htmlFor="assignLrn"
                className="font-extrabold">
                Learner Reference Number (LRN)
              </Label>
              <Input
                id="assignLrn"
                value={lrnForm.lrn}
                onChange={(event) =>
                  setLrnForm({
                    lrn: event.target.value.replace(/[^0-9]/g, "").slice(0, 12),
                  })
                }
                placeholder="e.g., 101234567890"
                className="h-12 text-lg font-extrabold  text-center"
                inputMode="numeric"
                maxLength={12}
              />
              <p className="text-[11px] text-foreground font-extrabold text-center">
                Must be exactly 12 digits as found in the DepEd LIS portal.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLrnDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 font-extrabold"
              onClick={() => void submitAssignLrn()}
              disabled={actionSubmitting || lrnForm.lrn.length !== 12}>
              {actionSubmitting ? "Saving..." : "Save LRN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
