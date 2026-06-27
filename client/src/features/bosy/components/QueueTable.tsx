import { useMemo } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Checkbox } from "@/shared/ui/checkbox";
import { CheckCircle2, Loader2 } from "lucide-react";
import type {
  ColumnDef,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { BOSYQueueItem } from "../types";
import { formatApplicationStatus, cn } from "@/shared/lib/utils";

interface QueueTableProps {
  items: BOSYQueueItem[];
  loading: boolean;
  isSearching?: boolean;
  showConfirmAction: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onConfirmSingle: (applicationId: number) => void;
  confirmingIds: Set<number>;
  onRevertSingle?: (applicationId: number) => void;
}

function statusBadge(status: string) {
  if (status === "PENDING_VERIFICATION")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-extrabold uppercase bg-amber-50 border-amber-200 text-amber-700">
        [Pending Review]
      </Badge>
    );
  if (status === "READY_FOR_SECTIONING")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-extrabold uppercase bg-emerald-50 border-emerald-200 text-emerald-700">
        [Confirmed]
      </Badge>
    );
  if (status === "ENROLLED" || status === "OFFICIALLY_ENROLLED")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-extrabold uppercase bg-blue-50 border-blue-200 text-blue-700">
        Enrolled
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-extrabold uppercase">
      {formatApplicationStatus(status)}
    </Badge>
  );
}

export function QueueTable({
  items,
  loading,
  isSearching,
  showConfirmAction,
  rowSelection,
  onRowSelectionChange,
  onConfirmSingle,
  confirmingIds,
  onRevertSingle,
}: QueueTableProps) {
  const columns = useMemo<ColumnDef<BOSYQueueItem>[]>(() => {
    const base: ColumnDef<BOSYQueueItem>[] = [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        id: "learner",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LRN & Learner's Name"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col text-left py-0.5 leading-tight">
              <span className="font-semibold text-base">
                {r.lastName}, {r.firstName}
                {r.middleName ? ` ${r.middleName[0]}.` : ""}
              </span>
              <span className="text-sm text-foreground font-semibold">
                LRN: {r.lrn ?? "NO LRN"}
              </span>
            </div>
          );
        },
      },
      {
        id: "gradeLevel",
        accessorKey: "gradeLevelName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Target Grade"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <Badge
              variant="outline"
              className="text-[10px] font-extrabold uppercase">
              {row.original.gradeLevelName}
            </Badge>
          </div>
        ),
        size: 90,
      },
      {
        id: "priorSection",
        accessorKey: "priorSectionName",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Prior Section (S.Y. 25-26)"
          />
        ),
        cell: ({ row }) => (
          <div className="text-base">
            <span className="font-extrabold">
              {row.original.priorSectionName ?? "—"}
            </span>
            {row.original.priorAdviserName && (
              <span className="block text-foreground text-[10px]">
                {row.original.priorAdviserName}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "academicStatus",
        accessorKey: "academicStatus",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Last Year's Result"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const s = row.original.academicStatus;
          if (!s)
            return (
              <div className="text-center text-foreground text-base">—</div>
            );
          return (
            <div className="text-center">
              <Badge
                variant="outline"
                className={cn("text-[10px] font-extrabold uppercase", s === "PROMOTED" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700")}
              >
                {s === "PROMOTED" ? "[Promoted]" : "[Retained]"}
              </Badge>
            </div>
          );
        },
        size: 110,
      },
      {
        id: "status",
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Intake Status"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            {statusBadge(row.original.status)}
          </div>
        ),
        size: 110,
      },
    ];

    if (showConfirmAction) {
      base.push({
        id: "actions",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Action"
            className="justify-center"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          const isConfirming = confirmingIds.has(r.applicationId);
          if (r.status !== "PENDING_VERIFICATION") return null;
          return (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-sm font-extrabold text-primary border-primary hover:bg-primary/10"
                disabled={isConfirming}
                onClick={() => onConfirmSingle(r.applicationId)}>
                {isConfirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Roll-Over ⚡
              </Button>
            </div>
          );
        },
        size: 90,
        enableSorting: false,
      });
    }



    return base;
  }, [showConfirmAction, onConfirmSingle, confirmingIds, onRevertSingle]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <DataTable
      emptyStateContent={
        <div className="flex flex-col items-center justify-center min-h-[220px] max-h-[260px] gap-1.5 text-foreground">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mb-1">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="font-extrabold text-base text-foreground">No unconfirmed returning learners match your current filter.</p>
          <p className="text-sm">Select a different 'Target Grade' above or verify your search spelling.</p>
        </div>
      }
      columns={columns}
      data={items}
      getRowId={(row) => String(row.applicationId)}
      forceEmptyState={Boolean(isSearching)}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      prependBodyRow={
        isSearching ? (
          <TableSearchIndicator colSpan={showConfirmAction ? 7 : 6} />
        ) : null
      }
    />
  );
}
