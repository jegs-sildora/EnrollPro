import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  Eye,
  FileText,
  MoreHorizontal,
  ArrowRightLeft,
  BadgeAlert,
  FileBadge2,
  FileCheck2,
  UserRoundPen,
  Fingerprint,
  Mars,
  Venus,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { toastApiError } from "@/shared/hooks/useApiToast";
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
} from "@/shared/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Label } from "@/shared/ui/label";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";

interface Student {
  id: number;
  learningProgram: string;
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
  lifecycleOutcome: "TRANSFERRED_OUT" | "DROPPED_OUT" | null;
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
}

interface StudentDetail extends Student {
  rejectionReason: string | null;
  schoolYear: string;
  schoolYearId: number;
  enrollment: {
    id: number;
    section: string;
    sectionId: number;
    eosyStatus: "TRANSFERRED_OUT" | "DROPPED_OUT" | null;
    dropOutReason: string | null;
    dropOutDate: string | null;
    transferOutDate: string | null;
    transferOutSchoolName: string | null;
    transferOutReason: string | null;
    advisingTeacher: string | null;
    enrolledAt: string;
    enrolledBy: string;
  } | null;
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
}

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
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<string>("dateEnrolled");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filteredSections, setFilteredSections] = useState<Section[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(
    null,
  );
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [showTransferOutDialog, setShowTransferOutDialog] = useState(false);
  const [showDropoutDialog, setShowDropoutDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showLrnDialog, setShowLrnDialog] = useState(false);

  const [actionStudent, setActionStudent] = useState<Student | null>(null);

  const [transferOutDate, setTransferOutDate] = useState("");
  const [transferOutSchoolName, setTransferOutSchoolName] = useState("");
  const [transferOutReason, setTransferOutReason] = useState("");

  const [dropoutReasonCode, setDropoutReasonCode] =
    useState<DropoutReasonCode>("LACK_OF_INTEREST");
  const [dropoutReasonDetails, setDropoutReasonDetails] = useState("");
  const [dropoutDate, setDropoutDate] = useState("");

  const [shiftTargetSectionId, setShiftTargetSectionId] = useState("");

  const [profileForm, setProfileForm] = useState({
    emailAddress: "",
    contactNumber: "",
    religion: "",
    motherTongue: "",
    currentAddress: "",
  });

  const [lrnForm, setLrnForm] = useState({
    lrn: "",
  });

  const [summary, setSummary] = useState<StudentsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch grade levels and sections
  useEffect(() => {
    const fetchFilters = async () => {
      if (!ayId) return;
      try {
        const [glRes, secRes] = await Promise.all([
          api.get(`/curriculum/${ayId}/grade-levels`),
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

  // Handle sorting
  const handleSort = useCallback(
    (field: string) => {
      if (sortBy === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortBy(field);
        setSortOrder("asc");
      }
      setPage(1);
    },
    [sortBy, sortOrder],
  );

  const getSortIcon = useCallback(
    (field: string) => {
      if (sortBy !== field) {
        return <ArrowUpDown className="h-4 w-4 ml-1 opacity-40" />;
      }
      return sortOrder === "asc" ? (
        <ArrowUp className="h-4 w-4 ml-1" />
      ) : (
        <ArrowDown className="h-4 w-4 ml-1" />
      );
    },
    [sortBy, sortOrder],
  );

  // Fetch students
  const fetchStudents = useCallback(async () => {
    if (!ayId) return;
    if (initialLoad) setLoading(true);
    try {
      const params: Record<string, string | number> = {
        schoolYearId: ayId,
        page,
        limit: 15,
        sortBy,
        sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (gradeLevelFilter !== "all") params.gradeLevelId = gradeLevelFilter;
      if (programFilter !== "all") params.programType = programFilter;
      if (sectionFilter !== "all") params.sectionId = sectionFilter;

      const res = await api.get("/students", { params });
      setStudents(res.data.students || []);
      setTotal(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) {
      toastApiError(err as never);
      setStudents([]);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [
    ayId,
    page,
    debouncedSearch,
    gradeLevelFilter,
    programFilter,
    sectionFilter,
    sortBy,
    sortOrder,
    initialLoad,
  ]);

  const fetchSummary = useCallback(async () => {
    if (!ayId) return;
    setSummaryLoading(true);
    try {
      const res = await api.get<StudentsSummary>("/students/summary", {
        params: {
          schoolYearId: ayId,
        },
      });
      setSummary(res.data);
    } catch (err) {
      toastApiError(err as never);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [ayId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  const handleViewDetails = useCallback(async (studentId: number) => {
    setDetailLoading(true);
    setDetailDialogOpen(true);
    try {
      const res = await api.get(`/students/${studentId}`);
      setSelectedStudent(res.data.student);
    } catch (err) {
      toastApiError(err as never);
      setDetailDialogOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const getEnrolledBadge = () => (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
      Enrolled
    </Badge>
  );

  const formatDate = (dateString: string) => {
    return formatManilaDate(dateString, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const handleOpenPermanentRecord = useCallback(
    (studentId: number) => {
      navigate(`/students/${studentId}?tab=academic`);
    },
    [navigate],
  );

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
    await Promise.all([fetchStudents(), fetchSummary()]);
  }, [fetchStudents, fetchSummary]);

  const refreshDetailIfOpen = useCallback(
    async (studentId: number) => {
      if (!detailDialogOpen || selectedStudent?.id !== studentId) {
        return;
      }

      try {
        const res = await api.get(`/students/${studentId}`);
        setSelectedStudent(res.data.student);
      } catch (err) {
        toastApiError(err as never);
      }
    },
    [detailDialogOpen, selectedStudent?.id],
  );

  const openTransferOutDialog = useCallback(
    (student: Student) => {
      setActionStudent(student);
      setTransferOutDate(toDateInputValue());
      setTransferOutSchoolName("");
      setTransferOutReason("");
      setShowTransferOutDialog(true);
    },
    [toDateInputValue],
  );

  const openDropoutDialog = useCallback(
    (student: Student) => {
      setActionStudent(student);
      setDropoutDate(toDateInputValue());
      setDropoutReasonCode("LACK_OF_INTEREST");
      setDropoutReasonDetails("");
      setShowDropoutDialog(true);
    },
    [toDateInputValue],
  );

  const openShiftDialog = useCallback((student: Student) => {
    setActionStudent(student);
    setShiftTargetSectionId("");
    setShowShiftDialog(true);
  }, []);

  const openProfileQuickEditDialog = useCallback(async (student: Student) => {
    setActionStudent(student);

    try {
      const res = await api.get(`/students/${student.id}`);
      const detail = res.data.student as StudentDetail & {
        religion?: string | null;
        motherTongue?: string | null;
        currentAddress?: {
          barangay?: string | null;
          cityMunicipality?: string | null;
          province?: string | null;
        } | null;
      };

      setProfileForm({
        emailAddress: detail.emailAddress ?? student.emailAddress ?? "",
        contactNumber:
          detail.parentGuardianContact ?? student.parentGuardianContact ?? "",
        religion: detail.religion ?? "",
        motherTongue: detail.motherTongue ?? "",
        currentAddress:
          [
            detail.currentAddress?.barangay,
            detail.currentAddress?.cityMunicipality,
            detail.currentAddress?.province,
          ]
            .filter(Boolean)
            .join(", ") ||
          student.address ||
          "",
      });
    } catch {
      setProfileForm({
        emailAddress: student.emailAddress ?? "",
        contactNumber: student.parentGuardianContact ?? "",
        religion: "",
        motherTongue: "",
        currentAddress: student.address || "",
      });
    }

    setShowProfileDialog(true);
  }, []);

  const openAssignLrnDialog = useCallback((student: Student) => {
    setActionStudent(student);
    setLrnForm({
      lrn: /^\d{12}$/.test(student.lrn || "") ? student.lrn : "",
    });
    setShowLrnDialog(true);
  }, []);

  const openGoodMoralPreview = useCallback(
    (studentId: number) => {
      navigate(`/students/${studentId}?tab=application`);
      sileo.info({
        title: "Good Moral Workflow",
        description:
          "Open the Application tab to review documentary status and process the request.",
      });
    },
    [navigate],
  );

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

  const submitShiftSection = useCallback(async () => {
    if (!actionStudent) return;
    if (!shiftTargetSectionId) {
      sileo.warning({
        title: "Target section required",
        description: "Please select a target section.",
      });
      return;
    }

    setActionSubmitting(true);
    try {
      await api.post(`/students/${actionStudent.id}/lifecycle/shift-section`, {
        sectionId: Number(shiftTargetSectionId),
      });

      sileo.success({
        title: "Section assignment updated",
        description: "Learner was moved to the selected section.",
      });
      setShowShiftDialog(false);
      await refreshTables();
      await refreshDetailIfOpen(actionStudent.id);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  }, [actionStudent, shiftTargetSectionId, refreshTables, refreshDetailIfOpen]);

  const submitQuickProfileUpdate = useCallback(async () => {
    if (!actionStudent) return;

    setActionSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        emailAddress: profileForm.emailAddress.trim() || null,
        contactNumber: profileForm.contactNumber.trim() || null,
        religion: profileForm.religion.trim() || null,
        motherTongue: profileForm.motherTongue.trim() || null,
      };

      if (profileForm.currentAddress.trim()) {
        payload.currentAddress = {
          barangay: profileForm.currentAddress.trim(),
        };
      }

      await api.put(`/students/${actionStudent.id}`, payload);

      sileo.success({
        title: "Profile updated",
        description: "Learner demographic details were saved.",
      });
      setShowProfileDialog(false);
      await refreshTables();
      await refreshDetailIfOpen(actionStudent.id);
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setActionSubmitting(false);
    }
  }, [actionStudent, profileForm, refreshTables, refreshDetailIfOpen]);

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

  const availableShiftSections = useMemo(() => {
    if (!actionStudent) return [];

    return sections
      .filter((section) => section.gradeLevelId === actionStudent.gradeLevelId)
      .filter((section) => section.id !== actionStudent.sectionId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [actionStudent, sections]);

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

  const topProgramBreakdownItems = useMemo(
    () => programBreakdownItems.slice(0, 3),
    [programBreakdownItems],
  );

  const otherProgramLearnerCount = useMemo(
    () =>
      programBreakdownItems
        .slice(3)
        .reduce((totalCount, item) => totalCount + item.count, 0),
    [programBreakdownItems],
  );

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        id: "student",
        header: () => (
          <button
            onClick={() => handleSort("lastName")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Learner
            {getSortIcon("lastName")}
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col text-left min-w-[200px] pl-2">
            <span className="font-bold text-sm uppercase leading-tight">
              {row.original.fullName}
            </span>
            <span className="text-xs font-semibold text-muted-foreground leading-snug">
              {formatLearningProgramLabel(row.original.learningProgram)}
            </span>
          </div>
        ),
      },
      {
        id: "lrn",
        header: () => (
          <button
            onClick={() => handleSort("lrn")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            LRN
            {getSortIcon("lrn")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">{row.original.lrn}</span>
        ),
      },
      {
        id: "gender",
        header: () => (
          <div className="flex h-11 w-full items-center justify-center px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90">
            Gender
          </div>
        ),
        cell: ({ row }) => {
          const normalized = row.original.sex?.trim().toUpperCase();
          const display =
            normalized === "MALE" || normalized === "M"
              ? "M"
              : normalized === "FEMALE" || normalized === "F"
                ? "F"
                : row.original.sex || "—";

          return <span className="font-bold text-sm uppercase">{display}</span>;
        },
      },
      {
        id: "gradeLevel",
        header: () => (
          <button
            onClick={() => handleSort("gradeLevel")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Grade Level
            {getSortIcon("gradeLevel")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">{row.original.gradeLevel}</span>
        ),
      },
      {
        id: "section",
        header: () => (
          <button
            onClick={() => handleSort("section")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Section
            {getSortIcon("section")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm">
            {formatSectionLabel(row.original.section)}
          </span>
        ),
      },
      {
        id: "enrolled",
        header: () => (
          <button
            onClick={() => handleSort("dateEnrolled")}
            className="flex h-11 w-full items-center justify-center gap-1 px-3 text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 transition-colors">
            Date Enrolled
            {getSortIcon("dateEnrolled")}
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold block text-center">
            {formatDate(row.original.dateEnrolled || row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-2 min-w-[180px]">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
              onClick={() => handleViewDetails(row.original.id)}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 px-0 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                  aria-label={`Open actions for ${row.original.fullName}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-semibold">
                <DropdownMenuItem
                  onClick={() => handleOpenProfilePage(row.original.id)}
                  className="cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" />
                  Open Full Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleOpenPermanentRecord(row.original.id)}
                  className="cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate SF10 / Permanent Record
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openGoodMoralPreview(row.original.id)}
                  className="cursor-pointer">
                  <FileCheck2 className="mr-2 h-4 w-4" />
                  Open Good Moral Workflow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void openProfileQuickEditDialog(row.original)}
                  className="cursor-pointer">
                  <UserRoundPen className="mr-2 h-4 w-4" />
                  Quick Update Demographics
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openAssignLrnDialog(row.original)}
                  className="cursor-pointer">
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Assign or Correct LRN
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openShiftDialog(row.original)}
                  className="cursor-pointer">
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Shift Section or Program
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openTransferOutDialog(row.original)}
                  className="cursor-pointer text-amber-700 focus:text-amber-700">
                  <FileBadge2 className="mr-2 h-4 w-4" />
                  Mark as Transferred Out
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openDropoutDialog(row.original)}
                  className="cursor-pointer text-rose-700 focus:text-rose-700">
                  <BadgeAlert className="mr-2 h-4 w-4" />
                  Mark as Dropped Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
    ],
    [
      handleSort,
      getSortIcon,
      handleViewDetails,
      handleOpenProfilePage,
      handleOpenPermanentRecord,
      openGoodMoralPreview,
      openProfileQuickEditDialog,
      openAssignLrnDialog,
      openShiftDialog,
      openTransferOutDialog,
      openDropoutDialog,
    ],
  );

  if (!ayId) {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <Card className="max-w-md w-full border-dashed shadow-none bg-muted/20">
          <CardContent className="pt-10 pb-10 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-foreground">
                No School Year Selected
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
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
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Users className="h-8 w-8" />
          Learner Directory
        </h1>
        <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
          Manage officially enrolled learner records for the selected school
          year.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Total Enrolled
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold">
              {summaryLoading ? "..." : (summary?.totalEnrolled ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-1">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Gender Breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="text-sm font-bold text-muted-foreground">...</div>
            ) : !summary ? (
              <p className="text-xs font-semibold text-muted-foreground">
                No enrolled learners yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border bg-muted/40 px-2 py-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase inline-flex items-center gap-1">
                    <Mars className="h-3.5 w-3.5 text-sky-700" />
                    Male
                  </span>
                  <span className="text-xs font-extrabold text-sky-700">
                    {summary.genderBreakdown.male}
                  </span>
                </div>
                <div className="rounded-md border bg-muted/40 px-2 py-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase inline-flex items-center gap-1">
                    <Venus className="h-3.5 w-3.5 text-rose-700" />
                    Female
                  </span>
                  <span className="text-xs font-extrabold text-rose-700">
                    {summary.genderBreakdown.female}
                  </span>
                </div>
                {summary.genderBreakdown.other > 0 && (
                  <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">
                      Others
                    </span>
                    <span className="text-xs font-extrabold text-muted-foreground">
                      {summary.genderBreakdown.other}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
          <CardHeader className="pb-1">
            <CardDescription className="text-xs uppercase tracking-wider font-bold">
              Program Breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {summaryLoading ? (
              <div className="text-sm font-bold text-muted-foreground">...</div>
            ) : programBreakdownItems.length === 0 ? (
              <p className="text-xs font-semibold text-muted-foreground">
                No enrolled learners yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {topProgramBreakdownItems.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-md border bg-muted/40 px-2 py-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase">
                      {item.label}
                    </span>
                    <span className="text-xs font-extrabold text-blue-700">
                      {item.count}
                    </span>
                  </div>
                ))}
                {otherProgramLearnerCount > 0 && (
                  <div className="rounded-md border border-dashed bg-muted/30 px-2 py-1 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">
                      Others
                    </span>
                    <span className="text-xs font-extrabold text-muted-foreground">
                      {otherProgramLearnerCount}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="border-none shadow-sm bg-[hsl(var(--card))]">
        <CardHeader className="px-3 sm:px-6 pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                Search Learner
              </Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
                <Input
                  placeholder="LRN, first name, last name..."
                  className="pl-9 h-10 text-sm font-bold"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex gap-3 md:gap-4 w-full md:w-auto">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Grade Level
                </Label>
                <Select
                  value={gradeLevelFilter}
                  onValueChange={(value) => {
                    setGradeLevelFilter(value);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-sm font-bold">
                    <SelectValue placeholder="All Grades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-bold">
                      All Grades
                    </SelectItem>
                    {gradeLevels.map((gl) => (
                      <SelectItem
                        key={gl.id}
                        value={gl.id.toString()}
                        className="text-sm font-bold">
                        {gl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Program
                </Label>
                <Select
                  value={programFilter}
                  onValueChange={(value) => {
                    setProgramFilter(value);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-sm font-bold">
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-bold">
                      All Programs
                    </SelectItem>
                    {PROGRAM_FILTER_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-sm font-bold">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm uppercase tracking-wider font-bold">
                  Section
                </Label>
                <Select
                  value={sectionFilter}
                  onValueChange={(value) => {
                    setSectionFilter(value);
                    setPage(1);
                  }}>
                  <SelectTrigger className="h-10 w-full md:w-52 text-sm font-bold">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-bold">
                      All Sections
                    </SelectItem>
                    {filteredSections.map((sec) => (
                      <SelectItem
                        key={sec.id}
                        value={sec.id.toString()}
                        className="text-sm font-bold">
                        {formatSectionLabel(sec.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2">
              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  void Promise.all([fetchStudents(), fetchSummary()]);
                }}
                disabled={loading || !ayId}>
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Button
                variant="outline"
                className="h-10 px-3 text-sm font-bold w-full md:w-auto"
                onClick={() => {
                  setSearch("");
                  setGradeLevelFilter("all");
                  setProgramFilter("all");
                  setSectionFilter("all");
                  setSortBy("dateEnrolled");
                  setSortOrder("desc");
                  setPage(1);
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
            Enrolled Learner Records
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm font-semibold">
            Showing {students.length} of {total} enrolled learners
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 pb-4">
          <div className="md:hidden space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border p-3 space-y-3 animate-pulse">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                  <div className="h-9 bg-muted rounded w-full" />
                </div>
              ))
            ) : students.length === 0 ? (
              <div className="rounded-xl border p-6 text-center text-sm font-bold">
                No enrolled learners found for the selected filters.
              </div>
            ) : (
              students.map((student) => (
                <div
                  key={student.id}
                  className="rounded-xl border bg-[hsl(var(--card))] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm uppercase leading-tight break-words">
                        {student.fullName}
                      </p>
                      <p className="text-xs font-semibold text-muted-foreground leading-snug">
                        {formatLearningProgramLabel(student.learningProgram)}
                      </p>
                    </div>
                    {getEnrolledBadge()}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        LRN
                      </p>
                      <p className="font-bold">{student.lrn}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Gender
                      </p>
                      <p className="font-bold uppercase">
                        {student.sex === "MALE" || student.sex === "M"
                          ? "M"
                          : student.sex === "FEMALE" || student.sex === "F"
                            ? "F"
                            : student.sex || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Grade Level
                      </p>
                      <p className="font-bold">{student.gradeLevel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        Section
                      </p>
                      <p className="font-bold">
                        {formatSectionLabel(student.section)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                    Enrolled{" "}
                    {formatDate(student.dateEnrolled || student.createdAt)}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 flex-1 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                      onClick={() => handleViewDetails(student.id)}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      View
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-9 w-10 px-0 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                          aria-label={`Open actions for ${student.fullName}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-56 font-semibold">
                        <DropdownMenuItem
                          onClick={() => handleOpenProfilePage(student.id)}
                          className="cursor-pointer">
                          <Eye className="mr-2 h-4 w-4" />
                          Open Full Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleOpenPermanentRecord(student.id)}
                          className="cursor-pointer">
                          <FileText className="mr-2 h-4 w-4" />
                          Generate SF10 / Permanent Record
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openGoodMoralPreview(student.id)}
                          className="cursor-pointer">
                          <FileCheck2 className="mr-2 h-4 w-4" />
                          Open Good Moral Workflow
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void openProfileQuickEditDialog(student)
                          }
                          className="cursor-pointer">
                          <UserRoundPen className="mr-2 h-4 w-4" />
                          Quick Update Demographics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openAssignLrnDialog(student)}
                          className="cursor-pointer">
                          <Fingerprint className="mr-2 h-4 w-4" />
                          Assign or Correct LRN
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openShiftDialog(student)}
                          className="cursor-pointer">
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          Shift Section or Program
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openTransferOutDialog(student)}
                          className="cursor-pointer text-amber-700 focus:text-amber-700">
                          <FileBadge2 className="mr-2 h-4 w-4" />
                          Mark as Transferred Out
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openDropoutDialog(student)}
                          className="cursor-pointer text-rose-700 focus:text-rose-700">
                          <BadgeAlert className="mr-2 h-4 w-4" />
                          Mark as Dropped Out
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={students}
              loading={loading}
              noResultsMessage="No enrolled learners found for the selected filters."
            />
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
              <p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 font-bold"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-4 sm:p-6 space-y-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-lg sm:text-xl font-extrabold">
                Enrolled Learner Details
              </DialogTitle>
              <DialogDescription className="text-sm font-medium">
                Complete profile and enrollment details for{" "}
                {selectedStudent?.trackingNumber}
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-24 bg-muted rounded w-full" />
                <div className="h-24 bg-muted rounded w-full" />
              </div>
            ) : selectedStudent ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {getEnrolledBadge()}
                  <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--muted-foreground))] break-all">
                    {selectedStudent.trackingNumber}
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Full Name
                      </Label>
                      <p className="text-sm font-semibold break-words">
                        {selectedStudent.fullName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        LRN
                      </Label>
                      <p className="text-sm font-semibold">
                        {selectedStudent.lrn}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Date of Birth
                      </Label>
                      <p className="text-sm font-medium">
                        {formatDate(selectedStudent.birthDate)} (
                        {calculateAge(selectedStudent.birthDate)} yrs)
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Sex
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.sex}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Home Address
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Family and Contact
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Parent or Guardian
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.parentGuardianName}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Contact Number
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.parentGuardianContact}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Email Address
                      </Label>
                      <p className="text-sm font-medium break-words">
                        {selectedStudent.emailAddress}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Enrollment Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        School Year
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.schoolYear}
                      </p>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                        Grade Level
                      </Label>
                      <p className="text-sm font-medium">
                        {selectedStudent.gradeLevel}
                      </p>
                    </div>
                    {selectedStudent.enrollment ? (
                      <>
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Section
                          </Label>
                          <p className="text-sm font-medium">
                            {selectedStudent.enrollment.section}
                          </p>
                        </div>
                        {selectedStudent.enrollment.advisingTeacher && (
                          <div>
                            <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                              Advising Teacher
                            </Label>
                            <p className="text-sm font-medium">
                              {selectedStudent.enrollment.advisingTeacher}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Enrolled On
                          </Label>
                          <p className="text-sm font-medium">
                            {formatDate(selectedStudent.enrollment.enrolledAt)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase tracking-wider font-bold text-[hsl(var(--muted-foreground))]">
                            Enrolled By
                          </Label>
                          <p className="text-sm font-medium">
                            {selectedStudent.enrollment.enrolledBy}
                          </p>
                        </div>
                        {selectedStudent.enrollment.eosyStatus && (
                          <div className="sm:col-span-2 rounded-lg border border-dashed p-3 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              Lifecycle Outcome
                            </p>
                            <p className="text-sm font-semibold">
                              {selectedStudent.enrollment.eosyStatus
                                .replaceAll("_", " ")
                                .toLowerCase()
                                .replace(/\b\w/g, (letter) =>
                                  letter.toUpperCase(),
                                )}
                            </p>
                            {selectedStudent.enrollment.transferOutDate && (
                              <p className="text-xs font-medium text-muted-foreground">
                                Transfer Date:{" "}
                                {formatDate(
                                  selectedStudent.enrollment.transferOutDate,
                                )}
                              </p>
                            )}
                            {selectedStudent.enrollment
                              .transferOutSchoolName && (
                              <p className="text-xs font-medium text-muted-foreground">
                                Destination School:{" "}
                                {
                                  selectedStudent.enrollment
                                    .transferOutSchoolName
                                }
                              </p>
                            )}
                            {selectedStudent.enrollment.transferOutReason && (
                              <p className="text-xs font-medium text-muted-foreground">
                                Transfer Reason:{" "}
                                {selectedStudent.enrollment.transferOutReason}
                              </p>
                            )}
                            {selectedStudent.enrollment.dropOutDate && (
                              <p className="text-xs font-medium text-muted-foreground">
                                Dropout Date:{" "}
                                {formatDate(
                                  selectedStudent.enrollment.dropOutDate,
                                )}
                              </p>
                            )}
                            {selectedStudent.enrollment.dropOutReason && (
                              <p className="text-xs font-medium text-muted-foreground">
                                Dropout Reason:{" "}
                                {selectedStudent.enrollment.dropOutReason}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="sm:col-span-2 rounded-lg border border-dashed p-3">
                        <p className="text-sm font-semibold text-muted-foreground">
                          No enrollment assignment details are currently
                          available.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t text-xs sm:text-sm text-[hsl(var(--muted-foreground))] space-y-1">
                  <p className="font-semibold">
                    Applied: {formatDate(selectedStudent.createdAt)}
                  </p>
                  <p className="font-semibold">
                    Last Updated: {formatDate(selectedStudent.updatedAt)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transferOutDate">Transfer Date</Label>
              <Input
                id="transferOutDate"
                type="date"
                value={transferOutDate}
                onChange={(event) => setTransferOutDate(event.target.value)}
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
              onClick={() => void submitTransferOut()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Confirm Transfer Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDropoutDialog} onOpenChange={setShowDropoutDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark Learner as Dropped Out</DialogTitle>
            <DialogDescription>
              Update dropout details for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dropOutDate">Dropout Date</Label>
              <Input
                id="dropOutDate"
                type="date"
                value={dropoutDate}
                onChange={(event) => setDropoutDate(event.target.value)}
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
                    <SelectItem key={option.value} value={option.value}>
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
              onClick={() => void submitDropout()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Confirm Dropout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Shift Section or Program</DialogTitle>
            <DialogDescription>
              Reassign section for {actionStudent?.fullName}. Program changes
              are inferred from the selected target section.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Section</Label>
              <Select
                value={shiftTargetSectionId}
                onValueChange={setShiftTargetSectionId}
                disabled={availableShiftSections.length === 0}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableShiftSections.length === 0
                        ? "No other eligible sections"
                        : "Select target section"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableShiftSections.map((section) => (
                    <SelectItem key={section.id} value={String(section.id)}>
                      {formatSectionLabel(section.name)} (
                      {formatScpType(section.programType)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableShiftSections.length === 0 && (
              <p className="text-xs text-muted-foreground font-medium">
                No alternate section is currently available for this learner's
                grade level.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowShiftDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitShiftSection()}
              disabled={
                actionSubmitting || availableShiftSections.length === 0
              }>
              {actionSubmitting ? "Saving..." : "Confirm Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Update Demographics</DialogTitle>
            <DialogDescription>
              Apply quick demographic updates for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profileEmail">Email Address</Label>
              <Input
                id="profileEmail"
                type="email"
                value={profileForm.emailAddress}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    emailAddress: event.target.value,
                  }))
                }
                placeholder="learner@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileContact">Guardian Contact Number</Label>
              <Input
                id="profileContact"
                value={profileForm.contactNumber}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    contactNumber: event.target.value,
                  }))
                }
                placeholder="09XXXXXXXXX"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profileReligion">Religion</Label>
                <Input
                  id="profileReligion"
                  value={profileForm.religion}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      religion: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profileMotherTongue">Mother Tongue</Label>
                <Input
                  id="profileMotherTongue"
                  value={profileForm.motherTongue}
                  onChange={(event) =>
                    setProfileForm((prev) => ({
                      ...prev,
                      motherTongue: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileAddress">
                Current Address (Quick Entry)
              </Label>
              <Textarea
                id="profileAddress"
                value={profileForm.currentAddress}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    currentAddress: event.target.value,
                  }))
                }
                placeholder="Barangay or location note"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowProfileDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitQuickProfileUpdate()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLrnDialog} onOpenChange={setShowLrnDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign or Correct LRN</DialogTitle>
            <DialogDescription>
              Enter a valid 12-digit LRN for {actionStudent?.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="assignLrn">Learner Reference Number</Label>
            <Input
              id="assignLrn"
              value={lrnForm.lrn}
              onChange={(event) =>
                setLrnForm({
                  lrn: event.target.value.replace(/[^0-9]/g, "").slice(0, 12),
                })
              }
              placeholder="12-digit LRN"
              inputMode="numeric"
              maxLength={12}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLrnDialog(false)}
              disabled={actionSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void submitAssignLrn()}
              disabled={actionSubmitting}>
              {actionSubmitting ? "Saving..." : "Save LRN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
