import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

interface DatePickerProps {
  date?: Date;
  setDate: (date?: Date) => void;
  placeholder?: string;
  className?: string;
  timeZone?: string;
  /** Dates before this are disabled and calendar navigation is restricted to start here */
  minDate?: Date;
  /** Dates after this are disabled and calendar navigation is restricted to end here */
  maxDate?: Date;
  showYearSelect?: boolean;
}

function formatPickerDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  timeZone = "Asia/Manila",
  minDate,
  maxDate,
  showYearSelect = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Clean and copy dates to avoid reference issues
  const safeDate = React.useMemo(
    () => (date ? new Date(date) : undefined),
    [date],
  );
  const safeMinDate = React.useMemo(
    () => (minDate ? new Date(minDate) : undefined),
    [minDate],
  );
  const safeMaxDate = React.useMemo(
    () => (maxDate ? new Date(maxDate) : undefined),
    [maxDate],
  );

  const [month, setMonth] = React.useState<Date | undefined>(
    safeDate ?? safeMinDate,
  );

  // Sync month whenever it opens or the date prop changes
  React.useEffect(() => {
    if (open) {
      setMonth(safeDate ?? safeMinDate);
    }
  }, [open, safeDate, safeMinDate]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setMonth(safeDate ?? safeMinDate);
    }
  };

  // Build disabled matchers: block dates outside [minDate, maxDate]
  const disabled = React.useMemo(() => {
    const matchers: ({ before: Date } | { after: Date })[] = [];
    if (safeMinDate) matchers.push({ before: safeMinDate });
    if (safeMaxDate) matchers.push({ after: safeMaxDate });
    return matchers.length > 0 ? matchers : undefined;
  }, [safeMinDate, safeMaxDate]);

  // Default ranges to prevent react-day-picker from clamping dropdowns to the current year
  // 20 years in both directions is usually enough for most EdTech schedules,
  // but we'll use a wider window for safety.
  const defaultStartMonth = React.useMemo(() => new Date(1900, 0, 1), []);
  const defaultEndMonth = React.useMemo(() => new Date(2100, 11, 31), []);

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !safeDate && "text-foreground",
            className,
          )}>
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {safeDate ? (
            formatPickerDate(safeDate, timeZone)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-white"
        align="center">
        <Calendar
          // Use a key that forces re-mount when opening or when the date changes externally.
          // This ensures the calendar internal navigation resets to the current date's month.
          key={
            open
              ? `calendar-open-${safeDate?.getTime() ?? "none"}`
              : "calendar-closed"
          }
          mode="single"
          required
          selected={safeDate}
          onSelect={(d) => {
            if (d) {
              setDate(new Date(d));
              setOpen(false);
            }
          }}
          // Control the displayed month
          month={month}
          onMonthChange={setMonth}
          // Restrict navigation to only the allowed year range
          // CRITICAL: Without startMonth/endMonth, react-day-picker clamps the year dropdown to currentYear
          startMonth={safeMinDate ?? defaultStartMonth}
          endMonth={safeMaxDate ?? defaultEndMonth}
          // Visually disable out-of-range dates
          disabled={disabled}
          // Always use dropdown for Month (as requested)
          captionLayout="dropdown"
          showYearSelect={showYearSelect}
          hideNavigation
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
