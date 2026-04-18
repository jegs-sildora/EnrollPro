import {
  CloudUpload,
  Edit2,
  FilterX,
  RefreshCw,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
import { useMemo } from "react";
import type {
  Teacher,
  TeacherDesignationFilter,
  TeacherStatusFilter,
  TeacherSyncFilter,
} from "../types";
import {
  formatAdvisorySectionSummary,
  formatDesignationSummary,
  formatTeacherName,
  getSyncDetailClassName,
  getSyncDetailText,
} from "../utils";

interface TeacherDirectoryCardProps {
  loading: boolean;
  showSkeleton: boolean;
  teachers: Teacher[];
  filteredTeachers: Teacher[];
  searchQuery: string;
  statusFilter: TeacherStatusFilter;
  designationFilter: TeacherDesignationFilter;
  syncFilter: TeacherSyncFilter;
  hasActiveFilters: boolean;
  ayId: number | null;
  forceSyncingAll: boolean;
  forceSyncingTeacherId: number | null;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (value: TeacherStatusFilter) => void;
  onDesignationFilterChange: (value: TeacherDesignationFilter) => void;
  onSyncFilterChange: (value: TeacherSyncFilter) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onForceSyncAll: () => void;
  onOpenDesignationEditor: (teacher: Teacher) => void;
  onEditTeacher: (teacher: Teacher) => void;
  onForceSyncTeacher: (teacher: Teacher) => void;
  onDeactivateTeacher: (id: number) => void;
  onReactivateTeacher: (id: number) => void;
}

function renderAtlasSyncBadge(teacher: Teacher) {
  const status = teacher.atlasSync?.status;

  if (!status || status === "SKIPPED") {
    return <Badge variant="outline">Not Synced</Badge>;
  }

  if (status === "SYNCED") {
    return <Badge variant="success">Synced</Badge>;
  }

  if (status === "FAILED") {
    return <Badge variant="danger">Failed</Badge>;
  }

  return <Badge variant="warning">Pending</Badge>;
}

export function TeacherDirectoryCard({
  loading,
  showSkeleton,
  teachers,
  filteredTeachers,
  searchQuery,
  statusFilter,
  designationFilter,
  syncFilter,
  hasActiveFilters,
  ayId,
  forceSyncingAll,
  forceSyncingTeacherId,
  onSearchQueryChange,
  onStatusFilterChange,
  onDesignationFilterChange,
  onSyncFilterChange,
  onClearFilters,
  onRefresh,
  onForceSyncAll,
  onOpenDesignationEditor,
  onEditTeacher,
  onForceSyncTeacher,
  onDeactivateTeacher,
  onReactivateTeacher,
}: TeacherDirectoryCardProps) {
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
        className="h-7 px-2 text-[0.625rem] gap-1"
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
        className="h-7 px-2 text-[0.625rem] gap-1"
        onClick={() => onEditTeacher(teacher)}>
        <Edit2 className="h-3 w-3" />
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[0.625rem] gap-1"
        onClick={() => onForceSyncTeacher(teacher)}
        disabled={
          !ayId || forceSyncingAll || forceSyncingTeacherId === teacher.id
        }>
        <CloudUpload className="h-3 w-3" />
        {forceSyncingTeacherId === teacher.id ? "Syncing" : "Force Sync"}
      </Button>
      {teacher.isActive ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[0.625rem] gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => onDeactivateTeacher(teacher.id)}>
          <UserMinus className="h-3 w-3" />
          Deactivate
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[0.625rem] gap-1 text-emerald-600 hover:bg-emerald-600 hover:text-white"
          onClick={() => onReactivateTeacher(teacher.id)}>
          <UserCheck className="h-3 w-3" />
          Reactivate
        </Button>
      )}
    </div>
  );

  const columns = useMemo<ColumnDef<Teacher>[]>(
    () => [
      {
        id: "teacher",
        header: "TEACHER",
        cell: ({ row }) => (
          <div className="flex flex-col text-left min-w-[200px] pl-2">
            <span className="font-bold text-sm uppercase leading-tight">
              {formatTeacherName(row.original)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.original.email ||
                row.original.contactNumber ||
                "No contact info"}
            </span>
          </div>
        ),
      },
      {
        id: "employeeId",
        header: "EMPLOYEE ID",
        cell: ({ row }) => (
          <span className="text-xs font-semibold block text-center min-w-[100px]">
            {row.original.employeeId || "-"}
          </span>
        ),
      },
      {
        id: "specialization",
        header: "SPECIALIZATION",
        cell: ({ row }) => (
          <span className="text-xs font-semibold block text-center min-w-[140px]">
            {row.original.specialization || "-"}
          </span>
        ),
      },
      {
        id: "status",
        header: "STATUS",
        cell: ({ row }) => (
          <div className="min-w-[100px] flex justify-center">
            {renderTeacherStatus(row.original)}
          </div>
        ),
      },
      {
        id: "designation",
        header: "DESIGNATION",
        cell: ({ row }) => (
          <span className="text-xs font-semibold block text-center min-w-[140px]">
            {formatDesignationSummary(row.original)}
          </span>
        ),
      },
      {
        id: "advisory",
        header: "ADVISORY",
        cell: ({ row }) => (
          <span className="text-xs font-semibold block text-center min-w-[140px]">
            {formatAdvisorySectionSummary(row.original)}
          </span>
        ),
      },
      {
        id: "sync",
        header: "SYNC",
        cell: ({ row }) => (
          <div className="flex flex-col items-center gap-1 min-w-[180px]">
            {renderAtlasSyncBadge(row.original)}
            <p
              className={`max-w-[180px] truncate text-[0.625rem] ${getSyncDetailClassName(row.original)}`}
              title={getSyncDetailText(row.original)}>
              {getSyncDetailText(row.original)}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "ACTIONS",
        cell: ({ row }) => (
          <div className="min-w-[200px] flex justify-center">
            {renderTeacherActions(row.original)}
          </div>
        ),
      },
    ],
    [
      onOpenDesignationEditor,
      onEditTeacher,
      onForceSyncTeacher,
      onDeactivateTeacher,
      onReactivateTeacher,
      ayId,
      forceSyncingAll,
      forceSyncingTeacherId,
    ],
  );

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
                size="sm"
                className="h-9"
                onClick={onForceSyncAll}
                disabled={
                  !ayId || forceSyncingAll || filteredTeachers.length === 0
                }>
                <CloudUpload className="h-4 w-4 mr-2" />
                {forceSyncingAll
                  ? "Syncing..."
                  : hasActiveFilters
                    ? "Force Sync Listed"
                    : "Force Sync All"}
              </Button>
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
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <Input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search name, ID, specialization, section"
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
            <Select
              value={syncFilter}
              onValueChange={(value) =>
                onSyncFilterChange(value as TeacherSyncFilter)
              }>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sync" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sync States</SelectItem>
                <SelectItem value="SYNCED">Synced</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="UNSYNCED">Not Synced</SelectItem>
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
                    <div>
                      <p className="font-bold text-sm uppercase leading-tight">
                        {formatTeacherName(teacher)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {teacher.email || "No email address"}
                      </p>
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
                      <p className="font-semibold">
                        {formatAdvisorySectionSummary(teacher)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div>{renderAtlasSyncBadge(teacher)}</div>
                    <p
                      className={`text-[0.65rem] leading-tight ${getSyncDetailClassName(teacher)}`}
                      title={getSyncDetailText(teacher)}>
                      {getSyncDetailText(teacher)}
                    </p>
                  </div>

                  {renderTeacherActions(teacher, true)}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filteredTeachers}
              loading={showSkeleton}
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
