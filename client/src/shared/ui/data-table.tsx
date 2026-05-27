import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState, OnChangeFn, Row, RowSelectionState } from "@tanstack/react-table";
import React, { useState, useRef, type ReactNode } from "react";
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

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  onRowClick?: (row: TData) => void;
  loading?: boolean;
  className?: string;
  tableClassName?: string;
  noResultsMessage?: string;
  forceEmptyState?: boolean;
  emptyStateContent?: ReactNode;
  prependBodyRow?: ReactNode;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  virtualize?: boolean;
  estimatedRowHeight?: number;
  containerHeight?: string;
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: OnChangeFn<Record<string, boolean>>;
  getRowClassName?: (row: TData) => string;
  renderRowAfter?: (row: TData, index: number) => ReactNode;
  dense?: boolean;
}

const MotionTableBody = motion.create(TableBody);

interface TableRowComponentProps<TData> {
  row: Row<TData>;
  onRowClick?: (data: TData) => void;
  "data-index"?: number;
  style?: React.CSSProperties;
  className?: string;
  getRowClassName?: (row: TData) => string;
  dense?: boolean;
}

function TableRowComponentInner<TData>(
  {
    row,
    onRowClick,
    "data-index": dataIndex,
    style,
    className,
    getRowClassName,
    dense,
  }: TableRowComponentProps<TData>,
  ref: React.ForwardedRef<HTMLTableRowElement>,
) {
  const customClassName = getRowClassName ? getRowClassName(row.original) : "";

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
        row.getIsSelected() ? "bg-muted/80" : "",
        customClassName,
        className,
      )}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={dense ? "py-1.5 px-2" : "p-3"}
          style={{ width: cell.column.getSize() }}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

const TableRowComponent = React.forwardRef(TableRowComponentInner) as <TData>(
  props: TableRowComponentProps<TData> & {
    ref?: React.ForwardedRef<HTMLTableRowElement>;
  },
) => React.ReactElement;

export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  onRowClick,
  loading = false,
  className,
  tableClassName,
  noResultsMessage = "No results.",
  forceEmptyState = false,
  emptyStateContent,
  prependBodyRow,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  virtualize = true,
  estimatedRowHeight = 45,
  containerHeight = "65vh",
  rowSelection: externalRowSelection,
  onRowSelectionChange: externalOnRowSelectionChange,
  getRowClassName,
  renderRowAfter,
  dense = false,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: externalOnSortingChange ?? setInternalSorting,
    onRowSelectionChange:
      externalOnRowSelectionChange ?? setInternalRowSelection,
    state: {
      sorting: externalSorting ?? internalSorting,
      rowSelection: externalRowSelection ?? internalRowSelection,
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
    <div
      className={cn(
        "rounded-md border overflow-hidden max-w-full flex flex-col h-full",
        className,
      )}>
      <div
        ref={containerRef}
        className="overflow-auto relative flex-1 min-h-0 w-full"
        style={virtualize && containerHeight !== "100%" ? { maxHeight: containerHeight } : undefined}>
        <Table className={cn("w-full", tableClassName)}>
          <TableHeader className="bg-[hsl(var(--primary))] border-none">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-none">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "text-center font-bold text-primary-foreground text-xs px-3 sticky top-0 z-20 shadow-sm bg-[hsl(var(--primary))]",
                        dense ? "h-8" : "h-11",
                      )}
                      style={{
                        width: header.column.getSize(),
                        minWidth: header.column.columnDef.minSize,
                        maxWidth: header.column.columnDef.maxSize,
                      }}>
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
          <AnimatePresence
            mode="wait"
            initial={false}>
            {loading ? (
              <MotionTableBody
                key="loading-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative">
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((column, index) => {
                      const meta = column.meta as
                        | {
                            skeletonClassName?: string;
                          }
                        | undefined;
                      return (
                        <TableCell
                          key={index}
                          className={dense ? "py-1.5 px-2" : "p-4"}>
                          <Skeleton
                            className={cn(
                              "h-5 w-full",
                              meta?.skeletonClassName,
                            )}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </MotionTableBody>
            ) : !forceEmptyState && rows.length > 0 ? (
              <MotionTableBody
                key="data-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative">
                {prependBodyRow}
                {virtualize
                  ? [
                      virtualItems.length > 0 && (
                        <TableRow
                          key="virtual-padding-top"
                          style={{ height: `${virtualItems[0].start}px` }}
                          className="hover:bg-transparent border-none">
                          <TableCell
                            colSpan={columns.length}
                            className="p-0"
                          />
                        </TableRow>
                      ),
                      ...virtualItems.map((virtualRow) => (
                        <TableRowComponent
                          key={rows[virtualRow.index].id}
                          ref={rowVirtualizer.measureElement}
                          data-index={virtualRow.index}
                          row={rows[virtualRow.index]}
                          onRowClick={onRowClick}
                          getRowClassName={getRowClassName}
                          dense={dense}
                        />
                      )),
                      virtualItems.length > 0 && (
                        <TableRow
                          key="virtual-padding-bottom"
                          style={{
                            height: `${rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end}px`,
                          }}
                          className="hover:bg-transparent border-none">
                          <TableCell
                            colSpan={columns.length}
                            className="p-0"
                          />
                        </TableRow>
                      ),
                    ]
                  : rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <TableRowComponent
                          row={row}
                          onRowClick={onRowClick}
                          getRowClassName={getRowClassName}
                          dense={dense}
                        />
                        {renderRowAfter?.(row.original, row.index)}
                      </React.Fragment>
                    ))}
              </MotionTableBody>
            ) : prependBodyRow ? (
              <MotionTableBody
                key="prepend-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative">
                {prependBodyRow}
              </MotionTableBody>
            ) : (
              <MotionTableBody
                key="empty-body"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative">
                <TableRow key="no-results">
                  <TableCell
                    colSpan={columns.length}
                    className="p-0">
                    {emptyStateContent ?? (
                      <div className="h-24 flex items-center justify-center text-center font-bold">
                        {noResultsMessage}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              </MotionTableBody>
            )}
          </AnimatePresence>
        </Table>
      </div>
    </div>
  );
}
