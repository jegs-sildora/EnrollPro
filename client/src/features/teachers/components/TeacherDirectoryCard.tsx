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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
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

          <div className="hidden md:block rounded-xl border overflow-hidden">
            <Table className="border-collapse">
              <TableHeader className="bg-[hsl(var(--primary))]">
                <TableRow>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    TEACHER
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-center font-bold text-primary-foreground text-sm">
                    EMPLOYEE ID
                  </TableHead>
                  <TableHead className="hidden xl:table-cell text-center font-bold text-primary-foreground text-sm">
                    SPECIALIZATION
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    STATUS
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-center font-bold text-primary-foreground text-sm">
                    DESIGNATION
                  </TableHead>
                  <TableHead className="hidden xl:table-cell text-center font-bold text-primary-foreground text-sm">
                    ADVISORY
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-center font-bold text-primary-foreground text-sm">
                    SYNC
                  </TableHead>
                  <TableHead className="text-center font-bold text-primary-foreground text-sm">
                    ACTIONS
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-4 w-16 mx-auto" />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Skeleton className="h-4 w-24 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center">
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-4 w-28 mx-auto" />
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Skeleton className="h-4 w-36 mx-auto" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-6 w-20 mx-auto rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-8 w-40 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredTeachers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-sm text-muted-foreground italic">
                      {hasActiveFilters
                        ? "No teachers match the current filter set."
                        : 'No teachers found. Click "Add Teacher" to create one.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <TableRow
                      key={teacher.id}
                      className={`transition-colors text-center text-sm hover:bg-[hsl(var(--muted))] ${!teacher.isActive ? "bg-muted/20" : ""}`}>
                      <TableCell>
                        <div className="flex flex-col text-left">
                          <span className="font-bold text-sm uppercase leading-tight">
                            {formatTeacherName(teacher)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {teacher.email ||
                              teacher.contactNumber ||
                              "No contact info"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-semibold">
                        {teacher.employeeId || "-"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs font-semibold">
                        {teacher.specialization || "-"}
                      </TableCell>
                      <TableCell>{renderTeacherStatus(teacher)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs font-semibold">
                        {formatDesignationSummary(teacher)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs font-semibold">
                        {formatAdvisorySectionSummary(teacher)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col items-center gap-1">
                          {renderAtlasSyncBadge(teacher)}
                          <p
                            className={`max-w-[180px] truncate text-[0.625rem] ${getSyncDetailClassName(teacher)}`}
                            title={getSyncDetailText(teacher)}>
                            {getSyncDetailText(teacher)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{renderTeacherActions(teacher)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
