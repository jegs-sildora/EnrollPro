import { ArrowDown, Lock } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
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
  const isSteProgram = scp.scpType === "SCIENCE_TECHNOLOGY_AND_ENGINEERING";
  const firstExamStepOrder =
    scp.steps.find((step) => isExamStepKind(step.kind))?.stepOrder ?? null;

  return (
    <div className="space-y-4">
      {isSteProgram && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <Label className="text-sm font-bold uppercase tracking-wide">
            Admission Pipeline
          </Label>
          <div
            role="radiogroup"
            aria-label="STE examination phase"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={!scp.isTwoPhase}
              onClick={() => onUpdateScpField(scpIndex, "isTwoPhase", false)}
              className={`h-10 rounded-md border px-3 text-sm font-bold transition ${
                !scp.isTwoPhase
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}>
              1 Phase (Exam Only)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={scp.isTwoPhase}
              onClick={() => onUpdateScpField(scpIndex, "isTwoPhase", true)}
              className={`h-10 rounded-md border px-3 text-sm font-bold transition ${
                scp.isTwoPhase
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}>
              2 Phases (Exam + Interview)
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {scp.isTwoPhase
              ? "Preliminary Exam → Final Exam → Interview"
              : "Qualifying Exam → Interview"}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-bold uppercase tracking-wide">
          Admission Steps
        </Label>

        {scp.steps.length === 0 && (
          <p className="text-sm  italic py-2">
            No assessment pipeline defined for this program type.
          </p>
        )}

        <div className="space-y-6">
          {scp.steps.map((step, stepIdx) => (
            <div key={stepIdx} className="relative pl-9">
              {stepIdx < scp.steps.length - 1 && (
                <span className="pointer-events-none absolute left-3 top-10 h-[calc(100%+1.25rem)] w-px bg-border" />
              )}

              <span className="absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {step.stepOrder}
              </span>

              <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
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

                <div className="px-3 py-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="space-y-2 border-t border-border/50 pt-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm font-bold uppercase">
                            Cut-Off Score
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
                        </div>

                        {step.stepOrder === firstExamStepOrder ? (
                          <div className="space-y-1">
                            <Label className="text-sm font-bold uppercase">
                              Max Slots/Quota
                            </Label>
                            <Input
                              type="number"
                              min={1}
                              placeholder="e.g. 70"
                              className="h-8 text-sm font-bold"
                              value={scp.maxSlots ?? ""}
                              onChange={(event) =>
                                onUpdateScpField(
                                  scpIndex,
                                  "maxSlots",
                                  event.target.value
                                    ? parseInt(event.target.value, 10)
                                    : null,
                                )
                              }
                            />
                          </div>
                        ) : (
                          <div className="hidden sm:block" />
                        )}
                      </div>

                      {step.stepOrder === firstExamStepOrder && (
                        <p className="text-xs text-muted-foreground">
                          System will pass learners above cut-off, up to the
                          maximum quota, ranked by highest score.
                        </p>
                      )}
                    </div>
                  )}

                  {stepIdx > 0 &&
                    scp.steps
                      .slice(0, stepIdx)
                      .some((previousStep) => previousStep.isRequired) && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        Gated — requires passing{" "}
                        {scp.steps
                          .filter(
                            (previousStep) =>
                              previousStep.stepOrder < step.stepOrder &&
                              previousStep.isRequired,
                          )
                          .map((previousStep) => previousStep.label)
                          .join(", ")}
                      </p>
                    )}

                  <div className="space-y-3 border-t border-border/50 pt-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold uppercase">
                        Venue
                      </Label>
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
                      <Label className="text-sm font-bold uppercase">
                        Notes
                      </Label>
                      <Textarea
                        placeholder="Additional requirements..."
                        className="min-h-[72px] text-sm font-semibold"
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
              </div>

              {stepIdx < scp.steps.length - 1 && (
                <span className="pointer-events-none absolute -bottom-5 left-[0.15rem] flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground">
                  <ArrowDown className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
