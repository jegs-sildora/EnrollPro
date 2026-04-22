import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState, OnChangeFn, Row } from "@tanstack/react-table";
import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  loading?: boolean;
  className?: string;
  tableClassName?: string;
  noResultsMessage?: string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  virtualize?: boolean;
  estimatedRowHeight?: number;
  containerHeight?: string;
}

const MotionTableRow = motion.create(TableRow);

const MemoizedTableRow = React.memo(
  React.forwardRef<
    HTMLTableRowElement,
    {
      row: Row<any>;
      onRowClick?: (row: any) => void;
      "data-index"?: number;
      style?: React.CSSProperties;
      className?: string;
    }
  >(({ row, onRowClick, "data-index": dataIndex, style, className }, ref) => {
    return (
      <TableRow
        ref={ref}
        data-index={dataIndex}
        style={style}
        data-state={row.getIsSelected() && "selected"}
        onClick={() => onRowClick?.(row.original)}
        className={cn(
          "text-center text-xs hover:bg-muted/50 transition-colors",
          onRowClick ? "cursor-pointer" : "",
          className
        )}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className="p-3">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  }),
  (prev, next) => {
    return (
      prev.row.getIsSelected() === next.row.getIsSelected() &&
      prev.row.original === next.row.original
    );
  }
);
MemoizedTableRow.displayName = "MemoizedTableRow";

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  loading = false,
  className,
  tableClassName,
  noResultsMessage = "No results.",
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  virtualize = false,
  estimatedRowHeight = 45,
  containerHeight = "60vh",
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: externalOnSortingChange ?? setInternalSorting,
    state: {
      sorting: externalSorting ?? internalSorting,
    },
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className={cn("rounded-md border overflow-hidden", className)}>
      <div 
        ref={containerRef} 
        className="overflow-auto relative" 
        style={virtualize ? { maxHeight: containerHeight } : undefined}
      >
        <Table className={tableClassName}>
          <TableHeader className="bg-[hsl(var(--primary))] sticky top-0 z-20 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="text-center font-bold text-primary-foreground text-xs h-11 px-3">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            <AnimatePresence mode="popLayout" initial={false}>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <MotionTableRow
                    key={`skeleton-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}>
                    <TableCell colSpan={columns.length} className="p-4">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </MotionTableRow>
                ))
              ) : rows.length > 0 ? (
                virtualize ? (
                  <>
                    {virtualItems.length > 0 && (
                      <TableRow 
                        style={{ height: `${virtualItems[0].start}px` }} 
                        className="hover:bg-transparent border-none"
                      >
                        <TableCell colSpan={columns.length} className="p-0" />
                      </TableRow>
                    )}
                    {virtualItems.map((virtualRow) => (
                      <MemoizedTableRow
                        key={rows[virtualRow.index].id}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        row={rows[virtualRow.index]}
                        onRowClick={onRowClick}
                      />
                    ))}
                    {virtualItems.length > 0 && (
                      <TableRow 
                        style={{ 
                          height: `${rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1].end)}px` 
                        }} 
                        className="hover:bg-transparent border-none"
                      >
                        <TableCell colSpan={columns.length} className="p-0" />
                      </TableRow>
                    )}
                  </>
                ) : (
                  rows.map((row) => (
                    <MemoizedTableRow
                      key={row.id}
                      row={row}
                      onRowClick={onRowClick}
                    />
                  ))
                )
              ) : (
                <MotionTableRow
                  key="no-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center font-bold">
                    {noResultsMessage}
                  </TableCell>
                </MotionTableRow>
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
