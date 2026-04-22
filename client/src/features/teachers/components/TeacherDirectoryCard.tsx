import {
  Edit2,
  FilterX,
  MoreHorizontal,
  RefreshCw,
  UserCheck,
  UserMinus,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { UserPhoto } from "@/shared/components/UserPhoto";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";
import {
  formatAdvisorySectionSummary,
  formatDesignationSummary,
  formatTeacherName,
} from "../utils";

interface TeacherDirectoryCardProps {
  loading: boolean;
  showSkeleton: boolean;
  teachers: Teacher[];
  filteredTeachers: Teacher[];
  searchQuery: string;
  statusFilter: TeacherStatusFilter;
  designationFilter: TeacherDesignationFilter;
  hasActiveFilters: boolean;
  ayId: number | null;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  onDesignationFilterChange: (value: TeacherDesignationFilter) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onOpenDesignationEditor: (teacher: Teacher) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onDeactivateTeacher: (id: number) => void;
  onReactivateTeacher: (id: number) => void;
}

export function TeacherDirectoryCard({
  loading,
  showSkeleton,
  teachers,
  filteredTeachers,
  searchQuery,
  statusFilter,
  designationFilter,
  hasActiveFilters,
  ayId,
  onSearchQueryChange,
  onStatusFilterChange,
  onDesignationFilterChange,
  onClearFilters,
  onRefresh,
  onOpenDesignationEditor,
  onEditTeacher,
  onDeactivateTeacher,
  onReactivateTeacher,
}: TeacherDirectoryCardProps) {
  const renderAdvisoryStatus = (teacher: Teacher) => {
    const advisorySummary = formatAdvisorySectionSummary(teacher);

    if (advisorySummary === "-") {
      return (
        <Badge
          variant="outline"
          className="text-[0.625rem] text-muted-foreground">
          None
        </Badge>
      );
    }

    return (
      <Badge
        variant="success"
        className="max-w-[220px] truncate text-[0.625rem]"
        title={`Assigned to ${advisorySummary}`}>
        Assigned: {advisorySummary}
      </Badge>
    );
  };

  const renderTeacherStatus = (teacher: Teacher) => (
    <div className="flex items-center justify-center gap-1.5">
      <div
        className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${teacher.isActive ? "bg-green-500 ring-green-100" : "bg-slate-400 ring-slate-100"}`}
      />
      <span className="text-[0.6875rem] font-medium">
        {teacher.isActive ? "Active" : "Inactive"}
      </span>
    </div>
  );

  const renderTeacherActions = (teacher: Teacher, compact = false) => (
    <div
      className={`flex flex-wrap items-center ${compact ? "justify-start" : "justify-center"} gap-1.5`}>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[0.625rem] gap-1 whitespace-nowrap"
        onClick={() => onOpenDesignationEditor(teacher)}
        disabled={!ayId}
        title={
          ayId ? "Edit designation" : "Select an active school year first"
        }>
        Designation
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[0.625rem] gap-1 whitespace-nowrap"
        onClick={() => onEditTeacher(teacher)}
        title="Edit profile">
        <Edit2 className="h-3 w-3" />
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="h-7 w-7"
            aria-label={`Open row actions for ${formatTeacherName(teacher)}`}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={compact ? "start" : "end"} className="w-48">
          {teacher.isActive ? (
            <DropdownMenuItem
              onClick={() => onDeactivateTeacher(teacher.id)}
              className="cursor-pointer text-destructive focus:text-destructive">
              <UserMinus className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onReactivateTeacher(teacher.id)}
              className="cursor-pointer text-emerald-700 focus:text-emerald-700">
              <UserCheck className="mr-2 h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const columns: ColumnDef<Teacher>[] = [
    {
      id: "photo",
      header: "",
      size: 50,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <UserPhoto
            photo={row.original.photoPath}
            containerClassName="h-9 w-9 rounded-full border shadow-sm"
            alt={formatTeacherName(row.original)}
          />
        </div>
      ),
    },
    {
      id: "teacher",
      accessorKey: "lastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="TEACHER" />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col text-left max-w-[220px]">
          <span className="font-bold text-sm uppercase leading-tight">
            {formatTeacherName(row.original)}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {row.original.email ||
              row.original.contactNumber ||
              "No contact info"}
          </span>
        </div>
      ),
    },
    {
      id: "employeeId",
      accessorKey: "employeeId",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="EMPLOYEE ID" />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-semibold block text-center">
          {row.original.employeeId || "-"}
        </span>
      ),
    },
    {
      id: "specialization",
      accessorKey: "specialization",
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="LEARNING AREA / DEPARTMENT"
        />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-semibold block text-center break-words">
          {row.original.specialization || "Not set"}
        </span>
      ),
    },
    {
      id: "status",
      accessorKey: "isActive",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="STATUS" />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          {renderTeacherStatus(row.original)}
        </div>
      ),
    },
    {
      id: "designation",
      header: "DESIGNATION",
      cell: ({ row }) => (
        <span className="text-xs font-semibold block text-center break-words">
          {formatDesignationSummary(row.original)}
        </span>
      ),
    },
    {
      id: "advisory",
      header: "ADVISORY",
      cell: ({ row }) => (
        <div className="flex justify-center">
          {renderAdvisoryStatus(row.original)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <div className="w-full flex justify-center">
          {renderTeacherActions(row.original)}
        </div>
      ),
    },
  ];

  return (
    <Card className="w-full min-w-0 overflow-hidden">
      <CardHeader className="pb-3 px-4 md:px-6 border-b bg-muted/10">
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">
              Teacher Directory
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={onRefresh}>
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search name, ID, learning area, section"
              className="h-9 md:col-span-2 xl:col-span-2"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                onStatusFilterChange(value as TeacherStatusFilter)
              }>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={designationFilter}
              onValueChange={(value) =>
                onDesignationFilterChange(value as TeacherDesignationFilter)
              }>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Designations</SelectItem>
                <SelectItem value="adviser">Class Adviser</SelectItem>
                <SelectItem value="tic">TIC</SelectItem>
                <SelectItem value="exempt">Teaching Exempt</SelectItem>
                <SelectItem value="none">No Designation</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="h-9"
              disabled={!hasActiveFilters}
              onClick={onClearFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filteredTeachers.length} of {teachers.length} teachers
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-0 min-w-0">
        <div className="p-4 md:p-6 min-w-0">
          <div className="md:hidden space-y-3">
            {showSkeleton ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border p-3 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))
            ) : filteredTeachers.length === 0 ? (
              <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground italic">
                {hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found. Click "Add Teacher" to create one.'}
              </div>
            ) : (
              filteredTeachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className={`rounded-xl border p-3 space-y-3 ${!teacher.isActive ? "bg-muted/20" : "bg-background"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <UserPhoto
                        photo={teacher.photoPath}
                        containerClassName="h-10 w-10 rounded-full border shadow-sm"
                        alt={formatTeacherName(teacher)}
                      />
                      <div>
                        <p className="font-bold text-sm uppercase leading-tight">
                          {formatTeacherName(teacher)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {teacher.email || "No email address"}
                        </p>
                      </div>
                    </div>
                    {renderTeacherStatus(teacher)}
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide">
                        Employee ID
                      </p>
                      <p className="font-semibold">
                        {teacher.employeeId || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide">
                        Learning Area
                      </p>
                      <p className="font-semibold">
                        {teacher.specialization || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide">
                        Contact
                      </p>
                      <p className="font-semibold">
                        {teacher.contactNumber || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide">
                        Designation
                      </p>
                      <p className="font-semibold">
                        {formatDesignationSummary(teacher)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground uppercase tracking-wide">
                        Advisory
                      </p>
                      {renderAdvisoryStatus(teacher)}
                    </div>
                  </div>

                  {renderTeacherActions(teacher, true)}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block w-full max-w-full overflow-x-hidden">
            <DataTable
              columns={columns}
              data={filteredTeachers}
              tableClassName="table-fixed w-full"
              loading={showSkeleton}
              virtualize={true}
              estimatedRowHeight={60}
              noResultsMessage={
                hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found. Click "Add Teacher" to create one.'
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
