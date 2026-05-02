import { useEffect, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  Settings,
  Zap,
  CheckCircle2,
  Users,
  Info,
} from "lucide-react";
import { DEFAULT_SECTIONING_PARAMS } from "@enrollpro/shared";
import type { SectioningParams } from "@enrollpro/shared";
import api from "@/shared/api/axiosInstance";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { cn } from "@/shared/lib/utils";

interface Prerequisites {
  steSectionsCount: number;
  regularSectionsCount: number;
  isSteReady: boolean;
  isPilotReady: boolean;
  isReady: boolean;
  unassignedCount: number;
  config: SectioningParams;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRun: (params: SectioningParams) => void;
  gradeLevelId: number;
  gradeLevelName: string;
  schoolYearId: number;
  isGrade7: boolean;
}

function ParamField({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5",
        disabled && "opacity-40 pointer-events-none",
      )}>
      <Label
        htmlFor={id}
        className="text-xs font-black uppercase tracking-wider text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={min ?? 1}
        max={max ?? 999}
        value={value}
        onChange={(e) =>
          onChange(Math.max(min ?? 1, parseInt(e.target.value) || 0))
        }
        className="h-10 w-28 font-bold text-sm tabular-nums border-2 focus-visible:ring-primary"
        disabled={disabled}
      />
      {hint && (
        <p className="text-[10px] text-muted-foreground font-medium leading-tight">
          {hint}
        </p>
      )}
    </div>
  );
}

