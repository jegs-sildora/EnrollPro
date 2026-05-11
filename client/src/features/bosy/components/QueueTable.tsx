import { useMemo } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { Checkbox } from "@/shared/ui/checkbox";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import type { BOSYQueueItem } from "../types";

interface QueueTableProps {
  items: BOSYQueueItem[];
  loading: boolean;
  showConfirmAction: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  onConfirmSingle: (applicationId: number) => void;
  confirmingIds: Set<number>;
}

function statusBadge(status: string) {
  if (status === "PENDING_CONFIRMATION")
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
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-black uppercase">
      {status}
    </Badge>
  );
}

export function QueueTable({
  items,
  loading,
  showConfirmAction,
  rowSelection,
  onRowSelectionChange,
  onConfirmSingle,
  confirmingIds,
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
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-xs">
              <span className="font-bold uppercase truncate">
                {r.lastName}, {r.firstName}
                {r.middleName ? ` ${r.middleName.charAt(0)}.` : ""}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
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
            title="PRIOR SECTION"
          />
        ),
        cell: ({ row }) => (
          <div className="text-xs">
            <span className="font-semibold">
              {row.original.priorSectionName ?? "—"}
            </span>
            {row.original.priorAdviserName && (
              <span className="block text-muted-foreground text-[10px]">
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
              <div className="text-center text-muted-foreground text-xs">—</div>
            );
          return (
            <div className="text-center">
              <span
                className={`text-[10px] font-black uppercase ${
                  s === "PROMOTED" ? "text-emerald-600" : "text-amber-600"
                }`}>
                {s}
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
          <div className="text-center font-bold text-primary-foreground text-xs uppercase">
            Action
          </div>
        ),
        cell: ({ row }) => {
          const r = row.original;
          const isConfirming = confirmingIds.has(r.applicationId);
          if (r.status !== "PENDING_CONFIRMATION") return null;
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

    return base;
  }, [showConfirmAction, onConfirmSingle, confirmingIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
    />
  );
}
