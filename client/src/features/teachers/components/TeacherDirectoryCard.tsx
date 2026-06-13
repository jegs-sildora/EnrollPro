import { memo, useEffect } from "react";
import {
  FilterX,
  RefreshCw,
  Search,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { DEPED_TEACHER_DEPARTMENT_OPTIONS } from "@enrollpro/shared";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { PaginationBar } from "@/shared/components/PaginationBar";
import { useDebouncedSearch } from "@/shared/hooks/useDebouncedSearch";
import {
  cn,
  getAcademicDesignationColorClasses,
} from "@/shared/lib/utils";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";
import { formatAdvisorySectionSummary } from "../utils";

interface TeacherDirectoryCardProps {
  loading: boolean;
  isRefetching: boolean;
  showSkeleton: boolean;
  filteredTeachers: Teacher[];
  paginatedTeachers: Teacher[];
  teachers: Teacher[];
  statusFilter: TeacherStatusFilter;
  designationFilter: TeacherDesignationFilter;
  departmentFilter: string;
  availableDepartments: string[];
  availableDesignationFilters: Array<{ value: string; label: string }>;
  hasActiveFilters: boolean;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  onDesignationFilterChange: (value: TeacherDesignationFilter) => void;
  onDepartmentFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;

  onOpenDetail: (teacher: Teacher) => void;
}

export const TeacherDirectoryCard = memo(function TeacherDirectoryCard({
  loading,
  isRefetching,
  showSkeleton,
  teachers,
  filteredTeachers,
  paginatedTeachers,
  statusFilter,
  designationFilter,
  departmentFilter,
  availableDepartments,
  availableDesignationFilters,
  hasActiveFilters,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onSearchQueryChange,
  onStatusFilterChange,
  onDesignationFilterChange,
  onDepartmentFilterChange,
  onClearFilters,
  onRefresh,

  onOpenDetail,
}: TeacherDirectoryCardProps) {
  const {
    inputValue: searchInputValue,
    setInputValue: setSearchInputValue,
    activeFilter: activeSearch,
    isSearching,
    clearSearch,
  } = useDebouncedSearch();

  useEffect(() => {
    onSearchQueryChange(activeSearch);
  }, [activeSearch, onSearchQueryChange]);

  const renderAdvisoryStatus = (teacher: Teacher) => {
    const advisorySummary = formatAdvisorySectionSummary(teacher);

    if (advisorySummary === "-") {
      return (
        <Badge
          variant="outline"
          className="text-xs text-foreground">
          None
        </Badge>
      );
    }

    return (
      <Badge
        variant="success"
        className="max-w-[220px] truncate text-xs font-bold"
        title={`Assigned to ${advisorySummary}`}>
        {advisorySummary}
      </Badge>
    );
  };



  const renderTeacherActions = (teacher: Teacher) => (
    <div className="flex items-center justify-center gap-2 min-w-[180px] w-full">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors"
        onClick={() => onOpenDetail(teacher)}>
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );

  const columns: ColumnDef<Teacher>[] = [
    {
      id: "photo",
      header: "",
      size: 60,
      minSize: 60,
      maxSize: 60,
      meta: {
        customSkeleton: (
          <Skeleton className="h-8 w-8 rounded-full mx-auto animate-pulse" />
        ),
      },
      cell: ({ row }) => {
        const teacher = row.original;
        const initials =
          `${teacher.firstName.charAt(0)}${teacher.lastName.charAt(0)}`.toUpperCase();
        return (
          <div className="flex justify-center ml-6">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shrink-0 uppercase">
              {initials}
            </div>
          </div>
        );
      },
    },
    {
      id: "teacher",
      accessorKey: "lastName",
      size: 260,
      minSize: 240,
      meta: {
        customSkeleton: (
          <div className="flex flex-col gap-1.5 text-left pl-2">
            <Skeleton className="h-5 w-36 animate-pulse" />
            <Skeleton className="h-4 w-48 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PERSONNEL & CONTACT"
          className="font-bold"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="w-full flex flex-col text-left pl-2 py-1">
            <span className="font-semibold text-sm text-foreground">
              {teacher.lastName}, {teacher.firstName}
            </span>
            <span className="text-xs text-foreground leading-tight">
              {teacher.email || "No email address"}
            </span>
          </div>
        );
      },
    },
    {
      id: "employeeId",
      accessorKey: "employeeId",
      size: 130,
      minSize: 120,
      meta: {
        customSkeleton: (
          <div className="flex flex-col gap-1.5 text-left pl-2">
            <Skeleton className="h-5 w-24 animate-pulse" />
            <Skeleton className="h-4 w-28 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="PLANTILLA & ID"
          className="font-bold justify-start text-left"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        const isTeachingStaff = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;

        if (!isTeachingStaff) {
          return (
            <div className="w-full flex flex-col text-left pl-2 py-1">
              <span className="text-sm font-bold text-foreground">
                {teacher.employeeId || <span className="text-gray-300">—</span>}
              </span>
              <span className="text-xs text-gray-300 italic leading-tight">
                —
              </span>
            </div>
          );
        }

        return (
          <div className="w-full flex flex-col text-left pl-2 py-1">
            <span className="text-sm font-bold text-foreground">
              {teacher.employeeId}
            </span>
            {teacher.plantillaPosition ? (
              <span className="text-xs text-foreground italic leading-tight">
                {teacher.plantillaPosition}
              </span>
            ) : (
              <span className="text-xs text-gray-300 italic leading-tight">
                —
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "department",
      accessorKey: "department",
      size: 200,
      minSize: 180,
      meta: {
        customSkeleton: (
          <div className="flex flex-col gap-1.5 items-start pl-2">
            <Skeleton className="h-5 w-24 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-32 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="DEPARTMENT ASSIGNMENT"
          className="font-bold justify-start text-left"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        const isTeachingStaff = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;

        if (!isTeachingStaff) {
          return (
            <div className="w-full flex flex-col items-start text-left gap-1 pl-2 py-1">
              <span className="text-sm font-bold text-gray-300 uppercase whitespace-nowrap">
                —
              </span>
            </div>
          );
        }

        const fullDept = DEPED_TEACHER_DEPARTMENT_OPTIONS.find((opt) => opt.value === teacher.department)?.label || teacher.department;
        return (
          <div className="w-full flex flex-col items-start text-left gap-1 pl-2 py-1">
            {fullDept ? (
              <span className="text-sm font-bold uppercase whitespace-nowrap">
                {fullDept}
              </span>
            ) : (
              <span className="text-sm font-bold text-gray-300 uppercase whitespace-nowrap">
                —
              </span>
            )}
            {teacher.specialization && (
              <span className="text-xs text-foreground leading-tight">
                {teacher.specialization}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "facultyStatus",
      accessorKey: "isActive",
      size: 140,
      minSize: 120,
      meta: {
        customSkeleton: (
          <div className="flex flex-col gap-1.5 items-center mx-auto">
            <Skeleton className="h-5 w-16 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-28 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="ACCOUNT STATUS"
          className="font-bold justify-center"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        const status = teacher.serviceStatus;

        const statusConfig: Record<string, { label: string; pillClass: string }> = {
          ACTIVE: {
            label: "Active",
            pillClass: "bg-primary/10 text-primary border-primary/20",
          },
          ON_LEAVE: {
            label: "On Leave",
            pillClass: "bg-secondary text-secondary-foreground border-secondary/20",
          },
          TRANSFERRED: {
            label: "Transferred",
            pillClass: "bg-muted text-foreground border-border",
          },
          RETIRED_RESIGNED: {
            label: "Retired / Resigned",
            pillClass: "bg-muted text-foreground border-border",
          },
          DROPPED_FROM_ROLLS: {
            label: "Dropped from Rolls",
            pillClass: "bg-destructive/10 text-destructive border-destructive/20",
          },
        };

        const config = statusConfig[status] ?? statusConfig.ACTIVE;

        return (
          <div className="flex flex-col items-center justify-center gap-1 py-1">
            <Badge variant="outline" className={cn("text-xs font-bold px-2.5 py-0.5 border rounded-full", config.pillClass)}>
              {config.label}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "designation",
      size: 180,
      minSize: 160,
      meta: {
        customSkeleton: (
          <div className="flex flex-col gap-1.5 items-start pl-2">
            <Skeleton className="h-5 w-24 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-20 rounded-full animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="SYSTEM ROLES"
          className="font-bold justify-start text-left"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        const roles = teacher.userAccount?.roles || [];

        if (roles.length === 0) {
          return (
            <div className="w-full flex justify-start pl-2">
              <span className="text-foreground font-bold uppercase text-xs whitespace-nowrap">
                Subject Teacher
              </span>
            </div>
          );
        }

        const roleLabels: Record<string, string> = {
          SYSTEM_ADMIN: "School Head",
          HEAD_REGISTRAR: "Registrar",
          TEACHER: "Teacher",
          CLASS_ADVISER: "Class Adviser",
          MRF: "MRF Staff",
        };

        return (
          <div className="w-full flex flex-col items-start gap-1.5 py-1 pl-2">
            <div className="flex flex-wrap justify-start gap-1 max-w-[170px]">
              {roles.map((role) => (
                <Badge
                  key={`${teacher.id}-${role}`}
                  variant="outline"
                  className={cn(
                    "text-xs font-black uppercase px-2 h-5 border-none whitespace-nowrap",
                    role === "CLASS_ADVISER" ? getAcademicDesignationColorClasses("CLASS ADVISER") :
                      role === "TEACHER" ? "bg-slate-100 text-slate-600 border-slate-200" :
                        "bg-slate-100 text-slate-700 border-slate-200"
                  )}>
                  {roleLabels[role] || role}
                </Badge>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "advisorySection",
      size: 200,
      minSize: 180,
      meta: {
        customSkeleton: (
          <Skeleton className="h-5 w-36 pl-2 animate-pulse" />
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="ADVISORY SECTION"
          className="font-bold justify-start text-left"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        const isTeachingStaff = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;

        return (
          <div className="w-full flex justify-start pl-2">
            {!isTeachingStaff ? (
              <span className="text-xs font-bold text-gray-300 italic">—</span>
            ) : (
              renderAdvisoryStatus(teacher)
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 200,
      minSize: 180,
      meta: {
        customSkeleton: (
          <div className="flex gap-2 justify-center w-full">
            <Skeleton className="h-8 w-20 animate-pulse" />
            <Skeleton className="h-8 w-8 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="ACTIONS"
          className="font-bold justify-center"
        />
      ),
      cell: ({ row }) => (
        <div className="w-full flex justify-center">
          {renderTeacherActions(row.original)}
        </div>
      ),
    },
  ];

  return (
    <Card className="w-full min-w-0 overflow-hidden shadow-xl border flex flex-col max-h-full min-h-0 rounded-xl">
      <CardHeader className="border-b bg-gradient-to-r from-muted/20 via-muted/10 to-transparent py-3 px-4 shrink-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-dashed border-border mb-3">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col gap-1 items-start m-0 p-0">
              <span className="text-xs font-black uppercase tracking-wider m-0 p-0">
                TOTAL PERSONNEL
              </span>
              <span className="text-3xl font-black text-red-900 tabular-nums m-0 p-0 leading-none">
                {teachers.length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col gap-1 items-start m-0 p-0">
              <span className="text-xs font-black uppercase tracking-wider m-0 p-0">
                ACTIVE PERSONNEL
              </span>
              <span className="text-3xl font-black text-emerald-600 tabular-nums m-0 p-0 leading-none">
                {teachers.filter((t) => t.isActive).length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col gap-1 items-start m-0 p-0">
              <span className="text-xs font-black uppercase tracking-wider m-0 p-0">
                INACTIVE PERSONNEL
              </span>
              <span className="text-3xl font-black text-slate-400 tabular-nums m-0 p-0 leading-none">
                {teachers.filter((t) => !t.isActive).length}
              </span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col gap-1 items-start m-0 p-0">
              <span className="text-xs font-black uppercase tracking-wider m-0 p-0">
                CLASS ADVISERS
              </span>
              <span className="text-3xl font-black text-slate-800 tabular-nums m-0 p-0 leading-none">
                {teachers.filter((t) => t.designation?.isClassAdviser).length}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full mt-3">
          <div className="relative w-full md:w-[40%] shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground pointer-events-none" />
            <Input
              value={searchInputValue}
              onChange={(event) => setSearchInputValue(event.target.value)}
              placeholder="Search name, ID, learning area, section..."
              autoComplete="off"
              className="h-9 pl-9 font-bold text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 flex-1 min-w-0">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                onStatusFilterChange(value as TeacherStatusFilter)
              }>
              <SelectTrigger className="h-9 w-auto min-w-[130px] font-bold uppercase text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">All Statuses</SelectItem>
                <SelectItem value="active" className="font-bold">Active Only</SelectItem>
                <SelectItem value="inactive" className="font-bold">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={designationFilter}
              onValueChange={(value) =>
                onDesignationFilterChange(value as TeacherDesignationFilter)
              }>
              <SelectTrigger className="h-9 w-auto min-w-[150px] font-bold uppercase text-xs">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">All Designations</SelectItem>
                {availableDesignationFilters.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="font-bold text-xs uppercase">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={departmentFilter}
              onValueChange={onDepartmentFilterChange}>
              <SelectTrigger className="h-9 w-auto min-w-[160px] font-bold uppercase text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all" className="font-bold">All Departments</SelectItem>
                {availableDepartments.map((department) => (
                  <SelectItem key={department} value={department} className="font-bold text-xs uppercase">
                    {department}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="h-9 font-bold uppercase text-xs px-3"
              disabled={!hasActiveFilters}
              onClick={() => {
                clearSearch();
                onClearFilters();
              }}>
              <FilterX className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 font-bold uppercase text-xs"
              onClick={onRefresh}>
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 min-w-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200 flex flex-col flex-1 min-h-0",
            isRefetching ? "opacity-50 pointer-events-none" : "opacity-100",
          )}>
          <div className="md:hidden space-y-3">
            {(showSkeleton || isSearching) ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border-2 p-3 space-y-3 animate-pulse bg-background">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2">
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-3 w-16 bg-muted rounded" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                </div>
              ))
            ) : paginatedTeachers.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm text-foreground italic font-bold">
                {hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found.'}
              </div>
            ) : (
              paginatedTeachers.map((teacher) => {
                const isTeachingStaff = teacher.userAccount?.roles?.some(r => ["TEACHER", "CLASS_ADVISER"].includes(r)) ?? false;
                return (
                  <div
                    key={teacher.id}
                    className={`rounded-xl border-2 p-3 space-y-3 ${!teacher.isActive ? "bg-muted/20" : "bg-background shadow-sm"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shrink-0 uppercase">
                          {teacher.firstName.charAt(0)}
                          {teacher.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-sm uppercase leading-tight">
                            {teacher.lastName}, {teacher.firstName}
                          </p>
                          <p className="text-xs text-foreground mt-0.5 font-bold">
                            {teacher.email || "No email address"}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        const s = teacher.serviceStatus;
                        const cfg: Record<string, { label: string; pillClass: string }> = {
                          ACTIVE: { label: "Active", pillClass: "bg-primary/10 text-primary border-primary/20" },
                          ON_LEAVE: { label: "On Leave", pillClass: "bg-secondary text-secondary-foreground border-secondary/20" },
                          TRANSFERRED: { label: "Transferred", pillClass: "bg-muted text-foreground border-border" },
                          RETIRED_RESIGNED: { label: "Retired / Resigned", pillClass: "bg-muted text-foreground border-border" },
                          DROPPED_FROM_ROLLS: { label: "Dropped from Rolls", pillClass: "bg-destructive/10 text-destructive border-destructive/20" },
                        };
                        const c = cfg[s] ?? cfg.ACTIVE;
                        return (
                          <Badge variant="outline" className={cn("text-xs font-bold px-2.5 py-0.5 border rounded-full shrink-0", c.pillClass)}>
                            {c.label}
                          </Badge>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <p className="text-foreground uppercase font-bold text-[10px]">
                          Employee ID
                        </p>
                        <p className="font-bold text-foreground">
                          {teacher.employeeId || <span className="text-gray-300">—</span>}
                        </p>
                        {!isTeachingStaff ? (
                          <p className="text-[10px] text-gray-300 italic mt-0.5">—</p>
                        ) : teacher.plantillaPosition ? (
                          <p className="text-[10px] text-foreground italic mt-0.5">
                            {teacher.plantillaPosition}
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-300 italic mt-0.5">—</p>
                        )}
                      </div>
                      <div>
                        <p className="text-foreground uppercase font-bold text-[10px]">
                          Department Assignment
                        </p>
                        <div className="mt-0.5 flex flex-col items-start gap-1">
                          {!isTeachingStaff ? (
                            <span className="text-[10px] font-bold text-gray-300 uppercase whitespace-nowrap">—</span>
                          ) : (
                            <>
                              {teacher.department ? (
                                <Badge variant="default" className="text-[10px] px-1.5 py-0 font-bold uppercase whitespace-nowrap">
                                  {teacher.department}
                                </Badge>
                              ) : (
                                <span className="text-[10px] font-bold text-gray-300 uppercase whitespace-nowrap">—</span>
                              )}
                              {teacher.specialization && (
                                <p className="text-foreground text-[10px] leading-tight">
                                  {teacher.specialization}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground uppercase font-bold text-[10px]">
                          System Roles
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {(() => {
                            const roles = teacher.userAccount?.roles || [];
                            if (roles.length === 0) {
                              return (
                                <p className="text-foreground font-bold uppercase text-[10px]">
                                  Subject Teacher
                                </p>
                              );
                            }
                            const roleLabels: Record<string, string> = {
                              SYSTEM_ADMIN: "School Head",
                              HEAD_REGISTRAR: "Registrar",
                              TEACHER: "Teacher",
                              CLASS_ADVISER: "Class Adviser",
                              MRF: "MRF Staff",
                            };
                            return roles.map((role) => (
                              <Badge
                                key={`${teacher.id}-${role}`}
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-black uppercase px-1.5 h-4 border-none whitespace-nowrap",
                                  role === "CLASS_ADVISER" ? getAcademicDesignationColorClasses("CLASS ADVISER") :
                                    role === "TEACHER" ? "bg-slate-100 text-slate-600 border-slate-200" :
                                      "bg-slate-100 text-slate-700 border-slate-200"
                                )}>
                                {roleLabels[role] || role}
                              </Badge>
                            ));
                          })()}
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground uppercase font-bold text-[10px]">
                          Advisory
                        </p>
                        <div className="mt-0.5">
                          {!isTeachingStaff ? (
                            <span className="text-[10px] font-bold text-gray-300 italic">—</span>
                          ) : (
                            renderAdvisoryStatus(teacher)
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground uppercase font-bold text-[10px]">
                          Portal Access
                        </p>
                        <div className="mt-0.5">
                          {(() => {
                            const ua = teacher.userAccount;
                            let accountLabel = "No Account";
                            let accountColor =
                              "text-foreground bg-muted border-foreground/30";

                            if (ua) {
                              if (!ua.isActive) {
                                accountLabel = "Suspended";
                                accountColor =
                                  "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800";
                              } else if (ua.mustChangePassword && !ua.lastLoginAt) {
                                accountLabel = "Provisioned";
                                accountColor =
                                  "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
                              } else {
                                accountLabel = "SSO Active";
                                accountColor =
                                  "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800";
                              }
                            } else if (teacher.isActive) {
                              accountLabel = "No Account";
                              accountColor =
                                "text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800";
                            }

                            return (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-black uppercase px-1.5 h-4.5 border gap-1 whitespace-nowrap",
                                  accountColor,
                                )}>
                                {ua?.isActive && (
                                  <span className="text-[10px]">🌐</span>
                                )}
                                {accountLabel}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      {renderTeacherActions(teacher)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden md:flex flex-col min-h-0 max-h-full bg-muted/5 relative">
            <DataTable<Teacher, unknown>
              columns={columns}
              data={paginatedTeachers}
              tableClassName="min-w-full"
              loading={loading || isSearching}
              forceEmptyState={false}
              virtualize={true}
              estimatedRowHeight={60}
              className="border-none rounded-none max-h-full h-auto"
              containerHeight="100%"
              onRowClick={onOpenDetail}
              getRowClassName={() => "hover:bg-gray-50 cursor-pointer"}
              noResultsMessage={
                hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found.'
              }
            />
          </div>

          <div className="shrink-0 border-t">
            <PaginationBar
              page={page}
              total={filteredTeachers.length}
              limit={limit}
              onPageChange={onPageChange}
              onLimitChange={onLimitChange}
              itemName="Personnel"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
