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
      <div className={cn("flex items-center justify-center", className)}>
        {title}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent text-xs font-bold uppercase tracking-wider text-primary-foreground/90 hover:bg-primary/90 hover:text-primary-foreground"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </Button>
    </div>
  );
}
