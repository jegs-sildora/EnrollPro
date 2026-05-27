import { useMemo } from "react";
import { DataTable } from "@/shared/ui/data-table";
import { DataTableColumnHeader } from "@/shared/ui/data-table-column-header";
import { TableSearchIndicator } from "@/shared/ui/TableSearchIndicator";
import { Badge } from "@/shared/ui/badge";
import { Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { JHSCompleter } from "../types";

interface JHSCompleterTableProps {
  items: JHSCompleter[];
  loading: boolean;
  isSearching?: boolean;
}

export function JHSCompleterTable({
  items,
  loading,
  isSearching,
}: JHSCompleterTableProps) {
  const columns = useMemo<ColumnDef<JHSCompleter>[]>(
    () => [
      {
        id: "learner",
        accessorKey: "lastName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="LEARNER" />
        ),
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex flex-col text-left py-0.5 leading-tight text-[11px] sm:text-xs">
              <span className="font-bold uppercase truncate">
                {r.lastName}, {r.firstName}
                {r.middleName ? ` ${r.middleName.charAt(0)}.` : ""}
              </span>
              <span className="text-xs text-foreground font-bold">
                LRN: {r.lrn ?? "NO LRN"}
              </span>
            </div>
          );
        },
      },
      {
        id: "lastGradeLevel",
        accessorKey: "lastGradeLevel",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="LAST GRADE"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <Badge
              variant="outline"
              className="text-[10px] font-black uppercase">
              {row.original.lastGradeLevel ?? "—"}
            </Badge>
          </div>
        ),
        size: 110,
      },
      {
        id: "lastYearEnrolled",
        accessorKey: "lastYearEnrolled",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="SCHOOL YEAR"
            className="justify-center"
          />
        ),
        cell: ({ row }) => (
          <div className="text-center text-xs text-foreground font-bold">
            {row.original.lastYearEnrolled ?? "—"}
          </div>
        ),
        size: 130,
      },
      {
        id: "lastSection",
        accessorKey: "lastSectionName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="LAST SECTION" />
        ),
        cell: ({ row }) => (
          <div className="text-xs font-bold">
            {row.original.lastSectionName ?? (
              <span className="text-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: () => (
          <div className="text-center font-bold text-xs uppercase">Status</div>
        ),
        cell: () => (
          <div className="flex justify-center">
            <Badge
              variant="outline"
              className="text-[10px] font-black uppercase bg-violet-50 border-violet-200 text-violet-700">
              JHS Completer
            </Badge>
          </div>
        ),
        size: 120,
        enableSorting: false,
      },
    ],
    [],
  );

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
      forceEmptyState={Boolean(isSearching)}
      rowSelection={{}}
      onRowSelectionChange={() => {}}
      prependBodyRow={isSearching ? <TableSearchIndicator colSpan={5} /> : null}
    />
  );
}
