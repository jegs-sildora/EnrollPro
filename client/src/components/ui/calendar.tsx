import * as React from "react"
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        // Layout
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        // Caption / header
        month_caption: "flex justify-center pt-1 items-center min-h-[28px]",
        // In dropdown mode react-day-picker renders an aria-hidden caption label;
        // keep it visually hidden to avoid duplicated month/year text.
        caption_label: "sr-only",
        // Navigation buttons (used in "label" and "dropdown-buttons" layouts)
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        // Grid
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center pb-1",
        week: "flex w-full mt-1",
        // Day cells
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal"
        ),
        // Selection / state modifiers (react-day-picker v9 names)
        selected:
          "rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "rounded-md bg-accent text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50 cursor-not-allowed",
        range_start: "day-range-start",
        range_end: "day-range-end",
        range_middle:
          "rounded-none bg-accent text-accent-foreground",
        hidden: "invisible",
        // Dropdown caption styles (captionLayout="dropdown" or "dropdown-buttons")
        dropdowns: "flex items-center justify-center gap-2",
        dropdown_root: "relative inline-flex items-center",
        dropdown:
          "h-8 appearance-none rounded-md border border-input bg-background py-1 pl-2 pr-6 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
        months_dropdown: "min-w-28",
        years_dropdown: "min-w-20",
        chevron: "h-3.5 w-3.5 opacity-60",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left")
            return <ChevronLeft className="h-4 w-4" />
          if (orientation === "right")
            return <ChevronRight className="h-4 w-4" />
          return <ChevronDown className="h-3.5 w-3.5" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
