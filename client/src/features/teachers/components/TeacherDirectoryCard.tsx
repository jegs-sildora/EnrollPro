import { memo } from "react";
import {
  Briefcase,
  Eye,
  FilterX,
  MoreHorizontal,
  RefreshCw,
  Search,
  UserCheck,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import {
  cn,
  getAcademicDesignationColorClasses,
  getAncillaryRoleColorClasses,
  getPlantillaColorClasses,
} from "@/shared/lib/utils";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
} from "../types";
import { formatAdvisorySectionSummary, formatTeacherName } from "../utils";

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
  teachers: Teacher[];
  searchQuery: string;
  statusFilter: TeacherStatusFilter;
  designationFilter: TeacherDesignationFilter;
  subjectFilter: string;
  specializationFilter: string;
  availableSpecializations: string[];
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
  onSpecializationFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onOpenDesignationEditor: (teacher: Teacher) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onDeactivateTeacher: (teacher: Teacher) => void;
  onReactivateTeacher: (id: number) => void;
  onOpenDetail: (teacher: Teacher) => void;
}

export const TeacherDirectoryCard = memo(function TeacherDirectoryCard({
  loading,
  isRefetching,
  showSkeleton,
  teachers,
  filteredTeachers,
  paginatedTeachers,
  searchQuery,
  statusFilter,
  designationFilter,
  specializationFilter,
  availableSpecializations,
  hasActiveFilters,
  ayId,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onSearchQueryChange,
  onStatusFilterChange,
  onDesignationFilterChange,
  onSpecializationFilterChange,
  onClearFilters,
  onRefresh,
  onOpenDesignationEditor,
  onEditTeacher,
  onDeactivateTeacher,
  onReactivateTeacher,
  onOpenDetail,
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
          className="w-56 font-semibold">
          <DropdownMenuItem
            onClick={() => onOpenDesignationEditor(teacher)}
            className="cursor-pointer"
            disabled={!ayId}>
            <Briefcase className="mr-2 h-4 w-4" />
            Update Designation
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onEditTeacher(teacher)}
            className="cursor-pointer">
            <UserRoundPen className="mr-2 h-4 w-4" />
            Quick Update Profile
          </DropdownMenuItem>
          {teacher.isActive ? (
            <DropdownMenuItem
              onClick={() => onDeactivateTeacher(teacher)}
              className="cursor-pointer text-destructive focus:text-destructive">
              <UserCheck className="mr-2 h-4 w-4" />
              Deactivate Faculty
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onReactivateTeacher(teacher.id)}
              className="cursor-pointer text-emerald-700 focus:text-emerald-700">
              <UserCheck className="mr-2 h-4 w-4" />
              Reactivate Faculty
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
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="TEACHER IDENTITY"
          className="justify-center pl-0 font-bold"
        />
      ),
      cell: ({ row }) => {
        const teacher = row.original;
        return (
          <div className="flex flex-col text-left pl-2 py-1">
            <span className="font-extrabold text-sm uppercase leading-tight truncate">
              {formatTeacherName(teacher)}
            </span>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {/* Level 1: Plantilla Badge (Muted blue/indigo) */}
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-1.5 h-4 font-bold border-none",
                  getPlantillaColorClasses(teacher.designationTitle),
                )}>
                {teacher.designationTitle || "UNRANKED"}
              </Badge>
            </div>
          </div>
        );
      },
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
        <div className="flex justify-center">
          {row.original.employeeId ? (
            <span className="text-xs font-bold">{row.original.employeeId}</span>
          ) : (
            <span className="text-slate-400 italic font-medium text-xs">
              N/A
            </span>
          )}
        </div>
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
          {row.original.department ? (
            <span className="text-xs font-bold uppercase text-primary">
              {row.original.department}
            </span>
          ) : (
            <span className="text-slate-400 italic font-medium text-xs">
              Unassigned
            </span>
          )}
          {row.original.specialization ? (
            <span className="text-xs font-bold text-foreground">
              {row.original.specialization}
            </span>
          ) : (
            <span className="text-slate-400 italic font-medium text-[10px]">
              Generalist
            </span>
          )}
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
              <span className="text-slate-400 italic font-medium text-xs">
                N/A
              </span>
            )}
          </TooltipProvider>
        </div>
      ),
    },
    {
      id: "facultyStatus",
      accessorKey: "isActive",
      size: 140,
      minSize: 120,
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="FACULTY STATUS"
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
      size: 180,
      minSize: 160,
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
              <span className="text-slate-500 font-bold uppercase text-[10px] whitespace-nowrap">
                Subject Teacher
              </span>
            </div>
          );
        }

        const ancillaryRoles = designation.ancillaryRoles ?? [];

        return (
          <div className="flex flex-col items-center gap-1.5 py-1">
            {/* Level 2: Academic Designation (Solid DepEd Colors) */}
            {designation.isClassAdviser ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-black uppercase px-2 h-5 border-none whitespace-nowrap",
                  getAcademicDesignationColorClasses("CLASS ADVISER"),
                )}>
                Class Adviser
              </Badge>
            ) : (
              <span className="text-slate-500 font-bold uppercase text-[10px] whitespace-nowrap">
                Subject Teacher
              </span>
            )}

            {/* Level 3: Ancillary Tags (Pastel Domains) */}
            {ancillaryRoles.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 max-w-[170px]">
                {ancillaryRoles.map((role) => (
                  <Badge
                    key={`${row.original.id}-${role}`}
                    variant="outline"
                    className={cn(
                      "text-[9px] font-bold uppercase px-1.5 h-4 border-none",
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
    <Card className="w-full min-w-0 overflow-hidden shadow-xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col max-h-full min-h-0 rounded-xl">
      <CardHeader className="border-b bg-gradient-to-r from-muted/20 via-muted/10 to-transparent py-3 px-4 shrink-0">
        <div className="flex flex-wrap items-center gap-4 pb-3 border-b border-dashed border-border/60 mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
              Total
            </span>
            <span className="text-base font-black text-primary tabular-nums">
              {teachers.length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
              Active
            </span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {teachers.filter((t) => t.isActive).length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-slate-400 ring-2 ring-slate-400/20" />
            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
              Inactive
            </span>
            <span className="text-base font-black text-slate-400 tabular-nums">
              {teachers.filter((t) => !t.isActive).length}
            </span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-indigo-500/20" />
            <span className="text-[11px] font-black uppercase text-muted-foreground tracking-wider">
              Class Advisers
            </span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
              {teachers.filter((t) => t.designation?.isClassAdviser).length}
            </span>
          </div>
          {hasActiveFilters && (
            <>
              <div className="h-4 w-px bg-border/50" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-amber-600 tracking-wider">
                  Showing
                </span>
                <span className="text-base font-black text-amber-600 tabular-nums">
                  {filteredTeachers.length}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search name, ID, learning area, section..."
              className="h-9 pl-9 font-bold text-xs"
            />
          </div>
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
              <SelectItem value="adviser" className="font-bold">Class Adviser</SelectItem>
              <SelectItem value="tic" className="font-bold">TIC</SelectItem>
              <SelectItem value="none" className="font-bold">No Designation</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={specializationFilter}
            onValueChange={onSpecializationFilterChange}>
            <SelectTrigger className="h-9 w-auto min-w-[160px] font-bold uppercase text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all" className="font-bold">All Departments</SelectItem>
              {availableSpecializations.map((spec) => (
                <SelectItem key={spec} value={spec} className="font-bold text-xs uppercase">
                  {spec}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            className="h-9 font-bold uppercase text-xs px-3"
            disabled={!hasActiveFilters}
            onClick={onClearFilters}>
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
      </CardHeader>
      <CardContent className="p-0 min-w-0 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div
          className={cn(
            "min-w-0 transition-opacity duration-200 flex flex-col flex-1 min-h-0",
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
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary text-xs shrink-0 uppercase">
                        {teacher.firstName.charAt(0)}
                        {teacher.lastName.charAt(0)}
                      </div>
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
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Employee ID
                      </p>
                      {teacher.employeeId ? (
                        <p className="font-bold">{teacher.employeeId}</p>
                      ) : (
                        <p className="text-slate-400 italic font-medium">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Learning Area
                      </p>
                      {teacher.specialization ? (
                        <p className="font-bold">{teacher.specialization}</p>
                      ) : (
                        <p className="text-slate-400 italic font-medium">
                          Unassigned
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Contact
                      </p>
                      {teacher.contactNumber ? (
                        <p className="font-bold">{teacher.contactNumber}</p>
                      ) : (
                        <p className="text-slate-400 italic font-medium">N/A</p>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Designation
                      </p>
                      {teacher.designation?.isClassAdviser ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-black uppercase px-1.5 h-4 border-none whitespace-nowrap",
                            getAcademicDesignationColorClasses("CLASS ADVISER"),
                          )}>
                          Class Adviser
                        </Badge>
                      ) : (
                        <p className="text-slate-500 font-bold uppercase text-[10px]">
                          Subject Teacher
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Advisory
                      </p>
                      {renderAdvisoryStatus(teacher)}
                    </div>
                    <div>
                      <p className="text-foreground uppercase font-bold opacity-70">
                        Portal Access
                      </p>
                      {(() => {
                        const ua = teacher.userAccount;
                        let accountLabel = "No Account";
                        let accountColor =
                          "text-muted-foreground bg-muted border-muted-foreground/30";

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
                              "text-[9px] font-black uppercase px-1.5 h-4.5 border gap-1 whitespace-nowrap",
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
              loading={loading}
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
