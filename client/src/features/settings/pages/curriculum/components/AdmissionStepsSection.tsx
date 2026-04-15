import { Lock } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { TimePicker } from "@/shared/ui/time-picker";
import { isExamStepKind } from "../utils/scpSteps";
import type { ScpConfig, ScpStepConfig } from "../types";

interface AdmissionStepsSectionProps {
  scp: ScpConfig;
  scpIndex: number;
  scpYearStart: Date;
  scpYearEnd: Date;
  onUpdateScpField: (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => void;
  onUpdateStep: (
    scpIndex: number,
    stepIndex: number,
    field: keyof ScpStepConfig,
    value: string | boolean | number | null,
  ) => void;
}

export function AdmissionStepsSection({
  scp,
  scpIndex,
  scpYearStart,
  scpYearEnd,
  onUpdateScpField,
  onUpdateStep,
}: AdmissionStepsSectionProps) {
  return (
    <div className="space-y-3">
      {scp.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING" && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Label className="text-sm font-bold">Examination Phase</Label>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold ${
                !scp.isTwoPhase ? "text-primary" : "text-muted-foreground"
              }`}>
              1 Phase
            </span>
            <Switch
              checked={scp.isTwoPhase}
              onCheckedChange={(checked) =>
                onUpdateScpField(scpIndex, "isTwoPhase", checked)
              }
            />
            <span
              className={`text-xs font-bold ${
                scp.isTwoPhase ? "text-primary" : "text-muted-foreground"
              }`}>
              2 Phase
            </span>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {scp.isTwoPhase
              ? "Preliminary Exam → Final Exam → Interview"
              : "Qualifying Exam → Interview"}
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold uppercase tracking-wide">
            Admission Steps
          </Label>
        </div>

        {scp.steps.length === 0 && (
          <p className="text-sm  italic py-2">
            No assessment pipeline defined for this program type.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {scp.steps.map((step, stepIdx) => (
            <div
              key={stepIdx}
              className="rounded-lg border border-border overflow-hidden bg-muted/20">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                  {step.stepOrder}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {step.label}
                </span>
                {step.isRequired ? (
                  <Badge
                    variant="outline"
                    className="ml-auto text-sm px-1.5 py-0 h-4">
                    Required
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="ml-auto text-sm px-1.5 py-0 h-4 text-muted-foreground">
                    Optional
                  </Badge>
                )}
              </div>

              <div className="px-3 py-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <DatePicker
                  date={
                    step.scheduledDate
                      ? new Date(step.scheduledDate)
                      : undefined
                  }
                  setDate={(date) =>
                    onUpdateStep(
                      scpIndex,
                      stepIdx,
                      "scheduledDate",
                      date ? date.toISOString() : null,
                    )
                  }
                  minDate={scpYearStart}
                  maxDate={scpYearEnd}
                  showYearSelect={false}
                  className="h-8 text-sm font-bold uppercase"
                />
                <TimePicker
                  value={step.scheduledTime}
                  onChange={(time) =>
                    onUpdateStep(scpIndex, stepIdx, "scheduledTime", time)
                  }
                  className="h-8"
                />
              </div>

              {isExamStepKind(step.kind) && (
                <div className="px-3 pt-2 border-t border-border/50">
                  <div className="max-w-[200px] space-y-1">
                    <Label className="text-sm font-bold uppercase">
                      Cut-off Score
                    </Label>
                    <Input
                      type="number"
                      placeholder="Min Score"
                      className="h-8 text-sm font-bold"
                      value={step.cutoffScore ?? ""}
                      onChange={(event) =>
                        onUpdateStep(
                          scpIndex,
                          stepIdx,
                          "cutoffScore",
                          event.target.value
                            ? parseFloat(event.target.value)
                            : null,
                        )
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-determines pass / fail
                    </p>
                  </div>
                </div>
              )}

              {stepIdx > 0 &&
                scp.steps.slice(0, stepIdx).some((prev) => prev.isRequired) && (
                  <p className="px-3 pb-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Gated — requires passing{" "}
                    {scp.steps
                      .filter(
                        (prev) =>
                          prev.stepOrder < step.stepOrder && prev.isRequired,
                      )
                      .map((prev) => prev.label)
                      .join(", ")}
                  </p>
                )}

              <div className="px-3 pb-3 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm font-bold uppercase">Venue</Label>
                  <Input
                    placeholder="Venue (optional)"
                    className="h-8 text-sm font-bold uppercase"
                    value={step.venue || ""}
                    onChange={(event) =>
                      onUpdateStep(
                        scpIndex,
                        stepIdx,
                        "venue",
                        event.target.value || null,
                      )
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-bold uppercase">Notes</Label>
                  <Input
                    placeholder="Additional requirements..."
                    className="h-8 text-sm font-bold uppercase"
                    value={step.notes || ""}
                    onChange={(event) =>
                      onUpdateStep(
                        scpIndex,
                        stepIdx,
                        "notes",
                        event.target.value,
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
