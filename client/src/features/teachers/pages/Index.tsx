import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { sileo } from "sileo";
import {
  ChevronDown,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import api from "@/shared/api/axiosInstance";
import { useSettingsStore } from "@/store/settings.slice";
import { useHistoricalReadOnly } from "@/shared/hooks/useHistoricalReadOnly";
import { toastApiError } from "@/shared/hooks/useApiToast";
import type { AxiosError } from "axios";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { queryKeys } from "@/shared/lib/queryKeys";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { TeacherDirectoryCard } from "../components/TeacherDirectoryCard";
import { TeacherProfilePanel } from "../components/TeacherProfilePanel";
import { TeacherDetailPanel } from "../components/TeacherDetailPanel";
import { UpdateStatusModal } from "../components/UpdateStatusModal";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";
import type { UpdateServiceStatusInput } from "@enrollpro/shared";
import { formatTeacherName } from "../utils";


const DESIGNATION_FILTER_SUBJECT_TEACHER = "subject_teacher";
const DESIGNATION_FILTER_CLASS_ADVISER = "class_adviser";
const DESIGNATION_FILTER_ANCILLARY_PREFIX = "ancillary::";

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
  const { isHistoricalReadOnly, hasOverride } = useHistoricalReadOnly();
  const canMutate = !isHistoricalReadOnly || hasOverride;
  const queryClient = useQueryClient();

  const [isInitialLoad, setIsInitialLoad] = useState(true);


  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [updateStatusTeacher, setUpdateStatusTeacher] = useState<Teacher | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    let hasClassAdviser = false;
    let hasSubjectTeacher = false;

    for (const teacher of teachers) {
      const designation = teacher.designation;
      if (designation?.isClassAdviser) {
        hasClassAdviser = true;
      }

      if (
        !designation ||
        (!designation.isClassAdviser &&
          (!designation.ancillaryRoles || designation.ancillaryRoles.length === 0))
      ) {
        hasSubjectTeacher = true;
      }

      for (const role of designation?.ancillaryRoles || []) {
        roles.add(role);
      }
    }

    const options: DesignationFilterOption[] = [];
    if (hasClassAdviser) {
      options.push({
        value: DESIGNATION_FILTER_CLASS_ADVISER,
        label: "Class Adviser",
      });
    }

    for (const role of Array.from(roles).sort((a, b) => a.localeCompare(b))) {
      options.push({
        value: `${DESIGNATION_FILTER_ANCILLARY_PREFIX}${role}`,
        label: role,
      });
    }

    if (hasSubjectTeacher) {
      options.push({
        value: DESIGNATION_FILTER_SUBJECT_TEACHER,
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

  const startEditing = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditOpen(true);
  };



  const handleUpdateServiceStatus = async (input: UpdateServiceStatusInput) => {
    if (!updateStatusTeacher) return;

    setSubmitting(true);
    try {
      await api.patch(`/teachers/${updateStatusTeacher.id}/service-status`, input);
      sileo.success({
        title: "Service Status Updated",
        description: "Teacher service status has been updated successfully.",
      });
      setUpdateStatusTeacher(null);
      await invalidateTeacherQueries();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

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
        (designationFilter === DESIGNATION_FILTER_CLASS_ADVISER
          ? Boolean(teacher.designation?.isClassAdviser)
          : designationFilter === DESIGNATION_FILTER_SUBJECT_TEACHER
            ? !teacher.designation ||
            (!teacher.designation.isClassAdviser &&
              (!teacher.designation.ancillaryRoles ||
                teacher.designation.ancillaryRoles.length === 0))
            : designationFilter.startsWith(DESIGNATION_FILTER_ANCILLARY_PREFIX)
              ? Boolean(
                teacher.designation?.ancillaryRoles?.includes(
                  designationFilter.slice(
                    DESIGNATION_FILTER_ANCILLARY_PREFIX.length,
                  ),
                ),
              )
              : true);

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

  const openCreateTeacherSheet = () => {
    setCreateOpen(true);
  };

  const handleSyncAtlas = async () => {
    setSubmitting(true);
    try {
      // Corrected endpoint path: /integration is mapped to integrationTriggerRoutes
      const res = await api.post("/integration/atlas/sync-faculty");
      sileo.success({
        title: "ATLAS Sync Successful",
        description:
          res.data.message ||
          "Faculty roster has been synchronized with the scheduling system.",
      });
      await invalidateTeacherQueries();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number, data?: { code?: string } } };
      // Professional Error Handling with Reasons
      const status = error.response?.status;
      const errorCode = error.response?.data?.code;

      if (status === 404) {
        sileo.error({
          title: "Service Unavailable",
          description:
            "The ATLAS integration service endpoint could not be reached. This may be due to a server misconfiguration or the integration module being disabled.",
        });
      } else if (status === 503 || errorCode === "UPSTREAM_UNAVAILABLE") {
        sileo.error({
          title: "ATLAS Connection Failed",
          description:
            "EnrollPro was unable to establish a handshake with the ATLAS Scheduling System. Please ensure the ATLAS server is online and reachable via Tailscale.",
        });
      } else if (status === 401 || status === 403) {
        sileo.error({
          title: "Access Denied",
          description:
            "Integration credentials (API Key) for ATLAS are invalid or have expired. Please verify your system settings.",
        });
      } else {
        toastApiError(err as AxiosError<{ message?: string; errors?: Record<string, string[]> }>);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkImportPlaceholder = () => {
    sileo.info({
      title: "Bulk Import Coming Soon",
      description:
        "CSV bulk teacher import is queued for the next release. Use Add Teacher for now.",
    });
  };

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
        onEditTeacher={startEditing}
        onUpdateServiceStatus={setUpdateStatusTeacher}
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
      setUpdateStatusTeacher,
    ],
  );

  const renderedTeacherDetailPanel = useMemo(
    () => (
      <TeacherDetailPanel
        open={Boolean(viewingTeacher)}
        teacher={viewingTeacher}
        onOpenChange={(open) => !open && setViewingTeacher(null)}
      />
    ),
    [viewingTeacher],
  );

  const renderedTeacherCreateSheet = useMemo(
    () => (
      <TeacherProfilePanel
        open={createOpen}
        onOpenChange={setCreateOpen}
        teacherId={null}
        onSaveSuccess={async () => {
          await invalidateTeacherQueries();
        }}
      />
    ),
    [createOpen, invalidateTeacherQueries],
  );

  const renderedTeacherEditSheet = useMemo(
    () => (
      <TeacherProfilePanel
        open={editOpen}
        onOpenChange={(open: boolean) => {
          setEditOpen(open);
          if (!open) {
            setEditingTeacher(null);
          }
        }}
        teacherId={editingTeacher ? editingTeacher.id : null}
        onSaveSuccess={async () => {
          await invalidateTeacherQueries();
        }}
      />
    ),
    [editOpen, editingTeacher, invalidateTeacherQueries],
  );



  return (
    <div className="flex flex-col min-w-0 w-full max-w-full overflow-hidden h-[calc(100vh-6rem)] gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-balance text-foreground">
            Teacher Profiling
          </h1>
          <p className="text-sm text-foreground text-balance font-bold">
            Manage teacher profiles, learning areas, and adviser assignments.
          </p>
        </div>
        <div className="flex justify-end gap-2 flex-wrap">
          {canMutate && (
            <>
              <Button
                variant="secondary"
                onClick={handleSyncAtlas}
                disabled={submitting}
                className="font-black uppercase text-xs h-10 border-2 border-primary/20 shadow-sm hover:bg-primary/5 active:scale-95 transition-all">
                <RefreshCw
                  className={cn("mr-2 h-4 w-4", submitting && "animate-spin")}
                />
                Sync with ATLAS
              </Button>

              <div className="inline-flex shadow-sm rounded-lg overflow-hidden">
                <Button
                  onClick={openCreateTeacherSheet}
                  className="rounded-r-none h-10">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon-sm"
                      className="rounded-l-none border-l border-primary-foreground/20 h-10"
                      aria-label="Open add teacher options">
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56">
                    <DropdownMenuItem
                      onClick={openCreateTeacherSheet}
                      className="cursor-pointer">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Single Teacher
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleBulkImportPlaceholder}
                      className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Bulk Import (CSV)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </div>

      {!ayId ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-foreground">
          Set an active school year to edit designation metadata.
        </div>
      ) : null}

      {teacherDirectoryCardElement}

      {renderedTeacherCreateSheet}
      {renderedTeacherEditSheet}
      {renderedTeacherDetailPanel}

      <UpdateStatusModal
        open={Boolean(updateStatusTeacher)}
        onOpenChange={(open) => !open && setUpdateStatusTeacher(null)}
        teacher={updateStatusTeacher}
        onSave={handleUpdateServiceStatus}
        saving={submitting}
      />
    </div>
  );
}
