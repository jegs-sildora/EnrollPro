import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { queryKeys } from "@/shared/lib/queryKeys";
import { TeacherDirectoryCard } from "../components/TeacherDirectoryCard";
import { TeacherDetailPanel } from "../components/TeacherDetailPanel";

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

import { formatTeacherName } from "../utils";
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
  const [statusFilter, setStatusFilter] = useState<TeacherStatusFilter>("all");
  const [designationFilter, setDesignationFilter] =
    useState<TeacherDesignationFilter>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

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

  // Enterprise Standard: Delayed Skeleton for Initial Load (200ms delay)
  const showSkeleton = useDelayedLoading(loading && isInitialLoad, 200);

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

  const onStatusFilterChange = (value: TeacherStatusFilter) => {
    setStatusFilter(value);
  };

  const onDesignationFilterChange = (value: TeacherDesignationFilter) => {
    setDesignationFilter(value);
  };

  // Reset page when filters or limit change
  useEffect(() => {
    setPage(1);
  }, [activeFilter, statusFilter, designationFilter, departmentFilter, limit]);

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

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? teacher.isActive : !teacher.isActive);

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

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDesignation &&
        matchesDepartment
      );
    });
  }, [
    teachers,
    activeFilter,
    statusFilter,
    designationFilter,
    departmentFilter,
  ]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return filteredTeachers.slice(start, end);
  }, [filteredTeachers, page, limit]);

  // eSF7 profile validation is managed internally by the child panel component

  const teacherDirectoryCardElement = useMemo(
    () => (
      <TeacherDirectoryCard
        showSkeleton={showSkeleton}
        filteredTeachers={filteredTeachers}
        paginatedTeachers={paginatedTeachers}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onOpenDetail={(t) => {
          setViewingTeacher(t);
          setIsPanelOpen(true);
        }}
        controlBar={
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="w-full lg:w-110 shrink-0">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="w-full h-10 pl-9 bg-white text-base border-gray-300 uppercase font-bold"
                  aria-label="Search faculty and staff"
                  placeholder="Search name, Employee ID, mobile number, subject area, ..."
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-row flex-wrap lg:flex-nowrap items-center justify-end gap-3 w-full">
              <div className="w-50">
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    onStatusFilterChange(value as TeacherStatusFilter)
                  }>
                  <SelectTrigger className="h-10 bg-white text-sm">
                    <SelectValue placeholder="Service Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Service Status</SelectItem>
                    <SelectItem value="active">Active Personnel</SelectItem>
                    <SelectItem value="inactive">
                      Inactive / On Leave
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-50">
                <Select
                  value={designationFilter}
                  onValueChange={(value) =>
                    onDesignationFilterChange(value as TeacherDesignationFilter)
                  }>
                  <SelectTrigger className="h-10 bg-white text-sm">
                    <SelectValue placeholder="Role / Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles / Positions</SelectItem>
                    {availableDesignationFilters.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        className="text-sm">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-50">
                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="h-10 bg-white min-w-[160px] text-sm">
                    <SelectValue placeholder="Subject Area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subject Areas</SelectItem>
                    {DEPED_TEACHER_DEPARTMENT_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden lg:block w-px h-6 bg-gray-300 mx-1 shrink-0"></div>

              <Button
                className="h-10 px-3 text-sm text-gray-600 hover:text-gray-900 shrink-0"
                variant="ghost"
                onClick={() => {
                  setActiveFilter("");
                  setStatusFilter("all");
                  setDesignationFilter("all");
                  setDepartmentFilter("all");
                }}>
                <FilterXIcon className="w-4 h-4 mr-2" /> Clear
              </Button>
            </div>
          </div>
        }
      />
    ),
    [
      showSkeleton,
      filteredTeachers,
      paginatedTeachers,
      page,
      limit,
      invalidateTeacherQueries,
      activeFilter,
      statusFilter,
      designationFilter,
      departmentFilter,
      availableDesignationFilters,
    ],
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

  return (
    <div className="flex flex-col min-w-0 w-full max-w-full overflow-hidden h-[calc(100vh-6rem)] gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-balance text-foreground">
            Faculty & Staff Roster
          </h1>
          <p className="text-base leading-tight text-foreground text-balance font-bold">
            Manage faculty and staff records, school roles, advisory classes,
            and service status.
          </p>
        </div>
        <Button
          onClick={() => {
            setViewingTeacher(null);
            setIsPanelOpen(true);
          }}
          className="font-bold uppercase tracking-wide">
          <UserPlusIcon className="w-4 h-4 mr-2" />
          Add Faculty/Staff
        </Button>
      </div>

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-base leading-tight text-foreground">
          Set an active school year before editing school-year assignments.
        </div>
      ) : null}

      {/* Premium KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Faculty & Staff */}
        <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Total Faculty & Staff
            </p>
            <p className="mt-1 text-3xl font-black text-gray-900">
              {teachers.length}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <UsersIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Active */}
        <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Active Personnel
            </p>
            <p className="mt-1 text-3xl font-black text-green-600">
              {teachers.filter((t) => t.isActive).length}
            </p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <UserCheckIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Inactive / On Leave */}
        <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Inactive / On Leave
            </p>
            <p className="mt-1 text-3xl font-black text-gray-900">
              {teachers.filter((t) => !t.isActive).length}
            </p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <UserMinusIcon className="w-6 h-6" />
          </div>
        </div>

        {/* Class Advisers */}
        <div className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div>
            <p className="text-xs font-bold tracking-wider text-gray-500 uppercase">
              Class Advisers
            </p>
            <p className="mt-1 text-3xl font-black text-orange-600">
              {teachers.filter((t) => t.designation?.isClassAdviser).length}
            </p>
          </div>
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
            <BookOpenIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Teacher Directory Card */}
      {teacherDirectoryCardElement}

      {/* Teacher Detail Panel */}
      {renderedTeacherDetailPanel}
    </div>
  );
}
