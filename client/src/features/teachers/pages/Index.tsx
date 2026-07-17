import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { queryKeys } from "@/shared/lib/queryKeys";
import { TeacherDetailPanel } from "../components/TeacherDetailPanel";
import { DataTable } from "@/shared/ui/data-table";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { usePaginationLimit } from '@/shared/hooks/usePaginationLimit';
import { UserPhoto } from "@/shared/components/UserPhoto";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { Badge } from "@/shared/ui/badge";
import { cn, getGradeLevelBadgeStyles } from "@/shared/lib/utils";
import { Eye, BookOpen } from "lucide-react";
import { useHeaderStore } from "@/store/header.slice";

import {
  UsersIcon,
  UserCheckIcon,
  UserMinusIcon,
  BookOpenIcon,
  SearchIcon,
  FilterXIcon,
  UserPlusIcon,
  FileSpreadsheetIcon,
  ChevronDownIcon,
  UploadIcon,
  DownloadIcon,
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { ConfirmationModal } from "@/shared/ui/confirmation-modal";

import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";

import { formatAdvisorySectionSummary, formatTeacherName } from "../utils";
import {
  DEPED_TEACHER_DEPARTMENT_OPTIONS,
  type Sf7ImportCommitResponse,
  type Sf7ImportPreviewResponse,
} from "@enrollpro/shared";
interface DesignationFilterOption {
  value: string;
  label: string;
}

const SF7_TEMPLATE_FILENAME =
  "School Form 7 (SF7) School Personnel Assignment List and Basic Profile.xlsx";

function downloadBrowserFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function formatSf7MatchStatus(status: Sf7ImportPreviewResponse["rows"][number]["matchStatus"]): string {
  if (status === "MATCHED") return "Matched";
  if (status === "MISSING_EMPLOYEE_ID") return "Missing Employee ID";
  return "No Matching Personnel";
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTeacherSearchIndex(teacher: Teacher): string {
  const middleInitial = teacher.middleName?.trim()
    ? `${teacher.middleName.trim().charAt(0)}.`
    : "";
  const fullNameWithInitial = `${teacher.lastName}, ${teacher.firstName}${middleInitial ? ` ${middleInitial}` : ""}`;
  const fullNameWithMiddle = `${teacher.lastName}, ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName}` : ""}`;

  return normalizeSearchText(
    [
      formatTeacherName(teacher),
      fullNameWithInitial,
      fullNameWithMiddle,
      `${teacher.firstName} ${teacher.middleName ?? ""} ${teacher.lastName}`,
      teacher.employeeId ?? "",
      teacher.contactNumber ?? "",
      teacher.department ?? "",
      teacher.specialization ?? "",
      teacher.designation?.advisorySection?.name ?? "",
      teacher.designation?.advisorySection?.gradeLevelName ?? "",
      ...(teacher.designation?.ancillaryRoles || []),
    ].join(" "),
  );
}

export default function Teachers() {
  const { activeSchoolYearId, viewingSchoolYearId } = useSettingsStore();
  const ayId = viewingSchoolYearId ?? activeSchoolYearId;

  const queryClient = useQueryClient();

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [activeFilter, setActiveFilter] = useState("");
  const [personnelTypeFilter, setPersonnelTypeFilter] = useState<"all" | "TEACHING" | "NON_TEACHING">("all");
  const [designationFilter, setDesignationFilter] =
    useState<TeacherDesignationFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [activeMetric, setActiveMetric] = useState<"total" | "active" | "inactive" | "advisers">("total");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = usePaginationLimit(50);

  const [sortBy, setSortBy] = useState<string>("lastName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const sf7FileInputRef = useRef<HTMLInputElement | null>(null);
  const [sf7PreviewOpen, setSf7PreviewOpen] = useState(false);
  const [sf7Preview, setSf7Preview] = useState<Sf7ImportPreviewResponse | null>(null);
  const [sf7PreviewFileName, setSf7PreviewFileName] = useState<string | null>(null);
  const [isSf7PreviewLoading, setIsSf7PreviewLoading] = useState(false);
  const [isSf7CommitLoading, setIsSf7CommitLoading] = useState(false);
  const [isSf7TemplateLoading, setIsSf7TemplateLoading] = useState(false);
  const [isSf7ExportLoading, setIsSf7ExportLoading] = useState(false);

  const teachersQuery = useQuery({
    queryKey: queryKeys.teachersList(ayId),
    queryFn: async () => {
      const res = await api.get("/teachers", {
        params: ayId ? { schoolYearId: ayId } : undefined,
      });

      return {
        teachers: (res.data.teachers || []) as Teacher[],
        scope: res.data.scope as {
          yearLabel?: string | null;
          classOpeningDate?: string | null;
          classEndDate?: string | null;
        } | null,
      };
    },
    enabled: Boolean(ayId),
  });

  const teachers = teachersQuery.data?.teachers ?? [];
  const loading = teachersQuery.isPending || teachersQuery.isFetching;

  const availableDesignationFilters = useMemo<DesignationFilterOption[]>(() => {
    const roles = new Set<string>();
    let hasSubjectTeacher = false;

    for (const teacher of teachers) {
      if (
        !teacher.userAccount?.roles ||
        teacher.userAccount.roles.length === 0
      ) {
        hasSubjectTeacher = true;
      } else {
        for (const role of teacher.userAccount.roles) {
          roles.add(role);
        }
      }
    }

    const roleLabels: Record<string, string> = {
      SYSTEM_ADMIN: "School Head",
      HEAD_REGISTRAR: "Registrar",
      TEACHER: "Teacher",
      CLASS_ADVISER: "Class Adviser",
      MRF: "MRF Staff",
    };

    const options: DesignationFilterOption[] = [];

    for (const role of Array.from(roles).sort((a, b) => a.localeCompare(b))) {
      options.push({
        value: role,
        label: roleLabels[role] || role,
      });
    }

    if (hasSubjectTeacher) {
      options.push({
        value: "SUBJECT_TEACHER",
        label: "Subject Teacher",
      });
    }

    return options;
  }, [teachers]);

  const invalidateTeacherQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.teachersList(ayId) }),
    ]);
  }, [ayId, queryClient]);

  const handleSf7FileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;

      const isSupportedFile =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".csv") ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "text/csv" ||
        file.type === "application/csv" ||
        file.type === "application/vnd.ms-excel";

      if (!isSupportedFile) {
        sileo.error({
          title: "Invalid File",
          description: "Upload an SF7 roster in .xlsx or .csv format only.",
        });
        return;
      }

      const payload = new FormData();
      payload.append("file", file);

      setIsSf7PreviewLoading(true);
      setSf7PreviewFileName(file.name);
      try {
        const response = await api.post<Sf7ImportPreviewResponse>(
          "/sf7/import/preview",
          payload,
        );
        setSf7Preview(response.data);
        setSf7PreviewOpen(true);
      } catch (error: unknown) {
        toastApiError(error as never);
      } finally {
        setIsSf7PreviewLoading(false);
      }
    },
    [],
  );

  const handleCommitSf7Preview = useCallback(async () => {
    if (!sf7Preview) return;

    setIsSf7CommitLoading(true);
    try {
      const response = await api.post<Sf7ImportCommitResponse>(
        "/sf7/import/commit",
        { rows: sf7Preview.rows },
      );
      await invalidateTeacherQueries();
      setSf7PreviewOpen(false);
      setSf7Preview(null);
      setSf7PreviewFileName(null);
      sileo.success({
        title: "SF7 Roster Imported",
        description: `Updated ${response.data.updatedCount} personnel record(s). Skipped ${response.data.skippedCount}.`,
      });
    } catch (error: unknown) {
      toastApiError(error as never);
    } finally {
      setIsSf7CommitLoading(false);
    }
  }, [invalidateTeacherQueries, sf7Preview]);

  const handleDownloadSf7Template = useCallback(async () => {
    setIsSf7TemplateLoading(true);
    try {
      const response = await api.get<Blob>("/sf7/template", {
        responseType: "blob",
      });
      downloadBrowserFile(response.data, SF7_TEMPLATE_FILENAME);
      sileo.success({
        title: "Template Downloaded",
        description: "Blank SF7 template with dropdown validation has been downloaded.",
      });
    } catch (error: unknown) {
      toastApiError(error as never);
    } finally {
      setIsSf7TemplateLoading(false);
    }
  }, []);

  const handleExportSf7ComplianceReport = useCallback(async () => {
    if (!ayId) {
      sileo.error({
        title: "School Year Required",
        description: "Select an active school year before exporting SF7.",
      });
      return;
    }

    setIsSf7ExportLoading(true);
    try {
      const response = await api.get<Blob>("/export/sf7", {
        params: { schoolYearId: ayId },
        responseType: "blob",
      });
      downloadBrowserFile(response.data, `SF7_Compliance_Report_${ayId}.xlsx`);
      sileo.success({
        title: "SF7 Export Started",
        description: "Official personnel assignment list has been downloaded.",
      });
    } catch (error: unknown) {
      toastApiError(error as never);
    } finally {
      setIsSf7ExportLoading(false);
    }
  }, [ayId]);

  const onPersonnelTypeFilterChange = (value: "all" | "TEACHING" | "NON_TEACHING") => {
    setPersonnelTypeFilter(value);
  };

  const onDesignationFilterChange = (value: TeacherDesignationFilter) => {
    setDesignationFilter(value);
  };

  // Reset page when filters or limit change
  useEffect(() => {
    setPage(1);
  }, [activeFilter, personnelTypeFilter, designationFilter, departmentFilter, activeMetric, limit]);

  // eSF7 profile panel handles individual field changes internally

  useEffect(() => {
    if (teachersQuery.data) {
      setIsInitialLoad(false);
    }
  }, [teachersQuery.data]);

  useEffect(() => {
    if (teachersQuery.isError) {
      toastApiError(teachersQuery.error as never);
    }
  }, [teachersQuery.isError, teachersQuery.error]);

  useEffect(() => {
    if (viewingTeacher && teachers.length > 0) {
      const updated = teachers.find((t) => t.id === viewingTeacher.id);
      if (updated && updated !== viewingTeacher) {
        setViewingTeacher(updated);
      }
    }
  }, [teachers, viewingTeacher]);

  const filteredTeachers = useMemo(() => {
    const normalizedSearch = normalizeSearchText(activeFilter);

    return teachers.filter((teacher) => {
      const matchesSearch =
        !normalizedSearch ||
        buildTeacherSearchIndex(teacher).includes(normalizedSearch);

      const matchesPersonnelType = (() => {
        if (personnelTypeFilter === "all") return true;
        const isTeaching =
          teacher.personnelType === "TEACHING" ||
          (!teacher.personnelType &&
            (teacher.plantillaPosition?.toUpperCase().includes("TEACHER") ||
              teacher.plantillaPosition?.toUpperCase().includes("INSTRUCTOR") ||
              teacher.plantillaPosition?.toUpperCase().includes("PRINCIPAL") ||
              teacher.plantillaPosition?.toUpperCase().includes("PROFESSOR")));
        return personnelTypeFilter === "TEACHING" ? isTeaching : !isTeaching;
      })();

      const matchesDesignation =
        designationFilter === "all" ||
        (designationFilter === "SUBJECT_TEACHER"
          ? !teacher.userAccount?.roles ||
          teacher.userAccount.roles.length === 0
          : teacher.userAccount?.roles?.includes(designationFilter));

      const matchesDepartment =
        departmentFilter === "all" ||
        (teacher.department ?? "").toUpperCase() ===
        departmentFilter.toUpperCase();

      const matchesActiveMetric =
        activeMetric === "total" ||
        (activeMetric === "active" && teacher.isActive) ||
        (activeMetric === "inactive" && !teacher.isActive) ||
        (activeMetric === "advisers" && !!teacher.userAccount?.roles?.includes("CLASS_ADVISER"));

      return (
        matchesSearch &&
        matchesPersonnelType &&
        matchesDesignation &&
        matchesDepartment &&
        matchesActiveMetric
      );
    });
  }, [
    teachers,
    activeFilter,
    personnelTypeFilter,
    designationFilter,
    departmentFilter,
    activeMetric,
  ]);

  const sortedTeachers = useMemo(() => {
    const sorted = [...filteredTeachers];
    const desc = sortOrder === "desc";

    const serviceStatusLabelsLocal: Record<string, string> = {
      ACTIVE: "Active",
      ON_LEAVE: "On Leave",
      TRANSFERRED: "Transferred",
      RETIRED_RESIGNED: "Retired/Resigned",
      DROPPED_FROM_ROLLS: "Dropped from Rolls",
    };

    function getJobTitleLocal(t: Teacher): string {
      if (t.plantillaPosition) {
        const romanNumerals = new Set(["I", "II", "III", "IV", "V", "VI"]);
        return t.plantillaPosition
          .toLocaleLowerCase()
          .split(" ")
          .filter(Boolean)
          .map((word) => {
            const upperWord = word.toLocaleUpperCase();
            if (romanNumerals.has(upperWord)) return upperWord;
            if (upperWord === "MRF") return upperWord;
            return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
          })
          .join(" ");
      }
      const roles = t.userAccount?.roles || [];
      if (roles.includes("SYSTEM_ADMIN")) return "School Head";
      if (roles.includes("HEAD_REGISTRAR")) return "Registrar";
      if (roles.includes("MRF")) return "MRF Staff";
      return "Subject Teacher";
    }

    sorted.sort((a, b) => {
      let valA = "";
      let valB = "";

      if (sortBy === "lastName") {
        valA = a.lastName + a.firstName;
        valB = b.lastName + b.firstName;
      } else if (sortBy === "plantillaPosition") {
        valA = getJobTitleLocal(a);
        valB = getJobTitleLocal(b);
      } else if (sortBy === "department") {
        valA = a.department || "";
        valB = b.department || "";
      } else if (sortBy === "advisoryClass") {
        const advA = formatAdvisorySectionSummary(a.designation?.advisorySection);
        const advB = formatAdvisorySectionSummary(b.designation?.advisorySection);
        valA = advA !== "-" ? advA : "";
        valB = advB !== "-" ? advB : "";
      } else if (sortBy === "serviceStatus") {
        const statusA = a.serviceStatus || "ACTIVE";
        const statusB = b.serviceStatus || "ACTIVE";
        valA = serviceStatusLabelsLocal[statusA] || statusA;
        valB = serviceStatusLabelsLocal[statusB] || statusB;
      } else if (sortBy === "portalStatus") {
        valA = (a.userAccount?.isActive ?? a.isActive) ? "ACTIVE" : "LOCKED";
        valB = (b.userAccount?.isActive ?? b.isActive) ? "ACTIVE" : "LOCKED";
      }

      if (valA < valB) return desc ? 1 : -1;
      if (valA > valB) return desc ? -1 : 1;
      return 0;
    });

    return sorted;
  }, [filteredTeachers, sortBy, sortOrder]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return sortedTeachers.slice(start, end);
  }, [sortedTeachers, page, limit]);

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

  const getInitials = (firstName?: string | null, lastName?: string | null): string => {
    const f = String(firstName || "").trim().charAt(0).toUpperCase();
    const l = String(lastName || "").trim().charAt(0).toUpperCase();
    return `${f}${l}` || "?";
  };

  const serviceStatusLabels: Record<string, string> = {
    ACTIVE: "Active",
    ON_LEAVE: "On Leave",
    TRANSFERRED: "Transferred",
    RETIRED_RESIGNED: "Retired/Resigned",
    DROPPED_FROM_ROLLS: "Dropped from Rolls",
  };

  function getJobTitle(teacher: Teacher): string {
    if (teacher.plantillaPosition) {
      const romanNumerals = new Set(["I", "II", "III", "IV", "V", "VI"]);
      return teacher.plantillaPosition
        .toLocaleLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((word) => {
          const upperWord = word.toLocaleUpperCase();
          if (romanNumerals.has(upperWord)) return upperWord;
          if (upperWord === "MRF") return upperWord;
          return `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`;
        })
        .join(" ");
    }
    const roles = teacher.userAccount?.roles || [];
    if (roles.includes("SYSTEM_ADMIN")) return "School Head";
    if (roles.includes("HEAD_REGISTRAR")) return "Registrar";
    if (roles.includes("MRF")) return "MRF Staff";
    return "Subject Teacher";
  }

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        id: "lastName",
        accessorKey: "lastName",
        size: 350,
        minSize: 260,
        maxSize: 450,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="FACULTY NAME"
          />
        ),
        cell: ({ row }) => {
          const initials = getInitials(row.original.firstName, row.original.lastName);
          return (
            <div className="flex min-w-0 items-center gap-3 py-3 pl-2">
              <UserPhoto
                photo={row.original.photoPath}
                containerClassName="w-9 h-9 rounded-full shadow-sm border shrink-0"
                className="w-full h-full object-cover"
                alt={formatTeacherName(row.original)}
                fallbackIcon={
                  <div className="w-full h-full rounded-full flex items-center justify-center text-white font-semibold  bg-primary">
                    {initials}
                  </div>
                }
              />
              <div className="flex min-w-0 flex-col text-left">
                <span className="break-words text-base font-extrabold uppercase leading-tight">
                  {formatTeacherName(row.original)}
                </span>
                <span className="font-bold text-foreground mt-1 uppercase">
                  EMPLOYEE ID: {row.original.employeeId || "N/A"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "department",
        accessorKey: "department",
        size: 200,
        minSize: 150,
        maxSize: 250,
        meta: { className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="SUBJECT / DEPARTMENT"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => {
          const dept = row.original.department;
          const display = DEPED_TEACHER_DEPARTMENT_OPTIONS.find(opt => opt.value === dept)?.label || dept || "—";
          return (
            <div className="flex w-full justify-center py-3">
              <span className="font-extrabold text-base leading-tight text-center uppercase">
                {display}
              </span>
            </div>
          );
        },
      },
      {
        id: "advisoryClass",
        accessorKey: "advisoryClass",
        size: 200,
        minSize: 150,
        maxSize: 250,
        meta: { className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="ADVISORY CLASS"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => {
          const adv = row.original.designation?.advisorySection;

          if (!adv) {
            return (
              <div className="flex w-full justify-center py-3">
                <span className="font-extrabold text-base leading-tight text-center uppercase">
                  —
                </span>
              </div>
            );
          }

          return (
            <div className="flex flex-col items-center justify-center py-2 gap-1 w-full">
              <Badge
                variant="outline"
                className={cn(
                  "font-extrabold px-2.5 py-0.5 rounded-md uppercase",
                  getGradeLevelBadgeStyles(adv.gradeLevelName || "Grade")
                )}
              >
                {adv.gradeLevelName || "Grade"}
              </Badge>
              <span className="font-extrabold text-sm leading-tight text-center uppercase">
                {adv.name}
              </span>
            </div>
          );
        },
      },
      {
        id: "serviceStatus",
        accessorKey: "serviceStatus",
        size: 150,
        minSize: 120,
        maxSize: 180,
        meta: { className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="SERVICE STATUS"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => {
          const status = row.original.serviceStatus || "ACTIVE";
          const label = serviceStatusLabels[status] || status;
          const isEnrolled = status === "ACTIVE";
          const isLeave = status === "ON_LEAVE";
          return (
            <div className="flex w-full justify-center py-3">
              <Badge
                variant="outline"
                className={cn(
                  "font-extrabold  px-2.5 py-0.5 rounded-md uppercase tracking-wider",
                  isEnrolled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-800 border-2"
                    : isLeave
                      ? "bg-amber-50 text-amber-700 border-amber-800 border-2"
                      : "bg-slate-50 text-slate-600 border-slate-800 border-2"
                )}>
                {label}
              </Badge>
            </div>
          );
        },
      },
      {
        id: "actions",
        size: 120,
        minSize: 100,
        maxSize: 140,
        meta: { className: "text-center", headerClassName: "text-center" },
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="ACTIONS"
            className="justify-center [&_button]:!m-0"
          />
        ),
        cell: ({ row }) => (
          <div className="flex w-full justify-center py-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 items-center justify-center rounded-md border bg-primary/5 px-4  text-primary transition-all border-2 border-primary hover:bg-primary hover:text-primary-foreground font-extrabold cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setViewingTeacher(row.original);
                setIsPanelOpen(true);
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Profile
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  // eSF7 profile validation is managed internally by the child panel component

  const controlBar = useMemo(
    () => (
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex-1 w-full min-w-[200px]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="w-full h-10 pl-9 bg-muted text-base border-gray-300 uppercase font-extrabold"
              aria-label="Search faculty and staff"
              placeholder="Search name, Employee ID, mobile number, subject area, ..."
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-row flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto font-extrabold shrink-0">
          <div className="w-full sm:w-48">
            <Select
              value={personnelTypeFilter}
              onValueChange={(value) =>
                onPersonnelTypeFilterChange(value as "all" | "TEACHING" | "NON_TEACHING")
              }>
              <SelectTrigger className="h-10 bg-muted">
                <SelectValue placeholder="Personnel Type" />
              </SelectTrigger>
              <SelectContent className="font-extrabold">
                <SelectItem value="all">All Personnel Types</SelectItem>
                <SelectItem value="TEACHING">Teaching Personnel</SelectItem>
                <SelectItem value="NON_TEACHING">Non-Teaching Personnel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={designationFilter}
              onValueChange={(value) =>
                onDesignationFilterChange(value as TeacherDesignationFilter)
              }>
              <SelectTrigger className="h-10 bg-muted">
                <SelectValue placeholder="Plantilla / Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-extrabold">All Plantilla / Designations</SelectItem>
                {availableDesignationFilters.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="font-extrabold">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}>
              <SelectTrigger className="h-10 bg-muted min-w-[160px]">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-extrabold">All Subjects</SelectItem>
                {DEPED_TEACHER_DEPARTMENT_OPTIONS.map((opt) => (
                  <SelectItem
                    className=" font-extrabold"
                    key={opt.value}
                    value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden xl:block w-px h-6 bg-gray-300 mx-1 shrink-0"></div>

          <Button
            className="h-10 px-3  text-gray-600 hover:text-gray-900 shrink-0"
            variant="ghost"
            onClick={() => {
              setActiveFilter("");
              setPersonnelTypeFilter("all");
              setDesignationFilter("all");
              setDepartmentFilter("all");
            }}>
            <FilterXIcon className="w-4 h-4 mr-2" /> Clear
          </Button>
        </div>
      </div>
    ),
    [
      activeFilter,
      personnelTypeFilter,
      designationFilter,
      departmentFilter,
      availableDesignationFilters,
    ]
  );

  const renderedTeacherDetailPanel = useMemo(
    () => (
      <TeacherDetailPanel
        open={isPanelOpen}
        teacher={viewingTeacher}
        onOpenChange={(open) => {
          setIsPanelOpen(open);
          if (!open) setViewingTeacher(null);
        }}
        onSaveSuccess={() => {
          invalidateTeacherQueries();
          setIsPanelOpen(false);
        }}
      />
    ),
    [isPanelOpen, viewingTeacher, invalidateTeacherQueries],
  );

  const sf7RowsNeedingReview = useMemo(
    () =>
      sf7Preview?.rows
        .filter((row) => row.matchStatus !== "MATCHED" || row.issues.length > 0)
        .slice(0, 50) ?? [],
    [sf7Preview],
  );

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Personnel Directory");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="flex flex-col min-w-0 w-full max-w-full overflow-hidden h-[calc(100vh-6rem)] gap-4">
      <input
        ref={sf7FileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={handleSf7FileSelected}
      />

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-base leading-tight text-foreground">
          Set an active school year before editing school-year assignments.
        </div>
      ) : null}

      {/* Teacher list table */}
      <div className="flex-1 min-h-0 bg-muted border border-slate-200 shadow-sm flex flex-col overflow-hidden rounded-md">
        {/* Dedicated Workspace Toolbar */}
        <div className="flex flex-row items-center justify-end p-3 gap-2 bg-transparent border-b border-gray-200 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={
                  isSf7PreviewLoading ||
                  isSf7TemplateLoading ||
                  isSf7ExportLoading ||
                  isSf7CommitLoading
                }
                className="h-9 font-extrabold uppercase tracking-wide rounded-sm shadow-none border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <FileSpreadsheetIcon className="w-4 h-4 mr-2 shrink-0" />
                <span className="truncate">SF7 Actions</span>
                <ChevronDownIcon className="w-4 h-4 ml-2 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 font-extrabold">
              <DropdownMenuItem
                disabled={isSf7PreviewLoading}
                onSelect={(event) => {
                  event.preventDefault();
                  sf7FileInputRef.current?.click();
                }}
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                Upload SF7 Roster
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isSf7TemplateLoading}
                onSelect={(event) => {
                  event.preventDefault();
                  handleDownloadSf7Template();
                }}
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Download Blank Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!ayId || isSf7ExportLoading}
                onSelect={(event) => {
                  event.preventDefault();
                  handleExportSf7ComplianceReport();
                }}
              >
                <FileSpreadsheetIcon className="w-4 h-4 mr-2" />
                Export Compliance Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => {
              setViewingTeacher(null);
              setIsPanelOpen(true);
            }}
            className="h-9 font-extrabold uppercase tracking-wide rounded-sm shadow-none"
          >
            <UserPlusIcon className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Add Personnel</span>
          </Button>
        </div>

        {/* Inline Metric Toolbar */}
        {(() => {
          const totalCount = teachers.length;
          const activeCount = teachers.filter((t) => t.isActive).length;
          const inactiveCount = teachers.filter((t) => !t.isActive).length;
          const classAdvisersCount = teachers.filter((t) => t.userAccount?.roles?.includes("CLASS_ADVISER")).length;

          const metrics = [
            { key: "total", title: "Total Personnel", value: totalCount },
            { key: "active", title: "Active Personnel", value: activeCount },
            { key: "inactive", title: "Inactive / On Leave", value: inactiveCount },
            { key: "advisers", title: "Class Advisers", value: classAdvisersCount },
          ] as const;

          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 h-auto min-h-10 border-b border-gray-200 bg-white shrink-0 md:divide-x md:divide-y-0 divide-y divide-gray-200">
              {metrics.map((m) => {
                const isActive = activeMetric === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setActiveMetric(m.key)}
                    className={cn(
                      "relative flex items-center justify-between px-4 py-2 md:py-0 h-10 md:h-full transition-colors uppercase font-extrabold z-10",
                      isActive
                        ? "text-primary-foreground bg-primary"
                        : "text-foreground hover:bg-gray-50"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="personnel-metric-pill"
                        className="absolute inset-0 bg-primary"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-20 whitespace-normal text-center break-words leading-snug">{m.title}</span>
                    <span className="ml-3 shrink-0 rounded-full bg-primary px-2 py-0.5 text-sm text-primary-foreground relative z-20">{m.value}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* Control Bar (Filters) */}
        <div className="bg-gray-50 border-b border-gray-200 p-2 sm:p-3 shrink-0">
          {controlBar}
        </div>

        {/* DataTable */}
        <div className="flex-1 overflow-auto relative">
          <DataTable
            columns={columns}
            data={paginatedTeachers}
            loading={loading && isInitialLoad}
            loadingBehavior="delayed"
            estimatedRowHeight={60}
            className="border-none rounded-md h-full"
            tableClassName="min-w-[980px] table-fixed"
            containerHeight="100%"
            sorting={sorting}
            onSortingChange={onSortingChange}
            getRowClassName={() => "group"}
          />
        </div>

        {/* Pagination Bar */}
        <PaginationBar
          page={page}
          total={filteredTeachers.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
          itemName="Personnel"
        />
      </div>

      {/* Teacher Detail Panel */}
      {renderedTeacherDetailPanel}

      <ConfirmationModal
        open={isSf7ExportLoading}
        onOpenChange={() => undefined}
        title="Exporting SF7 Compliance Report"
        description={
          <div className="space-y-2">
            <p>
              EnrollPro is preparing the official School Form 7 personnel assignment list.
            </p>
            <p>
              Please keep this page open while the system fills the school profile,
              personnel records, teaching loads, and weekly teaching minutes.
            </p>
          </div>
        }
        onConfirm={() => undefined}
        loading
        loadingOnly
        loadingText="Exporting compliance report..."
        variant="primary"
        icon={FileSpreadsheetIcon}
      />

      <Dialog
        open={sf7PreviewOpen}
        onOpenChange={(open) => {
          if (isSf7CommitLoading) return;
          setSf7PreviewOpen(open);
        }}
      >
        <DialogContent className="w-full max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl uppercase">SF7 Roster Preflight Review</DialogTitle>
            <DialogDescription>
              Review the uploaded SF7 roster before writing personnel updates to EnrollPro.
              Only matched records are eligible for commit.
            </DialogDescription>
          </DialogHeader>

          {sf7Preview ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm font-extrabold text-foreground">
                File: {sf7PreviewFileName ?? "Selected SF7 roster"}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-md border bg-card p-3">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">Rows Found</p>
                  <p className="text-2xl font-extrabold">{sf7Preview.summary.totalRows}</p>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">Matched</p>
                  <p className="text-2xl font-extrabold text-emerald-700">{sf7Preview.summary.matchedRows}</p>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">No Employee No.</p>
                  <p className="text-2xl font-extrabold text-amber-700">{sf7Preview.summary.missingEmployeeIdRows}</p>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">No Match</p>
                  <p className="text-2xl font-extrabold text-red-700">{sf7Preview.summary.noMatchRows}</p>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <p className="text-xs font-extrabold uppercase text-muted-foreground">Flags</p>
                  <p className="text-2xl font-extrabold text-red-700">{sf7Preview.summary.issueCount}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-md border">
                <div className="border-b bg-muted/50 px-3 py-2 text-sm font-extrabold uppercase">
                  Preflight Data Grid
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 bg-muted text-left text-xs font-extrabold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Employee No.</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Preflight Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(sf7RowsNeedingReview.length > 0 ? sf7RowsNeedingReview : sf7Preview.rows.slice(0, 20)).map((row) => (
                        <tr key={`${row.rowNumber}-${row.employeeId ?? "none"}`}>
                          <td className="px-3 py-2 font-extrabold">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-bold">{row.employeeId ?? "Missing"}</td>
                          <td className="px-3 py-2 font-extrabold">{row.fullName ?? "Name not readable"}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={row.matchStatus === "MATCHED" ? "default" : "destructive"}
                              className="font-extrabold uppercase"
                            >
                              {formatSf7MatchStatus(row.matchStatus)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-bold text-muted-foreground">
                            {row.issues.length > 0 ? row.issues.join("; ") : "Ready for commit"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                Rows with missing employee numbers, duplicate employee numbers, or no matching EnrollPro personnel record will not be written.
                Formatting warnings are shown so the registrar can verify the roster before committing.
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm font-extrabold text-muted-foreground">
              Waiting for SF7 roster preview.
            </div>
          )}

          <DialogFooter className="gap-3 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={isSf7CommitLoading}
              onClick={() => setSf7PreviewOpen(false)}
              className="font-extrabold"
            >
              Review Later
            </Button>
            <Button
              type="button"
              disabled={!sf7Preview || sf7Preview.summary.matchedRows === 0 || isSf7CommitLoading}
              onClick={handleCommitSf7Preview}
              className="font-extrabold"
            >
              {isSf7CommitLoading ? "Importing..." : "Commit Valid Records"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
