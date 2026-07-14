import { motion, AnimatePresence } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";

import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";

import { formatAdvisorySectionSummary, formatTeacherName } from "../utils";
import { DEPED_TEACHER_DEPARTMENT_OPTIONS } from "@enrollpro/shared";
interface DesignationFilterOption {
  value: string;
  label: string;
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

  const setTitle = useHeaderStore((s) => s.setTitle);

  useEffect(() => {
    setTitle("Personnel Directory");
    return () => setTitle(null);
  }, [setTitle]);

  return (
    <div className="flex flex-col min-w-0 w-full max-w-full overflow-hidden h-[calc(100vh-6rem)] gap-4">

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-base leading-tight text-foreground">
          Set an active school year before editing school-year assignments.
        </div>
      ) : null}

      {/* Teacher list table */}
      <div className="flex-1 min-h-0 bg-muted border border-slate-200 shadow-sm flex flex-col overflow-hidden rounded-md">
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 h-auto min-h-10 border-b border-gray-200 bg-white shrink-0 md:divide-x md:divide-y-0 divide-y divide-gray-200">
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
                    <span className="truncate relative z-20">{m.title}</span>
                    <span className="ml-3 shrink-0 rounded-full bg-primary px-2 py-0.5 text-sm text-primary-foreground relative z-20">{m.value}</span>
                  </button>
                );
              })}
              <div className="p-1 h-10 md:h-full">
                <Button
                  onClick={() => {
                    setViewingTeacher(null);
                    setIsPanelOpen(true);
                  }}
                  className="w-full h-full font-extrabold uppercase tracking-wide rounded-sm shadow-none">
                  <UserPlusIcon className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">Add Personnel</span>
                </Button>
              </div>
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
    </div>
  );
}
