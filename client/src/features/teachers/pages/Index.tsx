import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { useSettingsStore } from "@/store/settings.slice";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { queryKeys } from "@/shared/lib/queryKeys";
import { TeacherDirectoryCard } from "../components/TeacherDirectoryCard";
import { TeacherDetailPanel } from "../components/TeacherDetailPanel";

import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";

import { formatTeacherName } from "../utils";




interface DesignationFilterOption {
  value: string;
  label: string;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  // Enterprise Standard: Stale-While-Revalidate for Pagination/Refetch
  const isRefetching = loading && !isInitialLoad;



  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    for (const teacher of teachers) {
      if (teacher.department) {
        depts.add(teacher.department.toUpperCase());
      }
    }

    return Array.from(depts).sort();
  }, [teachers]);

  const availableDesignationFilters = useMemo<DesignationFilterOption[]>(() => {
    const roles = new Set<string>();
    let hasSubjectTeacher = false;

    for (const teacher of teachers) {
      if (!teacher.userAccount?.roles || teacher.userAccount.roles.length === 0) {
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
      const updated = teachers.find(t => t.id === viewingTeacher.id);
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
          ? !teacher.userAccount?.roles || teacher.userAccount.roles.length === 0
          : teacher.userAccount?.roles?.includes(designationFilter));

      const matchesDepartment =
        departmentFilter === "all" ||
        (teacher.department ?? "").toUpperCase() === departmentFilter.toUpperCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDesignation &&
        matchesDepartment
      );
    });
  }, [teachers, activeFilter, statusFilter, designationFilter, departmentFilter]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return filteredTeachers.slice(start, end);
  }, [filteredTeachers, page, limit]);

  const hasActiveFilters =
    activeFilter.trim().length > 0 ||
    statusFilter !== "all" ||
    designationFilter !== "all" ||
    departmentFilter !== "all";



  // eSF7 profile validation is managed internally by the child panel component

  
  
  
  const teacherDirectoryCardElement = useMemo(
    () => (
      <TeacherDirectoryCard
        loading={loading}
        isRefetching={isRefetching}
        showSkeleton={showSkeleton}
        teachers={teachers}
        filteredTeachers={filteredTeachers}
        paginatedTeachers={paginatedTeachers}
        statusFilter={statusFilter}
        designationFilter={designationFilter}
        departmentFilter={departmentFilter}
        availableDepartments={availableDepartments}
        availableDesignationFilters={availableDesignationFilters}
        hasActiveFilters={hasActiveFilters}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSearchQueryChange={setActiveFilter}
        onStatusFilterChange={setStatusFilter}
        onDesignationFilterChange={setDesignationFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        onClearFilters={() => {
          setActiveFilter("");
          setStatusFilter("all");
          setDesignationFilter("all");
          setDepartmentFilter("all");
        }}
        onRefresh={invalidateTeacherQueries}
        onOpenDetail={setViewingTeacher}
      />
    ),
    [
      loading,
      isRefetching,
      showSkeleton,
      teachers,
      filteredTeachers,
      paginatedTeachers,
      activeFilter,
      statusFilter,
      designationFilter,
      departmentFilter,
      availableDepartments,
      availableDesignationFilters,
      hasActiveFilters,
      ayId,
      page,
      limit,
      invalidateTeacherQueries,
    ],
  );

  const renderedTeacherDetailPanel = useMemo(
    () => (
      <TeacherDetailPanel
        open={Boolean(viewingTeacher)}
        teacher={viewingTeacher}
        onOpenChange={(open) => !open && setViewingTeacher(null)}
        onSaveSuccess={invalidateTeacherQueries}
      />
    ),
    [viewingTeacher, invalidateTeacherQueries],
  );



  return (
    <div className="flex flex-col min-w-0 w-full max-w-full overflow-hidden h-[calc(100vh-6rem)] gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-balance text-foreground">
            Faculty & Staff Roster
          </h1>
          <p className="text-base leading-tight text-foreground text-balance font-bold">
            Manage official DepEd personnel profiles, department heads, and system access levels.
          </p>
        </div>
      </div>

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-base leading-tight text-foreground">
          Set an active school year to edit designation metadata.
        </div>
      ) : null}

      {teacherDirectoryCardElement}

      {renderedTeacherDetailPanel}


    </div>
  );
}
