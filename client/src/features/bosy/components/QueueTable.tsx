import { useMemo } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Checkbox } from "@/shared/ui/checkbox";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import type {
  ColumnDef,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { BOSYQueueItem } from "../types";
import { formatApplicationStatus, formatEosyStatus } from "@/shared/lib/utils";

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
        className="text-[10px] font-black uppercase bg-orange-50 border-orange-200 text-orange-700">
        Pending
      </Badge>
    );
  if (status === "READY_FOR_SECTIONING")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-black uppercase bg-emerald-50 border-emerald-200 text-emerald-700">
        Confirmed
      </Badge>
    );
  if (status === "ENROLLED" || status === "OFFICIALLY_ENROLLED")
    return (
      <Badge
        variant="outline"
        className="text-[10px] font-black uppercase bg-blue-50 border-blue-200 text-blue-700">
        Enrolled
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-black uppercase">
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
            title="LEARNER"
          />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-base">
              <span className="font-bold uppercase truncate">
                {r.lastName}, {r.firstName}
                {r.middleName ? ` ${r.middleName.charAt(0)}.` : ""}
              </span>
              <span className="text-base text-foreground font-bold">
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
            title="GRADE"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <Badge
              variant="outline"
              className="text-[10px] font-black uppercase">
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
            title="PREVIOUS SECTION / ADVISER"
          />
        ),
        cell: ({ row }) => (
          <div className="text-base">
            <span className="font-bold">
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
            title="PRIOR STATUS"
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
              <span
                className={`text-[10px] font-black uppercase ${
                  s === "PROMOTED" ? "text-emerald-600" : "text-amber-600"
                }`}>
                {formatEosyStatus(s)}
              </span>
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
            title="STATUS"
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
        header: () => (
          <div className="text-center font-bold text-primary-foreground text-base uppercase">
            Action
          </div>
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
                className="h-6 px-2 text-[10px] font-black uppercase text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                disabled={isConfirming}
                onClick={() => onConfirmSingle(r.applicationId)}>
                {isConfirming ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                Confirm
              </Button>
            </div>
          );
        },
        size: 90,
        enableSorting: false,
      });
    }

    if (onRevertSingle) {
      base.push({
        id: "revert",
        header: () => (
          <div className="text-center font-bold text-base uppercase">Flag</div>
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (r.status !== "READY_FOR_SECTIONING") return null;
          return (
            <div className="flex justify-center">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] font-black uppercase text-amber-700 border-amber-200 hover:bg-amber-50"
                onClick={() => onRevertSingle!(r.applicationId)}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Flag
              </Button>
            </div>
          );
        },
        size: 80,
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