export function BatchSectioningParamsModal({
  isOpen,
  onClose,
  onRun,
  gradeLevelId,
  gradeLevelName,
  schoolYearId,
  isGrade7,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [prereqs, setPrereqs] = useState<Prerequisites | null>(null);
  const [params, setParams] = useState<SectioningParams>(
    DEFAULT_SECTIONING_PARAMS,
  );

  useEffect(() => {
    if (!isOpen) return;

    const fetchPrereqs = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(
          `/sections/batch-sectioning/prerequisites/${gradeLevelId}?schoolYearId=${schoolYearId}`,
        );
        const data: Prerequisites = res.data;
        setPrereqs(data);
        setParams(data.config ?? DEFAULT_SECTIONING_PARAMS);
      } catch {
        setPrereqs(null);
        setParams(DEFAULT_SECTIONING_PARAMS);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPrereqs();
  }, [isOpen, gradeLevelId, schoolYearId]);

  const set = (field: keyof SectioningParams) => (v: number) =>
    setParams((prev) => ({ ...prev, [field]: v }));

  // ── DepEd class-size guardrails ──────────────────────────────────────────────
  const DEPED_MIN_CLASS_SIZE = 15;
  const DEPED_MAX_CLASS_SIZE = 45;

  // Dynamic section names (STE-A, STE-B, STE-C, …)
  const generatedSteNames = Array.from(
    { length: params.steSections },
    (_, i) => `STE-${String.fromCharCode(65 + i)}`,
  );

  // Floor + remainder distribution preview (mirrors the backend algorithm)
  const steBase = Math.floor(params.steQuota / params.steSections);
  const steRemainder = params.steQuota % params.steSections;
  const perSectionCapacities = Array.from(
    { length: params.steSections },
    (_, i) => steBase + (i < steRemainder ? 1 : 0),
  );

  const steAvgPerSection =
    params.steSections > 0 ? params.steQuota / params.steSections : 0;

  const steClassSizeError: string | null = (() => {
    if (!isGrade7 || params.steSections === 0) return null;
    if (steAvgPerSection < DEPED_MIN_CLASS_SIZE)
      return ` Class size of ${steAvgPerSection.toFixed(1)} is below the DepEd minimum (${DEPED_MIN_CLASS_SIZE}). Lower the number of sections or increase the quota.`;
    if (steAvgPerSection > DEPED_MAX_CLASS_SIZE)
      return ` Class size of ${steAvgPerSection.toFixed(1)} exceeds DepEd maximum capacity (${DEPED_MAX_CLASS_SIZE}). Increase the number of sections or lower the quota.`;
    return null;
  })();

  // Live math guardrail
  const allocatedCount = isGrade7
    ? params.steQuota + params.pilotSectionCount * params.sectionCapacity
    : 0;
  const overAllocated =
    isGrade7 && prereqs != null && allocatedCount > prereqs.unassignedCount;
  const remainingAfterSteAndPilot = prereqs
    ? Math.max(
        0,
        prereqs.unassignedCount -
          (isGrade7
            ? params.steQuota +
              params.pilotSectionCount * params.sectionCapacity
            : 0),
      )
    : 0;

  // isSteReady is no longer a hard-stop: the backend auto-creates STE sections.
  // isPilotReady remains a hard-stop because regular sections need manual setup.
  const canRun =
    !isLoading &&
    prereqs != null &&
    !overAllocated &&
    !steClassSizeError &&
    (isGrade7 ? prereqs.isPilotReady : true);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl border-2 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black uppercase ">
                Configure Batch Sectioning Parameters
              </DialogTitle>
              <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                S.Y. {schoolYearId} • {gradeLevelName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Pool summary */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Users className="h-8 w-8 text-primary shrink-0" />
                <div>
                  <p className="text-2xl font-black tabular-nums text-primary leading-none">
                    {prereqs?.unassignedCount ?? "–"}
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                    Unassigned Learners in Pool
                  </p>
                </div>
              </div>

              {/* Section readiness warnings */}
              {prereqs && !prereqs.isSteReady && isGrade7 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 text-primary">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold">
                    {prereqs.steSectionsCount} of {params.steSections} STE
                    section(s) found. The system will automatically create the
                    remaining sections when you run the algorithm.
                  </p>
                </div>
              )}
              {prereqs && !prereqs.isPilotReady && isGrade7 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold">
                    Only {prereqs.regularSectionsCount} REGULAR section(s)
                    found. At least {params.pilotSectionCount} are required for
                    Pilot slicing.
                  </p>
                </div>
              )}

              {/* ── TIER 1: STE ── */}
              <div className="rounded-xl border-2 border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Tier 1 — Special Curricular Program (STE)
                  </span>
                  {!isGrade7 && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 ml-auto">
                      Vacancy Fill (Grade 8–10)
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    System will sort by Early Registration assessment scores.
                  </p>
                  <div className="flex flex-wrap gap-6">
                    <ParamField
                      id="steQuota"
                      label="Total Quota (Learners)"
                      hint={`Fills ${params.steSections} STE section(s)`}
                      value={params.steQuota}
                      onChange={set("steQuota")}
                      disabled={!isGrade7}
                      min={1}
                      max={500}
                    />
                    <ParamField
                      id="steSections"
                      label="Target Sections"
                      hint={`~${steAvgPerSection.toFixed(1)} learners per section`}
                      value={params.steSections}
                      onChange={set("steSections")}
                      disabled={!isGrade7}
                      min={1}
                      max={20}
                    />
                  </div>

                  {/* Dynamic section-name + capacity preview */}
                  {isGrade7 && (
                    <div
                      className={cn(
                        "rounded-lg border p-3 space-y-2",
                        steClassSizeError
                          ? "border-destructive/40 bg-destructive/5"
                          : "border-primary/20 bg-primary/5",
                      )}>
                      <div className="flex items-start gap-2">
                        {steClassSizeError ? (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
                        ) : (
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                        )}
                        <div className="space-y-1.5 flex-1">
                          <p
                            className={cn(
                              "text-[11px] font-medium leading-relaxed",
                              steClassSizeError
                                ? "text-destructive font-bold"
                                : "text-muted-foreground",
                            )}>
                            {steClassSizeError
                              ? steClassSizeError
                              : `System will generate ${
                                  generatedSteNames.length <= 3
                                    ? generatedSteNames.join(", ")
                                    : `${generatedSteNames.slice(0, 3).join(", ")}…`
                                } with an average of ${steAvgPerSection.toFixed(
                                  1,
                                )} learners per section.`}
                          </p>
                          {!steClassSizeError && (
                            <div className="flex flex-wrap gap-1.5">
                              {perSectionCapacities.map((cap, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 text-[10px] font-black bg-primary/10 text-primary rounded px-2 py-0.5">
                                  {generatedSteNames[i]}: {cap}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TIER 2: BEC PILOT ── */}
              <div className="rounded-xl border-2 border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border-b">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Tier 2 — BEC Pilot Slicing
                  </span>
                  {!isGrade7 && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60 ml-auto">
                      Vacancy Fill (Grade 8–10)
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    System will allocate the top{" "}
                    <span className="font-black text-foreground">
                      {params.pilotSectionCount * params.sectionCapacity}
                    </span>{" "}
                    learners by Gen Ave into {params.pilotSectionCount}{" "}
                    section(s).
                  </p>
                  <div className="flex flex-wrap gap-6">
                    <ParamField
                      id="pilotSectionCount"
                      label="Number of Pilot Sections"
                      value={params.pilotSectionCount}
                      onChange={set("pilotSectionCount")}
                      disabled={!isGrade7}
                      min={0}
                      max={50}
                    />
                    <ParamField
                      id="sectionCapacity"
                      label="Capacity per Section"
                      hint="Applies to Pilot and Hetero tiers"
                      value={params.sectionCapacity}
                      onChange={set("sectionCapacity")}
                      min={1}
                      max={100}
                    />
                  </div>
                </div>
              </div>

              {/* ── TIER 3: HETERO ── */}
              <div className="rounded-xl border-2 border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/50 border-b">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Tier 3 — Heterogeneous Snake Draft
                  </span>
                </div>
                <div className="p-4 flex items-center gap-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <p className="text-[11px] text-muted-foreground font-medium">
                    The remaining{" "}
                    <span className="font-black text-foreground">
                      {remainingAfterSteAndPilot}
                    </span>{" "}
                    learners will be distributed evenly using the Snake Draft
                    algorithm (gender-parity + reading-profile balanced).
                  </p>
                </div>
              </div>

              {/* Over-allocation guardrail */}
              {overAllocated && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-xs font-black">
                    Your STE + Pilot allocation ({allocatedCount}) exceeds the
                    total number of unassigned learners (
                    {prereqs?.unassignedCount}). Reduce your quotas.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card">
          <Button
            variant="outline"
            onClick={onClose}
            className="font-bold text-xs uppercase tracking-widest border-2">
            Cancel
          </Button>
          <Button
            onClick={() => onRun(params)}
            disabled={!canRun}
            className="font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 gap-2">
            <Zap className="h-4 w-4" />
            Run Algorithm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
