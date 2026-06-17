import { useState, useEffect, useMemo } from "react";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Button } from "@/shared/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export interface HybridDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: Date;
}

export function HybridDatePicker({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  className,
  minDate,
}: HybridDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const getNumericFormat = (val: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return "";
  };

  const formatDisplayDate = (val: string) => {
    if (!val) return "";
    const parts = val.split("-");
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }).format(date);
      }
    }
    return "";
  };

  useEffect(() => {
    if (!isFocused) {
      setInputText(value ? formatDisplayDate(value) : "");
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value) {
      setInputText(getNumericFormat(value));
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value) {
      setInputText(formatDisplayDate(value));
    } else {
      setInputText("");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let val = input.value;
    const selectionStart = input.selectionStart ?? 0;

    // Handle pure digits paste (e.g., "09112026")
    if (/^\d{5,}$/.test(val) && !val.includes("/")) {
      const d = val.substring(0, 8);
      let formatted = d.substring(0, 2);
      if (d.length > 2) formatted += "/" + d.substring(2, 4);
      if (d.length > 4) formatted += "/" + d.substring(4, 8);
      val = formatted;
    }

    val = val.replace(/[^\d/]/g, "");

    let parts = val.split("/");
    if (parts.length > 3) parts = parts.slice(0, 3);
    
    if (parts[0]) parts[0] = parts[0].substring(0, 2);
    if (parts[1]) parts[1] = parts[1].substring(0, 2);
    if (parts[2]) parts[2] = parts[2].substring(0, 4);

    const isDeleting = (e.nativeEvent as any).inputType === "deleteContentBackward";
    if (!isDeleting) {
      if (parts.length === 1 && parts[0].length === 2) parts.push("");
      else if (parts.length === 2 && parts[1].length === 2) parts.push("");
    }

    const formatted = parts.join("/");
    setInputText(formatted);

    let newCursor = selectionStart;
    if (!isDeleting) {
      if (parts.length === 2 && parts[1] === "" && selectionStart === 2) newCursor = 3;
      if (parts.length === 3 && parts[2] === "" && selectionStart === 5) newCursor = 6;
    }
    
    requestAnimationFrame(() => {
      input.setSelectionRange(newCursor, newCursor);
    });

    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const mm = parts[0];
      const dd = parts[1];
      const yyyy = parts[2];
      const typedDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      const isDateValid = !isNaN(typedDate.getTime());
      let failsMinDate = false;
      if (isDateValid && minDate) {
        // Strip time from minDate for comparison
        const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
        if (typedDate < minDateOnly) {
          failsMinDate = true;
        }
      }
      if (!failsMinDate && isDateValid && Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
        onChange(`${yyyy}-${mm}-${dd}`);
      } else {
        onChange("");
      }
    } else {
      onChange("");
    }
  };

  const handleCalendarSelect = (date?: Date) => {
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const isoDate = `${yyyy}-${mm}-${dd}`;
      onChange(isoDate);
      setOpen(false);
    }
  };

  const selectedDate = useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }, [value]);

  const [month, setMonth] = useState<Date | undefined>(undefined);

  // Sync calendar month with selected date when opening
  useEffect(() => {
    if (open) {
      setMonth(selectedDate);
    }
  }, [open, selectedDate]);

  return (
    <div className="relative w-full flex items-center">
      <Input
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={isFocused ? 10 : 50}
        autoComplete="off"
        className={cn("font-bold text-sm pr-10", className)}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="absolute right-1 top-1/2 -translate-y-1/2 active:-translate-y-1/2 h-7 w-7 p-0 rounded-full hover:bg-muted flex items-center justify-center shrink-0 cursor-pointer text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background" align="end">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            defaultMonth={selectedDate}
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            captionLayout="dropdown"
            startMonth={new Date(1900, 0, 1)}
            endMonth={new Date(2100, 11, 31)}
            disabled={minDate ? (date) => {
              const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
              const minDateOnly = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
              return dateOnly < minDateOnly;
            } : undefined}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

