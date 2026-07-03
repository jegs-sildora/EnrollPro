import { useMemo } from "react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Checkbox } from "@/shared/ui/checkbox";
import { ArrowRightLeft, CheckCircle2, Loader2 } from "lucide-react";
import type {
  ColumnDef,
  RowSelectionState,
  OnChangeFn,
} from "@tanstack/react-table";
import type { BOSYQueueItem } from "../types";
import { formatApplicationStatus, cn } from "@/shared/lib/utils";

interface QueueTableProps {
  priorSyLabel: string;
  items: BOSYQueueItem[];
  loading: boolean;
  isSearching?: boolean;
  showConfirmAction: boolean;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  onConfirmSingle: (applicationId: number) => void;
  onTransferRequest: (learner: BOSYQueueItem) => void;
  confirmingIds: Set<number>;
}

function statusBadge(item: BOSYQueueItem) {
  if (item.status === "PENDING_CONFIRMATION")
    return (
      <Badge
        className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border-transparent hover:bg-amber-200">
        Pending
      </Badge>
    );
  if (item.status === "READY_FOR_SECTIONING" && item.isTemporarilyEnrolled)
    return (
      <div className="flex max-w-64 flex-col items-center gap-1.5 text-center">
        <Badge
          className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-50">
          Temporarily Enrolled
        </Badge>
        {item.missingDocuments.length > 0 && (
          <span className="text-xs font-semibold leading-tight text-amber-800">
            Missing: {item.missingDocuments.join(", ")}
          </span>
        )}
      </div>
    );
  if (item.status === "READY_FOR_SECTIONING")
    return (
      <Badge
        className="text-[10px] font-extrabold uppercase bg-blue-600 text-white border-transparent hover:bg-blue-700">
        Ready for Section Assignment
      </Badge>
    );
  if (item.status === "ENROLLED" || item.status === "OFFICIALLY_ENROLLED")
    return (
      <Badge
        className="text-[10px] font-extrabold uppercase bg-emerald-600 text-white border-transparent hover:bg-emerald-700">
        Enrolled
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="text-[10px] font-extrabold uppercase">
      {formatApplicationStatus(item.status)}
    </Badge>
  );
}

export function QueueTable({
  priorSyLabel,
  items,
  loading,
  isSearching,
  showConfirmAction,
  rowSelection,
  onRowSelectionChange,
  onConfirmSingle,
  onTransferRequest,
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
            title={`Prior Section (S.Y. ${priorSyLabel})`}
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
                className={cn(
                  "text-[10px] font-extrabold uppercase text-white border-transparent",
                  s === "PROMOTED"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : s === "CONDITIONALLY_PROMOTED"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700",
                )}
              >
                {s === "PROMOTED"
                  ? "Promoted"
                  : s === "CONDITIONALLY_PROMOTED"
                    ? "Conditionally Promoted"
                    : "Retained"}
              </Badge>
              {row.original.isRemedialRequired && (
                <span className="mt-1 block text-xs font-semibold leading-tight text-amber-800">
                  Academic deficiency for follow-up
                </span>
              )}
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
            {statusBadge(row.original)}
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
          if (r.status !== "PENDING_CONFIRMATION") return null;
          return (
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-sm font-extrabold text-primary border-primary hover:bg-primary/10"
                disabled={isConfirming}
                onClick={() => onConfirmSingle(r.applicationId)}>
                {isConfirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Return
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-sm font-extrabold"
                disabled={isConfirming}
                onClick={() => onTransferRequest(r)}
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer Request
              </Button>
            </div>
          );
        },
        size: 90,
        enableSorting: false,
      });
    }



    return base;
  }, [
    showConfirmAction,
    onConfirmSingle,
    onTransferRequest,
    confirmingIds,
    priorSyLabel,
  ]);

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
          <p className="text-base font-extrabold text-foreground">
            No continuing learners match this intake status.
          </p>
          <p className="text-sm">
            Select another target grade or check the learner name or LRN.
          </p>
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
