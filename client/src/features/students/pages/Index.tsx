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
  Mars,
  Venus,
  Users,
  CalendarDays,
  RefreshCw,
  AlertTriangle,
  PieChart,
  BookOpen,
  Flag,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { AnimatedNumber } from "@/shared/components/AnimatedNumber";
import { HybridDatePicker } from "@/shared/components/HybridDatePicker";

import { sileo } from "sileo";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
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
} from "../components/StudentDetailPanel";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { useResizablePanel } from "@/shared/hooks/useResizablePanel";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
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

interface StudentsSummary {
  totalEnrolled: number;
  genderBreakdown: {
    male: number;
    female: number;
    other: number;
  };
  programBreakdown: Record<string, number>;
  gradeBreakdown: Record<string, number>;
  specialDemographics: {
    fourPs: number;
    balikAral: number;
    transfereesIn: number;
  };
}

const GRADE_DISPLAY = [
  { key: "Grade 7", label: "G7" },
  { key: "Grade 8", label: "G8" },
  { key: "Grade 9", label: "G9" },
  { key: "Grade 10", label: "G10" },
] as const;

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

  const summaryQuery = useQuery({
    queryKey: ayId ? queryKeys.studentsSummary(ayId) : ["students", "summary", null],
    queryFn: async () => {
      if (!ayId) return null;
      const res = await api.get<StudentsSummary>("/students/summary", {
        params: { schoolYearId: ayId },
      });
      return res.data;
    },
    enabled: Boolean(ayId),
  });

  const students = studentsQuery.data?.students ?? [];
  const total = studentsQuery.data?.pagination.total ?? 0;
  const loading = studentsQuery.isPending || studentsQuery.isFetching;
  const summary = summaryQuery.data ?? null;
  const summaryLoading = summaryQuery.isPending || summaryQuery.isFetching;

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

    return (
      <span
        className={cn(
          "inline-flex px-3 py-1 text-sm font-bold whitespace-nowrap rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider",
        )}>
        {label}
      </span>
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


  const handlePanelTransferOut = async (payload: any) => {
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
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handlePanelDropout = async (payload: any) => {
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
    } catch (err) {
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

  const programBreakdownItems = useMemo(() => {
    if (!summary) return [];

    return PROGRAM_FILTER_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      count: summary.programBreakdown[option.value] || 0,
    }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [summary]);

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
              title="Learner"
            />
          ),
          cell: ({ row }) => {
            return (
              <div className="flex flex-col text-left min-w-[200px] pl-2 py-3">
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
            )
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
            const display =
              normalized === "MALE" || normalized === "M"
                ? "M"
                : normalized === "FEMALE" || normalized === "F"
                  ? "F"
                  : row.original.sex || "—";

            return (
              <div className="flex w-full justify-center py-3">
                <span className="font-bold text-base leading-tight uppercase text-center">{display}</span>
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
              <span className="font-bold text-base leading-tight text-center">{row.original.gradeLevel}</span>
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
      ];
      return activeTab === "active" ? allColumns.filter(col => col.id !== "status") : allColumns;
    }, [activeTab]);

  const renderContent = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-base sm:text-base leading-tight uppercase  font-bold">
                Search Learner
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="LRN, first name, last name..."
                  className="pl-9 h-10 text-base leading-tight font-bold"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
              <div className="space-y-2">
                <Label className="text-base sm:text-base leading-tight uppercase  font-bold">
                  Grade Level
                </Label>
                <Select
                  value={gradeLevelFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setGradeLevelFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-bold">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="all"
                      className="text-base leading-tight font-bold">
                      All Grades
                    </SelectItem>
                    {gradeLevels.map((gl) => (
                      <SelectItem
                        key={gl.id}
                        value={gl.id.toString()}
                        className="text-base leading-tight font-bold">
                        {gl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-base sm:text-base leading-tight uppercase  font-bold">
                  Program
                </Label>
                <Select
                  value={programFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setProgramFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-bold">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="all"
                      className="text-base leading-tight font-bold">
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
              </div>
              <div className="space-y-2">
                <Label className="text-base sm:text-base leading-tight uppercase  font-bold">
                  Section
                </Label>
                <Select
                  value={sectionFilter}
                  onValueChange={(value) => {
                    startTransition(() => {
                      setSectionFilter(value);
                      setPage(1);
                    });
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-base leading-tight font-bold hover:bg-accent hover:text-accent-foreground transition-colors">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="all"
                      className="text-base leading-tight font-bold">
                      All Sections
                    </SelectItem>
                    {gradeLevelFilter === "all" ? (
                      gradeLevels.map((gl) => {
                        const glSections = filteredSections.filter(
                          (s) => s.gradeLevelId === gl.id
                        );
                        if (glSections.length === 0) return null;
                        return (
                          <SelectGroup key={gl.id}>
                            <SelectLabel className="text-base text-muted-foreground uppercase">{gl.name}</SelectLabel>
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
              </div>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 text-base leading-tight font-bold w-full md:w-auto"
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
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant="outline"
                className="h-10 px-3 text-base leading-tight font-bold w-full md:w-auto"
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
                Reset
              </Button>
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
          <CardDescription className="text-base sm:text-base leading-tight font-bold">
            Showing {students.length} of {total} learners
          </CardDescription>
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
                            <p className="font-bold">{student.gradeLevel}</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total Enrolled + Grade Breakdown */}
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] h-full">
          <CardHeader className="pb-1">
            <CardDescription className="text-base uppercase font-bold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Total Enrolled
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold">
              {summaryLoading ? "…" : <AnimatedNumber value={summary?.totalEnrolled ?? 0} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-1.5">
              {GRADE_DISPLAY.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-md border bg-muted/40 px-2.5 py-1.5 flex items-center justify-between gap-2 text-base font-bold">
                  <span>{label}</span>
                  <span className="font-extrabold">
                    {summaryLoading ? "…" : <AnimatedNumber value={summary?.gradeBreakdown[key] ?? 0} />}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Gender Breakdown + Progress Bar */}
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] h-full">
          <CardHeader className="pb-1">
            <CardDescription className="text-base uppercase font-bold flex items-center gap-1.5">
              <PieChart className="h-3.5 w-3.5" />
              Sex Breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {summaryLoading ? (
              <div className="text-base leading-tight font-bold text-foreground">…</div>
            ) : !summary ? (
              <p className="text-base font-bold text-foreground">
                No enrolled learners yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase inline-flex items-center gap-1">
                      <Mars className="h-3.5 w-3.5 text-sky-700" /> Male
                    </span>
                    <span className="text-base font-extrabold text-sky-700">
                      <AnimatedNumber value={summary.genderBreakdown.male} />
                    </span>
                  </div>
                  <div className="rounded-md border bg-muted/40 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase inline-flex items-center gap-1">
                      <Venus className="h-3.5 w-3.5 text-rose-700" /> Female
                    </span>
                    <span className="text-base font-extrabold text-rose-700">
                      <AnimatedNumber value={summary.genderBreakdown.female} />
                    </span>
                  </div>
                </div>
                {summary.totalEnrolled > 0 && (
                  <div className="space-y-1">
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-sky-500 transition-all"
                        style={{
                          width: `${(summary.genderBreakdown.male / summary.totalEnrolled) * 100}%`,
                        }}
                      />
                      <div
                        className="bg-rose-400 transition-all"
                        style={{
                          width: `${(summary.genderBreakdown.female / summary.totalEnrolled) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-foreground font-bold text-right">
                      <AnimatedNumber
                        value={(summary.genderBreakdown.male / summary.totalEnrolled) * 100}
                        decimals={1}
                        suffix="% M"
                      />
                      {" · "}
                      <AnimatedNumber
                        value={(summary.genderBreakdown.female / summary.totalEnrolled) * 100}
                        decimals={1}
                        suffix="% F"
                      />
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Curricular Programs */}
        <Card className="border-none shadow-sm bg-[hsl(var(--card))] h-full">
          <CardHeader className="pb-1">
            <CardDescription className="text-base uppercase font-bold flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Curricular Programs
            </CardDescription>
            {!summaryLoading && programBreakdownItems.length > 0 && (
              <CardTitle className="text-3xl font-extrabold">
                <AnimatedNumber value={programBreakdownItems.length} />
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="text-base leading-tight font-bold text-foreground">…</div>
            ) : programBreakdownItems.length === 0 ? (
              <p className="text-base font-bold text-foreground">
                No enrolled learners yet.
              </p>
            ) : (
              <div
                className={cn(
                  "flex flex-col gap-1.5",
                  programBreakdownItems.length > 4 && "max-h-[80px] overflow-y-auto pr-1",
                )}>
                {programBreakdownItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-base leading-tight gap-2">
                    <span className="text-[11px] font-bold uppercase">
                      {item.label}
                    </span>
                    <span className="text-base font-extrabold text-blue-700">
                      <AnimatedNumber value={item.count} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Special Demographics / Flags */}
        <Card className="h-full shadow-sm bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30">
          <CardHeader className="pb-1">
            <CardDescription className="text-base uppercase font-bold flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5 text-amber-600" />
              Special Demographics
            </CardDescription>
            <p className="text-[10px] text-foreground font-bold leading-tight">
              DepEd funding &amp; intervention flags — not additional totals.
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="text-base leading-tight font-bold text-foreground">…</div>
            ) : !summary ? (
              <p className="text-base font-bold text-foreground">
                No enrolled learners yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {[
                  { label: "4Ps Beneficiaries", value: summary.specialDemographics.fourPs },
                  { label: "Balik-Aral (Returnees)", value: summary.specialDemographics.balikAral },
                  { label: "Transferees In", value: summary.specialDemographics.transfereesIn },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between text-base font-bold">
                    <span className="text-foreground">{label}</span>
                    <AnimatedNumber value={value} className="font-extrabold text-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-6 p-1 bg-white border-border relative">
          <TabsTrigger
            value="active"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "active" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20">
              <span className="hidden sm:inline">Currently Enrolled</span>
              <span className="sm:hidden">Current</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="completers"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "completers" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20">
              <span className="hidden sm:inline">JHS Completers (Alumni)</span>
              <span className="sm:hidden">Alumni</span>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="inactive"
            className="flex-1 min-w-25 font-bold transition-all relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
            {activeTab === "inactive" && (
              <motion.div
                layoutId="students-active-pill"
                className="absolute inset-0 bg-primary rounded-md"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <span className="relative z-20">
              <span className="hidden sm:inline">Transferred Out / Dropped</span>
              <span className="sm:hidden">Transferred / Dropped</span>
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

          {selectedStudentId && (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <StudentDetailPanel
                id={selectedStudentId}
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
