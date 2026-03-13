import * as React from "react"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  setDate: (date?: Date) => void
  placeholder?: string
  className?: string
  timeZone?: string
  /** Dates before this are disabled and calendar navigation is restricted to start here */
  minDate?: Date
  /** Dates after this are disabled and calendar navigation is restricted to end here */
  maxDate?: Date
}

function formatPickerDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  timeZone = "Asia/Manila",
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Build disabled matchers: block dates outside [minDate, maxDate]
  const disabled = React.useMemo(() => {
    const matchers: ({ before: Date } | { after: Date })[] = []
    if (minDate) matchers.push({ before: minDate })
    if (maxDate) matchers.push({ after: maxDate })
    return matchers.length > 0 ? matchers : undefined
  }, [minDate, maxDate])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {date ? (
            formatPickerDate(date, timeZone)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d ?? undefined)
            setOpen(false)
          }}
          hideNavigation
          // Restrict navigation to only the allowed year range
          startMonth={minDate}
          endMonth={maxDate}
          // Visually disable out-of-range dates
          disabled={disabled}
          // Open to selected date, falling back to minDate
          defaultMonth={date ?? minDate}
          // Show month + year dropdowns for fast navigation within the allowed range
          captionLayout="dropdown"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}
