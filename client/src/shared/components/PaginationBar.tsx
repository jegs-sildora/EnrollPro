import React from "react";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface PaginationBarProps {
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  itemName?: string;
  className?: string;
}

export function PaginationBar({
  page,
  total,
  limit,
  onPageChange,
  onLimitChange,
  itemName = "Learners",
  className,
}: PaginationBarProps) {
  const totalPages = Math.ceil(total / limit) || 1;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  // Generate page numbers to show (max 5 visible pages)
  const getVisiblePages = () => {
    const pages = [];
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, page + 2);

    if (startPage === 1) {
      endPage = Math.min(totalPages, 5);
    }
    if (endPage === totalPages) {
      startPage = Math.max(1, totalPages - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row items-center justify-between gap-4 py-3 px-4 bg-background border-t border-border shrink-0 w-full z-30 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]",
        className,
      )}>
      {/* Zone A & B: Contextual Metrics & Density Control */}
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-sm font-bold text-muted-foreground w-full md:w-auto justify-center md:justify-start">
        <span className="whitespace-nowrap">
          Showing {start} to {end} of {total} {itemName}
        </span>
        <div className="hidden sm:block h-4 w-px bg-border shrink-0" />
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>Rows per page:</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => {
              onLimitChange(Number(val));
            }}>
            <SelectTrigger className="h-8 w-16 text-xs font-black border-2 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="1000000">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Zone C: Navigation Controls */}
      <div className="flex items-center gap-1 w-full md:w-auto justify-center md:justify-end overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 border-2"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          title="First Page">
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground mr-2 shrink-0 border-2"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          title="Previous Page">
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {visiblePages[0] > 1 && (
          <span className="text-muted-foreground px-1 font-black">...</span>
        )}

        {visiblePages.map((p) => (
          <Button
            key={p}
            variant={page === p ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-8 w-8 text-sm font-black transition-all shrink-0 border-2 border-transparent",
              page === p
                ? "bg-primary text-primary-foreground shadow-md border-primary/20 hover:bg-primary"
                : "text-muted-foreground hover:bg-muted hover:border-border",
            )}
            onClick={() => onPageChange(p)}>
            {p}
          </Button>
        ))}

        {visiblePages[visiblePages.length - 1] < totalPages && (
          <span className="text-muted-foreground px-1 font-black">...</span>
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground ml-2 shrink-0 border-2"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages || totalPages === 0}
          title="Next Page">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 border-2"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages || totalPages === 0}
          title="Last Page">
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
