import { Settings } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
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

  const selectedCount = options?.selectedCount;
  const selectedCountLabel =
    typeof selectedCount === "number"
      ? `${selectedCount} applicant${selectedCount === 1 ? "" : "s"}`
      : "the selected applicants";

  const displayDate = formatDisplayDate(form.scheduledDate);
  const displayTime = form.scheduledTime?.trim() || "Not set";
  const displayVenue = form.venue?.trim() || "Not set";
  const displayNotes = form.notes?.trim() || "No notes provided.";

  const modeLabelUpper = modeLabel.toUpperCase();

  return (
    <div className="space-y-3">
      {options && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-2">
          <p className="text-xs font-bold text-foreground">
            {modeLabel} Schedule locked to Program Settings.
          </p>
          <p className="text-xs font-bold text-foreground">
            The {modeLabel} Date, {modeLabel} Time, Venue, and Notes below are
            fetched directly from your active scp_program_steps configuration.
            If you wish to change these fields for this batch of{" "}
            {selectedCountLabel}, please update them in Settings -&gt;
            Curriculum Tab.
          </p>

          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <a
              href="/settings?tab=curriculum"
              target="_blank"
              rel="noreferrer noopener">
              <Settings className="size-3.5 mr-1.5" />
              Edit Schedule in Settings
            </a>
          </Button>

          {options?.stepTemplate && (
            <p className="text-[11px] font-bold text-foreground">
              Template step:{" "}
              {options.stepTemplate.label || options.stepTemplate.kind}
              {options.stepTemplate.cutoffScore != null
                ? ` - Cut-off Score: ${options.stepTemplate.cutoffScore}`
                : ""}
            </p>
          )}

          {!options?.stepTemplate && (
            <p className="text-[11px] font-bold text-foreground">
              No matching schedule step is configured in scp_program_steps for
              this batch context.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-10">
        <div className="space-y-1 md:col-span-3">
          <Label className="text-xs font-bold uppercase tracking-wide">
            {modeLabelUpper} DATE
          </Label>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-bold text-foreground min-h-10 flex items-center">
            {displayDate}
          </div>
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label className="text-xs font-bold uppercase tracking-wide">
            {modeLabelUpper} TIME
          </Label>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-bold text-foreground min-h-10 flex items-center">
            {displayTime}
          </div>
        </div>
        <div className="space-y-1 md:col-span-4">
          <Label className="text-xs font-bold uppercase tracking-wide">
            VENUE
          </Label>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-bold text-foreground min-h-10 flex items-center">
            {displayVenue}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-bold uppercase tracking-wide">
          NOTES
        </Label>
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm font-bold text-foreground min-h-[64px]">
          {displayNotes}
        </div>
      </div>
    </div>
  );
}
