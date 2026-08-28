import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <div className={cn("flex items-center justify-center text-sm tracking-wide font-bold uppercase text-foreground w-full", className)}>
        {title}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center space-x-2 w-full", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 data-[state=open]:bg-accent text-sm tracking-wide font-bold uppercase text-foreground dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground dark:hover:text-slate-100 transition-colors"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4 shrink-0" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4 shrink-0" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
        )}
      </Button>
    </div>
  );
}
