import { memo, useEffect } from "react";
import {
  Eye,
  FilterX,
  MoreHorizontal,
  RefreshCw,
  Search,
  UserCog,
  UserRoundPen,
  Users,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
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
  getAncillaryRoleColorClasses,
} from "@/shared/lib/utils";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";
import { formatAdvisorySectionSummary, formatTeacherName } from "../utils";

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
  onEditTeacher: (teacher: Teacher) => void;
  onUpdateServiceStatus: (teacher: Teacher) => void;
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
  onEditTeacher,
  onUpdateServiceStatus,
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
        Assigned: {advisorySummary}
      </Badge>
    );
  };



  const renderTeacherActions = (teacher: Teacher) => (
    <div className="flex items-center justify-center gap-2 min-w-[180px]">
      <Button
        variant="secondary"
        size="sm"
        className="h-8 px-3 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
        onClick={() => onOpenDetail(teacher)}>
        <Eye className="h-3.5 w-3.5 mr-1.5" />
        View
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="h-8 w-8 px-0 text-xs font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
            aria-label={`Open row actions for ${formatTeacherName(teacher)}`}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 font-bold">
          <DropdownMenuItem
            onClick={() => onEditTeacher(teacher)}
            className="cursor-pointer font-bold">
            <UserRoundPen className="mr-2 h-4 w-4" />
            Quick Update Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onUpdateServiceStatus(teacher)}
            className="cursor-pointer text-primary focus:text-primary-foreground font-bold">
            <UserCog className="mr-2 h-4 w-4" />
            Update Service Status
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
          title="FACULTY IDENTITY"
          className="justify-center pl-0 font-bold"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex flex-col text-left pl-2 py-1">
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
          title="EMPLOYMENT METADATA"
          className="font-bold"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex flex-col text-left pl-2 py-1">
            <span className="text-sm font-bold text-foreground">
              {teacher.employeeId || "N/A"}
            </span>
            <span className="text-xs text-foreground italic leading-tight">
              {teacher.plantillaPosition || "UNRANKED"}
            </span>
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
          title="ASSIGNMENT & MAJOR"
          className="font-bold"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex flex-col items-start text-left gap-1 pl-2 py-1">
            <Badge variant="default" className="text-xs uppercase whitespace-nowrap">
              {teacher.department || "UNASSIGNED"}
            </Badge>
            <span className="text-xs text-foreground leading-tight">
              {teacher.specialization || "Generalist"}
            </span>
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
          <div className="flex flex-col gap-1.5 items-start pl-2">
            <Skeleton className="h-5 w-16 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-28 animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="STATUS & TENURE"
          className="font-bold"
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

        const formatAppointment = (track?: string | null) => {
          if (!track) return "Regular Permanent";
          return track
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
        };

        return (
          <div className="flex flex-col items-start text-left gap-1 pl-2 py-1">
            <Badge variant="outline" className={cn("text-xs font-bold px-2.5 py-0.5 border rounded-full", config.pillClass)}>
              {config.label}
            </Badge>
            <span className="text-xs text-foreground leading-tight">
              {formatAppointment(teacher.natureOfAppointment)}
            </span>
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
          <div className="flex flex-col gap-1.5 items-center mx-auto">
            <Skeleton className="h-5 w-24 rounded-full animate-pulse" />
            <Skeleton className="h-4 w-20 rounded-full animate-pulse" />
          </div>
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="SYSTEM DESIGNATION"
          className="font-bold"
        />
      ),
      cell: ({ row }) => {
        const designation = row.original.designation;

        if (!designation) {
          return (
            <div className="flex justify-center">
              <span className="text-foreground font-bold uppercase text-xs whitespace-nowrap">
                Subject Teacher
              </span>
            </div>
          );
        }

        const ancillaryRoles = designation.ancillaryRoles ?? [];

        return (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {designation.isClassAdviser ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-black uppercase px-2 h-5 border-none whitespace-nowrap",
                  getAcademicDesignationColorClasses("CLASS ADVISER"),
                )}>
                Class Adviser
              </Badge>
            ) : (
              <span className="text-foreground font-bold uppercase text-xs whitespace-nowrap">
                Subject Teacher
              </span>
            )}

            {ancillaryRoles.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 max-w-[170px]">
                {ancillaryRoles.map((role) => (
                  <Badge
                    key={`${row.original.id}-${role}`}
                    variant="outline"
                    className={cn(
                      "text-xs font-bold uppercase px-1.5 h-4 border-none",
                      getAncillaryRoleColorClasses(role),
                    )}>
                    {role}
                  </Badge>
                ))}
              </div>
            )}
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
          <Skeleton className="h-5 w-36 mx-auto animate-pulse" />
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="ADVISORY SECTION"
          className="font-bold"
        />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          {renderAdvisoryStatus(row.original)}
        </div>
      ),
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
          className="font-bold"
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
        <div className="flex flex-wrap items-center gap-4 pb-3 border-b border-dashed border-border mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-foreground" />
            <span className="text-xs font-black uppercase text-foreground tracking-wider">
              Total
            </span>
            <span className="text-base font-black text-primary tabular-nums">
              {teachers.length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-primary/20" />
            <span className="text-xs font-black uppercase text-foreground tracking-wider">
              Active
            </span>
            <span className="text-base font-black text-primary tabular-nums">
              {teachers.filter((t) => t.isActive).length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground ring-2 ring-muted-foreground/20" />
            <span className="text-xs font-black uppercase text-foreground tracking-wider">
              Inactive
            </span>
            <span className="text-base font-black text-foreground tabular-nums">
              {teachers.filter((t) => !t.isActive).length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-foreground ring-2 ring-foreground/20" />
            <span className="text-xs font-black uppercase text-foreground tracking-wider">
              Class Advisers
            </span>
            <span className="text-base font-black text-foreground tabular-nums">
              {teachers.filter((t) => t.designation?.isClassAdviser).length}
            </span>
          </div>
          {hasActiveFilters && (
            <>
              <div className="h-4 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-primary tracking-wider">
                  Showing
                </span>
                <span className="text-base font-black text-primary tabular-nums">
                  {filteredTeachers.length}
                </span>
              </div>
            </>
          )}
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
                  : 'No teachers found. Click "Add Teacher" to create one.'}
              </div>
            ) : (
              paginatedTeachers.map((teacher) => (
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
                        {teacher.employeeId || "N/A"}
                      </p>
                      <p className="text-[10px] text-foreground italic mt-0.5">
                        {teacher.plantillaPosition || "UNRANKED"}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold text-[10px]">
                        Assignment & Major
                      </p>
                      <div className="mt-0.5">
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 font-bold uppercase whitespace-nowrap">
                          {teacher.department || "UNASSIGNED"}
                        </Badge>
                      </div>
                      <p className="text-foreground text-[10px] mt-0.5 leading-tight">
                        {teacher.specialization || "Generalist"}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold text-[10px]">
                        Tenure Track
                      </p>
                      <p className="font-bold text-foreground">
                        {(() => {
                          const track = teacher.natureOfAppointment;
                          if (!track) return "Regular Permanent";
                          return track
                            .split("_")
                            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(" ");
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold text-[10px]">
                        Designation
                      </p>
                      {teacher.designation?.isClassAdviser ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-black uppercase px-1.5 h-4 border-none whitespace-nowrap mt-0.5",
                            getAcademicDesignationColorClasses("CLASS ADVISER"),
                          )}>
                          Class Adviser
                        </Badge>
                      ) : (
                        <p className="text-foreground font-bold uppercase text-[10px] mt-0.5">
                          Subject Teacher
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold text-[10px]">
                        Advisory
                      </p>
                      <div className="mt-0.5">
                        {renderAdvisoryStatus(teacher)}
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
              ))
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
              noResultsMessage={
                hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found. Click "Add Teacher" to create one.'
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
              itemName="Teachers"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
