import { CalendarDays, Clock3, Lock, MapPin, Settings } from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ScheduleFormRenderOptions, ScheduleFormState } from "./types";

interface PipelineBatchScheduleFormProps {
  form: ScheduleFormState;
  onChange: (patch: Partial<ScheduleFormState>) => void;
  modeLabel: "Exam" | "Interview";
  isBatchProcessing: boolean;
  isReadOnly?: boolean;
  options?: ScheduleFormRenderOptions;
}

export default function PipelineBatchScheduleForm({
  form,
  modeLabel,
  options,
}: PipelineBatchScheduleFormProps) {
  const NOTES_FALLBACK = "No additional notes from the global template.";
  const PLACEHOLDER_NOTES = new Set([
    "asdf",
    "asdfasdf",
    "test",
    "sample",
    "none",
    "na",
    "n/a",
    "lorem ipsum",
    "loremipsum",
  ]);

  const formatDisplayDate = (value: string) => {
    if (!value.trim()) return "Not set";

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;

    return parsedDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const resolveDisplayNotes = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return NOTES_FALLBACK;

    const normalized = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9/\s_-]+/g, "")
      .trim();
    const compact = normalized.replace(/[\s/_-]+/g, "");

    if (PLACEHOLDER_NOTES.has(normalized) || PLACEHOLDER_NOTES.has(compact)) {
      return NOTES_FALLBACK;
    }

    return trimmed;
  };

  const displayDate = formatDisplayDate(form.scheduledDate);
  const displayTime = form.scheduledTime?.trim() || "Not set";
  const displayVenue = form.venue?.trim() || "Not set";
  const displayNotes = resolveDisplayNotes(form.notes ?? "");

  return (
    <div className="space-y-3">
      {options && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lock
                className="size-3.5"
                aria-hidden="true"
              />
              <span>{modeLabel} schedule locked to Global SCP Settings.</span>
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-xs">
              <a href="/settings?tab=curriculum">
                <Settings
                  className="size-3.5 mr-1.5"
                  aria-hidden="true"
                />
                Edit in Settings
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="rounded-md bg-background/70 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <CalendarDays
                className="size-3.5"
                aria-hidden="true"
              />
              {modeLabel} Date
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {displayDate}
            </p>
          </div>
          <div className="rounded-md bg-background/70 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <Clock3
                className="size-3.5"
                aria-hidden="true"
              />
              {modeLabel} Time
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {displayTime}
            </p>
          </div>
          <div className="rounded-md bg-background/70 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <MapPin
                className="size-3.5"
                aria-hidden="true"
              />
              Venue
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {displayVenue}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
            Notes
          </p>
          <blockquote className="rounded-r-md border-l-2 border-muted-foreground/35 pl-3 text-sm italic text-foreground">
            {displayNotes}
          </blockquote>
        </div>
      </div>
    </div>
  );
}
