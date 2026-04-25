import { useMemo } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  CheckSquare,
  Loader2,
  Lock,
  Save,
  Square,
} from "lucide-react";
import { StatusBadge } from "@/features/enrollment/components/StatusBadge";
import { UserPhoto } from "@/shared/components/UserPhoto";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import type { ColumnDef } from "@tanstack/react-table";
import type { Application } from "./types";

interface PipelineBatchApplicantsTableProps {
  applications: Application[];
  loading: boolean;
  showAssessment: boolean;
  selectedIds: Set<number>;
  isBatchProcessing: boolean;
  allSelected: boolean;
  scores: Record<number, string>;
  cutoffScore?: number | null;
  savingId: number | null;
  page: number;
  limit: number;
  total: number;
  onToggleSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onScoreChange: (id: number, value: string) => void;
  onSaveResult: (id: number) => void;
  onPageChange: (nextPage: number) => void;
  getRemarkByScore: (appId: number) => string;
  getNotQualifiedReason: (app: Application) => string | null;
}

export default function PipelineBatchApplicantsTable({
  applications,
  loading,
  showAssessment,
  selectedIds,
  isBatchProcessing,
  allSelected,
  scores,
  cutoffScore,
  savingId,
  page,
  limit,
  total,
  onToggleSelectAll,
  onToggleSelect,
  onScoreChange,
  onSaveResult,
  onPageChange,
  getRemarkByScore,
  getNotQualifiedReason,
}: PipelineBatchApplicantsTableProps) {
  const ENROLLMENT_BRIDGE_STATUS = "READY_FOR_ENROLLMENT";
  const hasEnrollmentBridgeRows = applications.some(
    (application) => application.status === ENROLLMENT_BRIDGE_STATUS,
  );
  const selectableRowsCount = applications.filter(
    (application) => application.status !== ENROLLMENT_BRIDGE_STATUS,
  ).length;

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [
      {
        id: "select",
        header: () => (
          <button
            type="button"
            onClick={onToggleSelectAll}
            className="flex items-center justify-center mx-auto"
            disabled={isBatchProcessing || selectableRowsCount === 0}>
            {allSelected ? (
              <CheckSquare className="size-4 text-primary-foreground" />
            ) : selectableRowsCount === 0 ? (
              <Lock className="size-4 text-primary-foreground/70" />
            ) : (
              <Square className="size-4 text-primary-foreground/70" />
            )}
          </button>
        ),
        cell: ({ row }) => {
          const app = row.original;
          const isEnrollmentBridgeRow = app.status === ENROLLMENT_BRIDGE_STATUS;
          return isEnrollmentBridgeRow ? (
            <div className="flex items-center justify-center">
              <Lock
                className="size-3.5 text-muted-foreground"
                aria-label="Moved to enrollment"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={selectedIds.has(app.id)}
                onCheckedChange={() => onToggleSelect(app.id)}
                onClick={(e) => e.stopPropagation()}
                disabled={isBatchProcessing}
              />
            </div>
          );
        },
      },
      {
        id: "applicant",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="APPLICANT"
          />
        ),
        cell: ({ row }) => {
          const app = row.original;
          return (
            <div className="flex items-center gap-3 text-left">
              <UserPhoto
                photo={app.studentPhoto}
                className="w-8 h-8 rounded-full border border-primary/10 shadow-sm"
              />
              <div className="flex flex-col">
                <span className="font-bold text-sm uppercase">
                  {app.lastName}, {app.firstName}{" "}
                  {app.middleName ? `${app.middleName.charAt(0)}.` : ""}
                  {app.suffix ? ` ${app.suffix}` : ""}
                </span>
                <span className="text-sm font-bold">{app.trackingNumber}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "lrn",
        accessorKey: "lrn",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LRN"
          />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm block">
            {row.original.lrn || "—"}
          </span>
        ),
      },
      {
        id: "generalAverage",
        accessorKey: "generalAverage",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="GENERAL AVERAGE"
          />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm block text-center">
            {row.original.generalAverage?.toFixed(2) ?? "—"}
          </span>
        ),
      },
      {
        id: "gradeLevel",
        accessorKey: "gradeLevel.name",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="GRADE LEVEL"
          />
        ),
        cell: ({ row }) => (
          <span className="font-bold text-sm block">
            {row.original.gradeLevel?.name ?? "—"}
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="STATUS"
          />
        ),
        cell: ({ row }) => {
          const app = row.original;
          return (
            <div className="flex flex-col items-center gap-1">
              <StatusBadge
                status={app.status}
                className="text-sm font-bold"
              />
              {app.status === "FAILED_ASSESSMENT" && (
                <p className="max-w-[210px] text-[11px] font-bold text-destructive leading-tight">
                  {getNotQualifiedReason(app)}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "date",
        accessorKey: "createdAt",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="DATE"
          />
        ),
        cell: ({ row }) => (
          <span className="text-sm font-bold block">
            {format(new Date(row.original.createdAt), "MMMM dd, yyyy")}
          </span>
        ),
      },
    ];

    if (showAssessment) {
      cols.push(
        {
          id: "score",
          header: "ASSESSMENT SCORE",
          cell: ({ row }) => {
            const app = row.original;
            return (
              <div className="flex flex-col items-center justify-center gap-1">
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  className="h-8 w-20 text-center text-sm font-bold"
                  value={scores[app.id] ?? ""}
                  onChange={(e) => onScoreChange(app.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs font-bold mt-1">
                  Cut-off score: {cutoffScore ?? "N/A"}
                </span>
              </div>
            );
          },
        },
        {
          id: "remark",
          header: "REMARKS",
          cell: ({ row }) => {
            const remark = getRemarkByScore(row.original.id);
            return (
              <span
                className={`text-xs font-bold block ${
                  remark === "PASSED"
                    ? "text-emerald-700"
                    : remark === "FAILED"
                      ? "text-destructive"
                      : "text-foreground"
                }`}>
                {remark}
              </span>
            );
          },
        },
        {
          id: "actions",
          header: "ACTIONS",
          cell: ({ row }) => {
            const app = row.original;
            return (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-sm font-bold bg-primary/10 hover:bg-primary border-2 border-primary/20 hover:text-primary-foreground"
                disabled={
                  savingId === app.id ||
                  !scores[app.id] ||
                  Number.isNaN(Number(scores[app.id]))
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveResult(app.id);
                }}>
                {savingId === app.id ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Result
              </Button>
            );
          },
        },
      );
    }

    if (hasEnrollmentBridgeRows) {
      cols.push({
        id: "nextStep",
        header: "NEXT STEP",
        cell: ({ row }) => {
          const app = row.original;
          const isEnrollmentBridgeRow = app.status === ENROLLMENT_BRIDGE_STATUS;
          return isEnrollmentBridgeRow ? (
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-8 px-0 text-xs font-bold text-primary">
              <a href="/monitoring/enrollment">
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                View in Enrollment
              </a>
            </Button>
          ) : (
            <span className="text-xs font-bold text-muted-foreground block">
              —
            </span>
          );
        },
      });
    }

    return cols;
  }, [
    applications,
    allSelected,
    selectedIds,
    isBatchProcessing,
    scores,
    savingId,
    cutoffScore,
    selectableRowsCount,
    onToggleSelectAll,
    onToggleSelect,
    onScoreChange,
    onSaveResult,
    getRemarkByScore,
    getNotQualifiedReason,
    showAssessment,
    hasEnrollmentBridgeRows,
  ]);

  return (
    <>
      <DataTable
        columns={columns}
        data={applications}
        loading={loading}
        noResultsMessage="No applicants found."
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 font-bold">
        <span className="text-xs">
          Showing {applications.length} applicants
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 sm:h-8 text-xs font-bold"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}>
            Previous
          </Button>
          <Badge
            variant="secondary"
            className="px-3 h-8 text-xs font-bold">
            Page {page}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-9 sm:h-8 text-xs font-bold"
            onClick={() => onPageChange(page + 1)}
            disabled={page * limit >= total}>
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
