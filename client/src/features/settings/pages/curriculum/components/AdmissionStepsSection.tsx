import {
  ArrowDown,
  Lock,
  Plus,
  Trash2,
  GripVertical,
  X,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { DatePicker } from "@/shared/ui/date-picker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { TimePicker } from "@/shared/ui/time-picker";
import { Button } from "@/shared/ui/button";
import { isExamStepKind, getSteProgramSteps } from "../utils/scpSteps";
import { cn } from "@/shared/lib/utils";
import type { ScpConfig, ScpStepConfig, RubricCategory } from "../types";

interface AdmissionStepsSectionProps {
  scp: ScpConfig;
  scpIndex: number;
  scpYearStart: Date;
  scpYearEnd: Date;
  isSteProgram: boolean;
  onUpdateScpField: (
    index: number,
    field: keyof ScpConfig,
    value: string | boolean | number | string[] | null,
  ) => void;
  onUpdateStep: (
    scpIndex: number,
    stepIndex: number,
    field: keyof ScpStepConfig,
    value: any,
  ) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

function RubricBuilder({
  rubric,
  onChange,
  onReset,
  showReset,
}: {
  rubric: RubricCategory[] | null | undefined;
  onChange: (value: RubricCategory[]) => void;
  onReset?: () => void;
  showReset?: boolean;
}) {
  const categories = Array.isArray(rubric) ? rubric : [];

  const addCategory = () => {
    const newCategory: RubricCategory = {
      id: generateId(),
      name: "",
      criteria: [],
    };
    onChange([...categories, newCategory]);
  };

  const removeCategory = (catId: string) => {
    onChange(categories.filter((c) => c.id !== catId));
  };

  const updateCategory = (catId: string, name: string) => {
    onChange(categories.map((c) => (c.id === catId ? { ...c, name } : c)));
  };

  const addCriterion = (catId: string) => {
    onChange(
      categories.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          criteria: [
            ...c.criteria,
            { id: generateId(), name: "", description: "", maxPts: 0 },
          ],
        };
      }),
    );
  };

  const removeCriterion = (catId: string, critId: string) => {
    onChange(
      categories.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          criteria: c.criteria.filter((crit) => crit.id !== critId),
        };
      }),
    );
  };

  const updateCriterion = (
    catId: string,
    critId: string,
    field: "name" | "description" | "maxPts",
    value: any,
  ) => {
    onChange(
      categories.map((c) => {
        if (c.id !== catId) return c;
        return {
          ...c,
          criteria: c.criteria.map((crit) =>
            crit.id === critId ? { ...crit, [field]: value } : crit,
          ),
        };
      }),
    );
  };

  const actualTotal = categories.reduce(
    (acc, cat) =>
      acc +
      cat.criteria.reduce((sum, crit) => sum + (Number(crit.maxPts) || 0), 0),
    0,
  );

  const isTotalValid = actualTotal === 100;

  return (
    <div className="space-y-4 border-t border-border pt-4 mt-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-black uppercase text-primary flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Interview Evaluation Rubric
          </Label>
          <p className="text-xs font-bold text-muted-foreground">
            Define categories and criteria. Teachers use this during interviews.
          </p>
        </div>
        {showReset && onReset && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-7 gap-1.5 border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/5"
          >
            <RotateCcw className="h-3 w-3" />
            RESET TO OFFICIAL STE RUBRIC
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {categories.map((cat, catIdx) => (
          <div
            key={cat.id || `cat-${catIdx}`}
            className="rounded-lg border bg-background shadow-sm"
          >
            <div className="flex items-center gap-2 p-2 bg-muted/30 border-b">
              <GripVertical className="size-4 text-muted-foreground/40 shrink-0" />
              <div className="flex-1">
                <Input
                  placeholder="Category Name (e.g., Image Interpretation)"
                  className="h-8 text-sm font-bold uppercase "
                  value={cat.name || ""}
                  onChange={(e) => updateCategory(cat.id, e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:bg-destructive/10"
                onClick={() => removeCategory(cat.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="p-3 space-y-3">
              {cat.criteria.length > 0 && (
                <div className="grid grid-cols-12 gap-2 mb-1 px-1">
                  <div className="col-span-4">
                    <span className="text-xs font-black uppercase text-foreground">
                      Criterion Name
                    </span>
                  </div>
                  <div className="col-span-6">
                    <span className="text-xs font-black uppercase text-foreground">
                      Description
                    </span>
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-xs font-black uppercase text-foreground">
                      Max Pts
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {cat.criteria.map((crit, critIdx) => (
                  <div
                    key={crit.id || `crit-${critIdx}`}
                    className="grid grid-cols-12 gap-2 items-start"
                  >
                    <div className="col-span-4">
                      <Input
                        placeholder="Criterion"
                        className="h-8 text-sm font-semibold"
                        value={crit.name || ""}
                        onChange={(e) =>
                          updateCriterion(
                            cat.id,
                            crit.id,
                            "name",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-6">
                      <Input
                        placeholder="Guideline/Description"
                        className="h-8 text-sm font-medium text-foreground"
                        value={crit.description || ""}
                        onChange={(e) =>
                          updateCriterion(
                            cat.id,
                            crit.id,
                            "description",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-sm font-black text-center"
                        value={crit.maxPts}
                        placeholder="0"
                        onChange={(e) =>
                          updateCriterion(
                            cat.id,
                            crit.id,
                            "maxPts",
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-foreground hover:text-destructive"
                        onClick={() => removeCriterion(cat.id, crit.id)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs font-bold border-dashed w-full"
                onClick={() => addCriterion(cat.id)}
              >
                <Plus className="size-3 mr-1" /> Add Criterion
              </Button>
            </div>
          </div>
        ))}

        <Button
          variant="secondary"
          size="sm"
          className="w-full font-black text-xs uppercase "
          onClick={addCategory}
        >
          <Plus className="size-3.5 mr-1.5" /> Add Rubric Category
        </Button>
      </div>

      <div
        className={cn(
          "sticky bottom-0 bg-background border rounded-lg p-3 flex items-center justify-between shadow-md transition-all",
          isTotalValid
            ? "border-emerald-500 bg-emerald-50/30"
            : "border-amber-500 bg-amber-50/30",
        )}
      >
        <div className="flex items-center gap-2">
          {isTotalValid ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 text-amber-600" />
          )}
          <span
            className={cn(
              "text-sm font-black uppercase ",
              isTotalValid ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {isTotalValid ? "Rubric Validated" : "Rubric Must Total 100"}
          </span>
        </div>
        <div
          className={cn(
            "px-3 py-1 rounded-md text-sm font-black flex items-center gap-1",
            isTotalValid
              ? "bg-emerald-600 text-white"
              : "bg-amber-600 text-white",
          )}
        >
          TOTAL: {actualTotal} / 100
        </div>
      </div>
    </div>
  );
}

export function AdmissionStepsSection({
  scp,
  scpIndex,
  scpYearStart,
  scpYearEnd,
  isSteProgram,
  onUpdateScpField,
  onUpdateStep,
}: AdmissionStepsSectionProps) {
  const firstExamStepOrder =
    scp.steps.find((step) => isExamStepKind(step.kind))?.stepOrder ?? null;

  const handleResetRubric = (stepIdx: number) => {
    const steSteps = getSteProgramSteps(scp.isTwoPhase);
    const interviewStep = steSteps.find((s) => s.kind === "INTERVIEW");
    if (interviewStep?.rubric) {
      onUpdateStep(scpIndex, stepIdx, "rubric", interviewStep.rubric);
    }
  };

  return (
    <div className="space-y-4">
      {isSteProgram && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <Label className="text-sm font-bold uppercase ">
            Admission Pipeline
          </Label>
          <div
            role="radiogroup"
            aria-label="STE examination phase"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!scp.isTwoPhase}
              onClick={() => onUpdateScpField(scpIndex, "isTwoPhase", false)}
              className={`h-10 rounded-md border px-3 text-sm font-bold transition ${
                !scp.isTwoPhase
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              1 Exam Phase (Qualifying Exam + Interview)
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
              }`}
            >
              2 Exam Phases (Preliminary Exam + Final Exam + Interview)
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {scp.isTwoPhase
              ? "Preliminary Exam → Final Exam → Interview"
              : "Qualifying Exam → Interview"}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-bold uppercase ">Admission Steps</Label>

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

              <span className="absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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
                      className="ml-auto text-sm px-1.5 py-0 h-4"
                    >
                      Required
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="ml-auto text-sm px-1.5 py-0 h-4 text-muted-foreground"
                    >
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

                    {step.kind === "INTERVIEW" && (
                      <RubricBuilder
                        rubric={step.rubric}
                        showReset={isSteProgram}
                        onReset={() => handleResetRubric(stepIdx)}
                        onChange={(value) =>
                          onUpdateStep(scpIndex, stepIdx, "rubric", value)
                        }
                      />
                    )}
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
