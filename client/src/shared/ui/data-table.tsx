import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import type { ColumnDef } from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table"
import { Skeleton } from "@/shared/ui/skeleton"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onRowClick?: (row: TData) => void
  loading?: boolean
  className?: string
  tableClassName?: string
  noResultsMessage?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  loading = false,
  className,
  tableClassName,
  noResultsMessage = "No results.",
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className={`rounded-md border overflow-hidden ${className}`}>
      <Table className={tableClassName}>
        <TableHeader className="bg-[hsl(var(--primary))]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead 
                    key={header.id} 
                    className="text-center font-bold text-primary-foreground text-sm h-11 px-3"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
               <TableRow key={`skeleton-${i}`}>
                 <TableCell colSpan={columns.length} className="p-4">
                   <Skeleton className="h-6 w-full" />
                 </TableCell>
               </TableRow>
             ))
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={() => onRowClick?.(row.original)}
                className={`text-center text-sm hover:bg-muted/50 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="p-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center font-bold">
                {noResultsMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

