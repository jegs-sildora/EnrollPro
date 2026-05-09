import { memo } from "react";
import {
  Edit2,
  FilterX,
  MoreHorizontal,
  RefreshCw,
  UserCheck,
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
import { PaginationBar } from "@/shared/components/PaginationBar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/utils";
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

const SUBJECT_ACRONYMS: Record<string, string> = {
  MATHEMATICS: "MATH",
  SCIENCE: "SCI",
  ENGLISH: "ENG",
  FILIPINO: "FIL",
  "ARALING PANLIPUNAN": "AP",
  "VALUES EDUCATION": "ESP",
  "EDUKASYON SA PAGPAPAKATAO": "ESP",
  "EDUKASYON SA PAGPAPAKATAO (ESP)": "ESP",
  ESP: "ESP",
  MAPEH: "MAPEH",
  TLE: "TLE",
  "HOME ECONOMICS": "HE",
  "INDUSTRIAL ARTS": "IA",
  "AGRI_FISHERY ARTS": "AFA",
  "INFORMATION AND COMMUNICATIONS TECHNOLOGY": "ICT",
  "INFORMATION AND COMMUNICATIONS TECHNOLOGY (ICT)": "ICT",
  ICT: "ICT",
};

interface TeacherDirectoryCardProps {
  loading: boolean;
  isRefetching: boolean;
  showSkeleton: boolean;
  filteredTeachers: Teacher[];
  paginatedTeachers: Teacher[];
  searchQuery: string;
  statusFilter: TeacherStatusFilter;
  designationFilter: TeacherDesignationFilter;
  subjectFilter: string;
  hasActiveFilters: boolean;
  ayId: number | null;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  onDesignationFilterChange: (value: TeacherDesignationFilter) => void;
  onSubjectFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onOpenDesignationEditor: (teacher: Teacher) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onDeactivateTeacher: (teacher: Teacher) => void;
  onReactivateTeacher: (id: number) => void;
}

export const TeacherDirectoryCard = memo(function TeacherDirectoryCard({
  loading,
  isRefetching,
  showSkeleton,
  filteredTeachers,
  paginatedTeachers,
  searchQuery,
  statusFilter,
  designationFilter,
  hasActiveFilters,
  ayId,
  page,
  limit,
  onPageChange,
  onLimitChange,
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

  const renderTeacherStatus = (teacher: Teacher) => (
    <div className="flex items-center justify-center gap-1.5">
      <div
        className={`h-2 w-2 rounded-full ring-2 ring-offset-1 ${teacher.isActive ? "bg-green-500 ring-green-100" : "bg-slate-400 ring-slate-100"}`}
      />
      <span className="text-[0.6875rem] font-bold">
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
        className="h-7 px-2 text-xs gap-1 whitespace-nowrap font-bold"
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
        className="h-7 px-2 text-xs gap-1 whitespace-nowrap font-bold"
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
        <DropdownMenuContent
          align={compact ? "start" : "end"}
          className="w-18">
          {teacher.isActive ? (
            <DropdownMenuItem
              onClick={() => onDeactivateTeacher(teacher)}
              className="cursor-pointer text-primary focus:text-primary-foreground font-bold hover:text-foreground">
              Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onReactivateTeacher(teacher.id)}
              className="cursor-pointer text-emerald-700 focus:text-emerald-700 font-bold">
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
      size: 60,
      minSize: 60,
      maxSize: 60,
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
      size: 250,
      minSize: 200,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="TEACHER"
          className="justify-center pl-0 font-bold"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col text-left">
          <span className="font-bold text-sm uppercase leading-tight">
            {formatTeacherName(row.original)}
          </span>
          <span className="text-xs text-foreground truncate font-bold">
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
      size: 130,
      minSize: 120,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="EMPLOYEE ID"
          className="font-bold"
        />
      ),
      cell: ({ row }) => (
        <span className="text-xs font-bold block text-center">
          {row.original.employeeId || "-"}
        </span>
      ),
    },
    {
      id: "department",
      accessorKey: "department",
      size: 200,
      minSize: 180,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="DEPT / SPECIALIZATION"
          className="font-bold"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col items-center text-center">
          <span className="text-xs font-bold uppercase text-primary">
            {row.original.department || "-"}
          </span>
          <span className="text-xs font-bold text-foreground">
            {row.original.specialization || "Generalist"}
          </span>
        </div>
      ),
    },
    {
      id: "subjects",
      size: 240,
      minSize: 220,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="QUALIFIED SUBJECTS"
          className="font-bold"
        />
      ),
      cell: ({ row }) => (
        <div className="flex flex-wrap justify-center gap-1">
          <TooltipProvider delayDuration={300}>
            {row.original.subjects.length > 0 ? (
              row.original.subjects.map((sub) => (
                <Tooltip key={sub}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="cursor-help text-[9px] px-1 py-0 h-4 bg-muted/50 font-bold uppercase transition-colors hover:bg-muted hover:text-primary">
                      {SUBJECT_ACRONYMS[sub.toUpperCase()] || sub.toUpperCase()}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="text-xs font-bold uppercase">
                    {sub}
                  </TooltipContent>
                </Tooltip>
              ))
            ) : (
              <span className="text-xs text-foreground font-medium">-</span>
            )}
          </TooltipProvider>
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "isActive",
      size: 120,
      minSize: 100,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="STATUS"
          className="font-bold"
        />
      ),
      cell: ({ row }) => (
        <div className="flex justify-center">
          {renderTeacherStatus(row.original)}
        </div>
      ),
    },
    {
      id: "designation",
      size: 160,
      minSize: 140,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="DESIGNATION"
          className="font-bold"
        />
      ),
      cell: ({ row }) => {
        const designation = row.original.designation;

        if (!designation) {
          return (
            <Badge
              variant="outline"
              className="text-xs font-bold uppercase">
              None
            </Badge>
          );
        }

        const ancillaryRoles = designation.ancillaryRoles ?? [];
        const hasDesignation =
          designation.isClassAdviser || ancillaryRoles.length > 0;

        if (!hasDesignation) {
          return (
            <Badge
              variant="outline"
              className="text-xs font-bold uppercase">
              None
            </Badge>
          );
        }

        return (
          <div className="flex flex-wrap justify-center gap-1">
            {designation.isClassAdviser ? (
              <Badge
                variant="success"
                className="text-xs font-black uppercase">
                Class Adviser
              </Badge>
            ) : null}
            {ancillaryRoles.map((role) => (
              <Badge
                key={`${row.original.id}-${role}`}
                variant="outline"
                className="text-xs font-bold uppercase">
                {role}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "actions",
      size: 200,
      minSize: 180,
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
    <Card className="w-full min-w-0 overflow-hidden shadow-sm border-2">
      <CardHeader className="border-b bg-muted/10">
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold uppercase">
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
              className="h-9 md:col-span-2 xl:col-span-2 font-bold"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                onStatusFilterChange(value as TeacherStatusFilter)
              }>
              <SelectTrigger className="h-9 font-bold uppercase text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="all"
                  className="font-bold">
                  All Statuses
                </SelectItem>
                <SelectItem
                  value="active"
                  className="font-bold">
                  Active Only
                </SelectItem>
                <SelectItem
                  value="inactive"
                  className="font-bold">
                  Inactive Only
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={designationFilter}
              onValueChange={(value) =>
                onDesignationFilterChange(value as TeacherDesignationFilter)
              }>
              <SelectTrigger className="h-9 font-bold uppercase text-xs">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="all"
                  className="font-bold">
                  All Designations
                </SelectItem>
                <SelectItem
                  value="adviser"
                  className="font-bold">
                  Class Adviser
                </SelectItem>
                <SelectItem
                  value="tic"
                  className="font-bold">
                  TIC
                </SelectItem>
                <SelectItem
                  value="none"
                  className="font-bold">
                  No Designation
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              className="h-9 font-bold uppercase text-xs"
              disabled={!hasActiveFilters}
              onClick={onClearFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 min-w-0">
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200",
            isRefetching ? "opacity-50 pointer-events-none" : "opacity-100",
          )}>
          <div className="md:hidden space-y-3">
            {showSkeleton ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border-2 p-3 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full" />
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
                      <UserPhoto
                        photo={teacher.photoPath}
                        containerClassName="h-10 w-10 rounded-full border-2 shadow-sm"
                        alt={formatTeacherName(teacher)}
                      />
                      <div>
                        <p className="font-black text-sm uppercase leading-tight">
                          {formatTeacherName(teacher)}
                        </p>
                        <p className="text-xs text-foreground mt-0.5 font-medium">
                          {teacher.email || "No email address"}
                        </p>
                      </div>
                    </div>
                    {renderTeacherStatus(teacher)}
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div>
                      <p className="text-foreground uppercase tracking-wide font-bold opacity-70">
                        Employee ID
                      </p>
                      <p className="font-bold">{teacher.employeeId || "-"}</p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase tracking-wide font-bold opacity-70">
                        Learning Area
                      </p>
                      <p className="font-bold">
                        {teacher.specialization || "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase tracking-wide font-bold opacity-70">
                        Contact
                      </p>
                      <p className="font-bold">
                        {teacher.contactNumber || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase tracking-wide font-bold opacity-70">
                        Designation
                      </p>
                      <p className="font-bold uppercase">
                        {formatDesignationSummary(teacher)}
                      </p>
                    </div>
                    <div>
                      <p className="text-foreground uppercase tracking-wide font-bold opacity-70">
                        Advisory
                      </p>
                      {renderAdvisoryStatus(teacher)}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    {renderTeacherActions(teacher, true)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block flex-1 overflow-auto bg-muted/5 relative">
            <DataTable<Teacher, unknown>
              columns={columns}
              data={paginatedTeachers}
              tableClassName="min-w-full"
              loading={loading}
              virtualize={true}
              estimatedRowHeight={60}
              className="border-none rounded-none h-full"
              containerHeight="100%"
              noResultsMessage={
                hasActiveFilters
                  ? "No teachers match the current filter set."
                  : 'No teachers found. Click "Add Teacher" to create one.'
              }
            />
          </div>

          <PaginationBar
            page={page}
            total={filteredTeachers.length}
            limit={limit}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
            itemName="Teachers"
          />
        </div>
      </CardContent>
    </Card>
  );
});
