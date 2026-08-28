import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";

interface DualPaneDateRangePickerProps {
  startValue?: string; // YYYY-MM-DD
  endValue?: string;   // YYYY-MM-DD
  onApply: (start: string, end: string) => void;
  placeholder?: string;
  className?: string;
  customTrigger?: React.ReactNode;
  popoverAlign?: "center" | "end" | "start";
}

export function DualPaneDateRangePicker({
  startValue,
  endValue,
  onApply,
  placeholder = "Select academic term duration",
  className,
  customTrigger,
  popoverAlign = "start",
}: DualPaneDateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    return {
      from: startValue ? new Date(startValue) : undefined,
      to: endValue ? new Date(endValue) : undefined,
    };
  });

  const [leftMonth, setLeftMonth] = React.useState<Date>(() => {
    return startValue ? new Date(startValue) : new Date();
  });

  const [rightMonth, setRightMonth] = React.useState<Date>(() => {
    const start = startValue ? new Date(startValue) : new Date();
    if (endValue) {
      const end = new Date(endValue);
      if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        const next = new Date(start);
        next.setMonth(next.getMonth() + 1);
        return next;
      }
      return end;
    }
    const next = new Date(start);
    next.setMonth(next.getMonth() + 1);
    return next;
  });

  // Sync internal state when props change
  React.useEffect(() => {
    if (open) {
      setRange({
        from: startValue ? new Date(startValue) : undefined,
        to: endValue ? new Date(endValue) : undefined,
      });

      const newLeft = startValue ? new Date(startValue) : new Date();
      setLeftMonth(newLeft);

      if (endValue) {
        const newRight = new Date(endValue);
        if (newLeft.getFullYear() === newRight.getFullYear() && newLeft.getMonth() === newRight.getMonth()) {
          const next = new Date(newLeft);
          next.setMonth(next.getMonth() + 1);
          setRightMonth(next);
        } else {
          setRightMonth(newRight);
        }
      } else {
        const next = new Date(newLeft);
        next.setMonth(next.getMonth() + 1);
        setRightMonth(next);
      }
    }
  }, [open, startValue, endValue]);

  // Lock panes to start and end dates
  React.useEffect(() => {
    if (range?.from) {
      setLeftMonth(range.from);
    }
    if (range?.to) {
      if (range.from && range.from.getFullYear() === range.to.getFullYear() && range.from.getMonth() === range.to.getMonth()) {
        const next = new Date(range.from);
        next.setMonth(next.getMonth() + 1);
        setRightMonth(next);
      } else {
        setRightMonth(range.to);
      }
    }
  }, [range?.from, range?.to]);

  const handleApply = () => {
    if (range?.from && range?.to) {
      const formatString = "yyyy-MM-dd";
      onApply(format(range.from, formatString), format(range.to, formatString));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {customTrigger ? (
          <div className="cursor-pointer w-full flex-1">
            {customTrigger}
          </div>
        ) : (
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full sm:w-[300px] justify-between font-bold shadow-sm bg-background hover:bg-muted transition-all text-foreground px-3 py-5 rounded-md",
              !range?.from && "text-muted-foreground",
              className
            )}
          >
            <div className="flex-1 flex items-center justify-center">
              {range?.from ? (
                range.to ? (
                  <>
                    <span className="text-foreground">{format(range.from, "MMM d, yyyy")}</span>
                    <span className="mx-3 text-muted-foreground font-normal">&rarr;</span>
                    <span className="text-primary">{format(range.to, "MMM d, yyyy")}</span>
                  </>
                ) : (
                  <span className="text-foreground">{format(range.from, "MMM d, yyyy")}</span>
                )
              ) : (
                <span>{placeholder}</span>
              )}
            </div>
            <div className="pl-3 py-1 border-l border-border ml-2 flex items-center justify-center h-full">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-background rounded-lg shadow-lg" align={popoverAlign}>
        <div
          className={cn(
            "p-3",
            "[&_[data-range-start=true]]:!bg-primary [&_[data-range-start=true]]:!text-primary-foreground [&_[data-range-start=true]]:!rounded-full",
            "[&_[data-range-end=true]]:!bg-primary [&_[data-range-end=true]]:!text-primary-foreground [&_[data-range-end=true]]:!rounded-full",
            "[&_[data-range-middle=true]]:!bg-transparent [&_[data-range-middle=true]]:hover:!bg-transparent [&_[data-range-middle=true]]:!text-foreground",
            "[&_button:hover:not([data-selected=true])]:!text-primary [&_button:hover:not([data-selected=true])]:!bg-muted"
          )}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <Calendar
              mode="range"
              month={leftMonth}
              onMonthChange={setLeftMonth}
              selected={range}
              onSelect={setRange}
              classNames={{
                range_start: "relative isolate z-0 bg-transparent after:absolute after:inset-y-0 after:right-0 after:w-1/2 after:bg-primary/10",
                range_end: "relative isolate z-0 bg-transparent after:absolute after:inset-y-0 after:left-0 after:w-1/2 after:bg-primary/10",
                range_middle: "rounded-none bg-primary/10",
              }}
            />
            <Calendar
              mode="range"
              month={rightMonth}
              onMonthChange={setRightMonth}
              selected={range}
              onSelect={setRange}
              classNames={{
                range_start: "relative isolate z-0 bg-transparent after:absolute after:inset-y-0 after:right-0 after:w-1/2 after:bg-primary/10",
                range_end: "relative isolate z-0 bg-transparent after:absolute after:inset-y-0 after:left-0 after:w-1/2 after:bg-primary/10",
                range_middle: "rounded-none bg-primary/10",
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-3 border-t">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              setRange({
                from: startValue ? new Date(startValue) : undefined,
                to: endValue ? new Date(endValue) : undefined,
              });
            }}
            className="font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!range?.from || !range?.to}
            className="font-bold"
          >
            Apply Range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
