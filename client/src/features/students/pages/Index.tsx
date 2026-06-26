import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import {
  Search,
  Eye,
  MoreHorizontal,
  BadgeAlert,
  FileBadge2,
  Fingerprint,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

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
import { motion, AnimatePresence } from "motion/react";
import type { EosyStatus } from "@enrollpro/shared";
import { queryKeys } from "@/shared/lib/queryKeys";

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
  createdAt: string;
  updatedAt: string;
  studentPhoto?: string | null;
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
}

interface ApiSection {
  id: number;
  name: string;
  programType: string;
  maxCapacity: number;
  enrolledCount: number;
  fillPercent: number;
  advisingTeacher: { id: number; name: string } | null;
}

interface ApiGradeLevelGroup {
  gradeLevelId: number;
  gradeLevelName: string;
  displayOrder: number;
  sections: ApiSection[];
}



const VALID_TABS = ["active", "completers", "inactive"] as const;
type StudentTab = (typeof VALID_TABS)[number];

const PROGRAM_FILTER_OPTIONS = [
  { value: "REGULAR", label: "Regular" },
  { value: "SCIENCE_TECHNOLOGY_AND_ENGINEERING", label: "STE" },
  { value: "SPECIAL_PROGRAM_IN_THE_ARTS", label: "SPA" },
  { value: "SPECIAL_PROGRAM_IN_SPORTS", label: "SPS" },
  { value: "SPECIAL_PROGRAM_IN_JOURNALISM", label: "SPJ" },
  { value: "SPECIAL_PROGRAM_IN_FOREIGN_LANGUAGE", label: "SPFL" },
  {
    value: "SPECIAL_PROGRAM_IN_TECHNICAL_VOCATIONAL_EDUCATION",
    label: "SPTVE",
  },
];

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

