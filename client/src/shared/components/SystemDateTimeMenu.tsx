import { CalendarDays, Clock } from "lucide-react";
import { useManilaNow } from "@/shared/hooks/useManilaNow";
import { MOCKED_SYSTEM_DATE_KEY } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

const systemDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const systemTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

export function SystemDateTimeMenu() {
  const now = useManilaNow();
  const isMocked = localStorage.getItem(MOCKED_SYSTEM_DATE_KEY) !== null;
  const formattedDate = systemDateFormatter.format(now);
  const formattedTime = systemTimeFormatter.format(now);

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-full p-2 text-primary transition-colors hover:bg-primary/10"
                aria-label="Show system date and time"
              >
                <Clock className="size-4" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>System Date &amp; Time</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-80 bg-muted" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 border-b pb-2">
            <h4 className="flex items-center gap-2 text-base font-bold">
              <Clock className="size-4" />
              System Date &amp; Time
            </h4>
            {isMocked ? (
              <Badge className="border-orange-300 bg-orange-100 text-orange-700 hover:bg-orange-100">
                Mocked
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-background p-4 text-center shadow-sm">
            <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
              <CalendarDays className="size-4" />
              <span>{formattedDate}</span>
            </div>
            <time
              dateTime={now.toISOString()}
              className="block whitespace-nowrap text-2xl font-extrabold tabular-nums tracking-wide text-primary"
              aria-live="off"
            >
              {formattedTime}
            </time>
          </div>

          <p className="text-center text-xs font-medium text-muted-foreground">
            Philippine Standard Time (Asia/Manila)
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