const getGradeLevelBadgeStyles = (gradeLevel: string | null | undefined): string => {
  const normalized = String(gradeLevel || "").trim().toLowerCase();
  if (normalized.includes("7") || normalized.includes("g7")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/50";
  }
  if (normalized.includes("8") || normalized.includes("g8")) {
    return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/50";
  }
  if (normalized.includes("9") || normalized.includes("g9")) {
    return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/50";
  }
  if (normalized.includes("10") || normalized.includes("g10")) {
    return "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100/50";
  }
  return "bg-primary/10 text-primary border-primary/20";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<string>("dateEnrolled");
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
        setSortBy("dateEnrolled");
        setSortOrder("desc");
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

  const studentsQueryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    if (activeTab === "active" && ayId) {
      params.schoolYearId = ayId;
    } else if (activeTab === "completers") {
      params.learnerStatus = "JHS_COMPLETER";
    } else if (activeTab === "inactive") {
      params.learnerStatus = "DROPPED,TRANSFERRED_OUT";
    }

    if (debouncedSearch) params.search = debouncedSearch;
    if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
    if (programFilter !== "all") params.programType = programFilter;
    if (sectionFilter !== "all") params.sectionId = sectionFilter;

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
  ]);

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
  });

  const students = studentsQuery.data?.students ?? [];
  const total = studentsQuery.data?.pagination.total ?? 0;
  const loading = studentsQuery.isPending || studentsQuery.isFetching;

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
          : sections.filter((s) => s.programType === programFilter),
      );
    } else {
      setFilteredSections(
        sections.filter((s) => {
          const isGradeMatch =
            s.gradeLevelId === parseInt(gradeLevelFilter, 10);
          const isProgramMatch =
            programFilter === "all" || s.programType === programFilter;
          return isGradeMatch && isProgramMatch;
        }),
      );
    }
    setSectionFilter("all");
  }, [gradeLevelFilter, programFilter, sections]);

  const availablePrograms = useMemo(() => {
    const relevantSections =
      gradeLevelFilter === "all"
        ? sections
        : sections.filter(
          (s) => s.gradeLevelId === parseInt(gradeLevelFilter, 10)
        );
    const availableTypes = new Set(relevantSections.map((s) => s.programType));
    return PROGRAM_FILTER_OPTIONS.filter((p) => availableTypes.has(p.value));
  }, [sections, gradeLevelFilter]);

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
          "font-bold text-sm px-2.5 py-0.5 rounded-md uppercase tracking-wider",
          isEnrolled
            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
            : isDropped
              ? "bg-red-50 text-red-700 border-red-100"
              : "bg-slate-50 text-slate-600 border-slate-100"
        )}>
        {label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return formatManilaDate(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
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

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
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
              <div className="flex items-center gap-3 pl-2 py-3 min-w-[200px]">
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
                <div className="flex flex-col text-left">
                  <span className="font-bold text-base uppercase leading-tight">
                    {row.original.fullName}
                  </span>
                  {row.original.applicantType === "LATE_ENROLLEE" && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase font-black">
                        Late Enrollee
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          },
        },
        {
          id: "lrn",
          accessorKey: "lrn",
          meta: { skeletonClassName: "w-[120px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="LRN"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              <span className="font-bold text-base leading-tight text-center">{row.original.lrn}</span>
            </div>
          ),
        },
        {
          id: "sex",
          accessorKey: "sex",
          meta: { skeletonClassName: "w-[40px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Sex"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => {
            const normalized = row.original.sex?.trim().toUpperCase();
            const isMale = normalized === "MALE" || normalized === "M";
            const isFemale = normalized === "FEMALE" || normalized === "F";
            const display = isMale ? "Male" : isFemale ? "Female" : row.original.sex || "—";

            return (
              <div className="flex w-full justify-center py-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-bold text-sm px-2.5 py-0.5 rounded-md",
                    isMale
                      ? "bg-blue-50 text-blue-700 border-blue-100"
                      : isFemale
                        ? "bg-pink-50 text-pink-700 border-pink-100"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                  )}
                >
                  {display}
                </Badge>
              </div>
            );
          },
        },
        {
          id: "gradeLevel",
          accessorKey: "gradeLevel",
          meta: { skeletonClassName: "w-[80px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Grade Level"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              <Badge
                variant="outline"
                className={cn(
                  "font-bold text-sm px-2.5 py-0.5 rounded-md",
                  getGradeLevelBadgeStyles(row.original.gradeLevel)
                )}
              >
                {row.original.gradeLevel}
              </Badge>
            </div>
          ),
        },
        {
          id: "section",
          accessorKey: "section",
          meta: { skeletonClassName: "w-[100px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Section"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              <span className="font-bold text-base leading-tight text-center">
                {formatSectionLabel(row.original.section)}
              </span>
            </div>
          ),
        },
        {
          id: "status",
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
          id: "dateEnrolled",
          accessorKey: "dateEnrolled",
          meta: { skeletonClassName: "w-[140px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Date Enrolled"
              className="justify-center [&_button]:!m-0"
            />
          ),
          cell: ({ row }) => (
            <div className="flex w-full justify-center py-3">
              <span className="text-base leading-tight font-bold text-center block">
                {formatDate(row.original.dateEnrolled || row.original.createdAt)}
              </span>
            </div>
          ),
        },
        {
          id: "actions",
          meta: { skeletonClassName: "w-[100px] mx-auto", className: "text-center", headerClassName: "text-center" },
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title="Action"
              className="justify-center"
            />
          ),
          cell: () => (
            <div className="flex w-full justify-center py-3">
              <span className="inline-flex h-9 items-center justify-center rounded-xl border bg-primary/5 px-4 text-sm font-medium text-primary transition-all border-2 border-primary group-hover:bg-primary group-hover:shadow-sm group-hover:text-primary-foreground group-hover:font-bold">
                <Eye className="w-4 h-4 mr-2" />
                View
              </span>
            </div>
          ),
        },
      ];
      return activeTab === "active" ? allColumns.filter(col => col.id !== "status") : allColumns;
    }, [activeTab]);

  const renderContent = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full lg:w-64 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or LRN..."
                className="pl-9 h-10 w-full text-base leading-tight font-bold"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 lg:justify-end">
              <Select
                value={gradeLevelFilter}
                onValueChange={(value) => {
                  startTransition(() => {
                    setGradeLevelFilter(value);
                    setPage(1);
                  });
                }}>
                <SelectTrigger className="h-10 w-full sm:w-40 text-base leading-tight font-bold">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-base leading-tight font-bold">
                    All Grades
                  </SelectItem>
                  {gradeLevels.map((gl) => (
                    <SelectItem
                      key={gl.id}
                      value={gl.id.toString()}
                      className="text-base leading-tight font-bold">
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
                <SelectTrigger className="h-10 w-full sm:w-40 text-base leading-tight font-bold">
                  <SelectValue placeholder="All Programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-base leading-tight font-bold">
                    All Programs
                  </SelectItem>
                  {availablePrograms.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-base leading-tight font-bold">
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
                <SelectTrigger className="h-10 w-full sm:w-48 text-base leading-tight font-bold hover:bg-accent hover:text-accent-foreground transition-colors">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-base leading-tight font-bold">
                    All Sections
                  </SelectItem>
                  {gradeLevelFilter === "all" ? (
                    gradeLevels.map((gl) => {
                      const glSections = filteredSections.filter((s) => s.gradeLevelId === gl.id);
                      if (glSections.length === 0) return null;
                      return (
                        <SelectGroup key={gl.id}>
                          <SelectLabel className={cn("text-base uppercase font-bold", getGradeLevelTextClass(gl.name))}>{gl.name}</SelectLabel>
                          {glSections.map((sec) => (
                            <SelectItem
                              key={sec.id}
                              value={sec.id.toString()}
                              className="text-base leading-tight font-bold">
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
                        className="text-base leading-tight font-bold">
                        {formatSectionLabel(sec.name)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Vertical Divider (Hidden on small screens when wrapped) */}
              <div className="hidden lg:block w-px h-6 bg-border mx-1" />

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="h-10 px-3 text-base leading-tight font-bold flex-1 sm:flex-none"
                  onClick={() => {
                    void Promise.all([
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.studentsList(studentsQueryParams),
                      }),
                      ayId
                        ? queryClient.invalidateQueries({
                          queryKey: queryKeys.studentsSummary(ayId),
                        })
                        : Promise.resolve(),
                    ]);
                  }}
                  disabled={loading || !ayId}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  className="h-10 px-3 text-base leading-tight font-bold flex-1 sm:flex-none"
                  onClick={() => {
                    startTransition(() => {
                      clearSearch();
                      setGradeLevelFilter("all");
                      setProgramFilter("all");
                      setSectionFilter("all");
                      setSortBy("dateEnrolled");
                      setSortOrder("desc");
                      setPage(1);
                    });
                  }}>
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Student List */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-2">
          <CardTitle className="text-base sm:text-lg font-extrabold">
            {activeTab === "active"
              ? "Enrolled Learner Records"
              : activeTab === "completers"
                ? "JHS Completer Records"
                : "Inactive / Transferred Records"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col overflow-hidden">
                <div className="md:hidden space-y-3 p-3 overflow-y-auto flex-1 bg-muted/5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-xl border bg-[hsl(var(--card))] p-3 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="h-2 w-10 bg-muted/50 rounded" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 w-10 bg-muted/50 rounded" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 w-10 bg-muted/50 rounded" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-2 w-10 bg-muted/50 rounded" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Skeleton className="h-9 flex-1 rounded-md" />
                        <Skeleton className="h-9 w-10 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block flex-1 overflow-auto bg-muted/5 relative">
                  <DataTable<Student, unknown>
                    columns={columns}
                    data={[]}
                    loading={true}
                    virtualize={true}
                    estimatedRowHeight={60}
                    className="border-none rounded-none h-full"
                    containerHeight="100%"
                    sorting={sorting}
                    onSortingChange={onSortingChange}
                    onRowClick={(row) => handleViewDetails(row.id)}
                    getRowClassName={() => "group"}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="data"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col overflow-hidden">
                <div className="md:hidden space-y-3 p-3 overflow-y-auto flex-1 bg-muted/5">
                  {students.length === 0 ? (
                    <div className="rounded-xl border p-6 text-center text-base leading-tight font-bold">
                      No learners found for the selected filters.
                    </div>
                  ) : (
                    students.map((student) => (
                      <div
                        key={student.id}
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
                              <p className="font-bold text-base uppercase leading-tight break-words">
                                {student.fullName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-base font-bold text-foreground leading-snug">
                                  {formatLearningProgramLabel(
                                    student.learningProgram,
                                  )}
                                </p>
                                {student.applicantType === "LATE_ENROLLEE" && (
                                  <Badge className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase font-black">
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
                            <p className="text-base uppercase  font-bold text-foreground">
                              LRN
                            </p>
                            <p className="font-bold">{student.lrn}</p>
                          </div>
                          <div>
                            <p className="text-base uppercase  font-bold text-foreground">
                              Sex
                            </p>
                            <p className="font-bold uppercase">
                              {student.sex === "MALE" || student.sex === "M"
                                ? "M"
                                : student.sex === "FEMALE" ||
                                  student.sex === "F"
                                  ? "F"
                                  : student.sex || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-base uppercase  font-bold text-foreground">
                              Grade Level
                            </p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-bold text-sm px-2.5 py-0.5 mt-0.5 rounded-md",
                                getGradeLevelBadgeStyles(student.gradeLevel)
                              )}
                            >
                              {student.gradeLevel}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-base uppercase  font-bold text-foreground">
                              Section
                            </p>
                            <p className="font-bold">
                              {formatSectionLabel(student.section)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-2 text-[11px] font-bold text-foreground">
                          {activeTab === "active" ? "Enrolled " : "Updated "}
                          {formatDate(
                            student.dateEnrolled || student.createdAt,
                          )}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 flex-1 text-base font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                            onClick={() => handleViewDetails(student.id)}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            View
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="h-9 w-10 px-0 text-base font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                                aria-label={`Open actions for ${student.fullName}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-56 font-bold">
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
                    loading={false}
                    forceEmptyState={isSearching}
                    virtualize={true}
                    estimatedRowHeight={60}
                    className="border-none rounded-none h-full"
                    containerHeight="100%"
                    prependBodyRow={
                      isSearching ? (
                        <TableSearchIndicator colSpan={8} />
                      ) : null
                    }
                    noResultsMessage="No learners found for the selected filters."
                    sorting={sorting}
                    onSortingChange={onSortingChange}
                    onRowClick={(row) => handleViewDetails(row.id)}
                    getRowClassName={() => "group"}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-base text-foreground leading-relaxed px-4">
                Please set an active year or choose one from the header switcher
                to manage records for this period.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold">
          Master Learner Registry (LIS)
        </h1>
        <p className="text-base leading-tight font-bold text-foreground">
          Manage officially enrolled demographic data, enrollment histories, and permanent records.
        </p>
      </div>


      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-wrap sm:flex-nowrap h-auto gap-1 mb-6 p-1 bg-white border border-border rounded-xl relative shadow-sm">
          <TabsTrigger
            value="active"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
            {activeTab === "active" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary shadow-sm rounded-lg"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className={cn("relative z-20 uppercase", activeTab === "active" ? "text-primary-foreground" : "text-foreground")}>
              <span className="hidden sm:inline">Active Roster</span>
              <span className="sm:hidden">Active</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="completers"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
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
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-lg">
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
          if (!open) setSelectedStudentId(null);
        }}>
        <SheetContent
          side="right"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Learner as Transferred Out</DialogTitle>
            <DialogDescription>
              Update transfer-out details for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-base font-bold">
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
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Learner as Dropped Out</DialogTitle>
            <DialogDescription>
              Update dropout details for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <Alert className="bg-amber-50 border-amber-200 text-amber-800 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-base font-bold">
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
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
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
        <DialogContent className="sm:max-w-lg">
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
                className="font-bold">
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
                className="h-12 text-lg font-black  text-center"
                inputMode="numeric"
                maxLength={12}
              />
              <p className="text-[11px] text-foreground font-bold text-center">
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
              className="bg-primary hover:bg-primary/90 font-bold"
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
