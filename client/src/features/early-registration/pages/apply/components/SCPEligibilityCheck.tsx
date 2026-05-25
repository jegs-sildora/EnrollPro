import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  FlaskConical,
  Music,
  Trophy,
  Info,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface GradeInputs {
  gwa: number | null;
  science: number | null;
  math: number | null;
  english: number | null;
}

interface EligibilityResult {
  status: "pending" | "eligible" | "ineligible";
  unmetCriteria: string[];
}

export interface SCPEligibilityState {
  /** null = pending (not enough data), true = eligible, false = ineligible */
  ste: boolean | null;
  spa: boolean | null;
  sps: boolean | null;
}

interface SCPEligibilityCheckProps {
  onEligibilityChange?: (state: SCPEligibilityState) => void;
}

// ─── Evaluation Logic ───────────────────────────────────────────────────────

function evaluateSTE(grades: GradeInputs): EligibilityResult {
  const { gwa, science, math, english } = grades;
  const unmet: string[] = [];

  if (gwa !== null && gwa < 85) {
    unmet.push(`GWA must be ≥ 85 (you entered ${gwa})`);
  }
  if (science !== null && science < 85) {
    const prefix = science < 80 ? "⚠ Critically low — " : "";
    unmet.push(`${prefix}Science must be ≥ 85 (you entered ${science})`);
  }
  if (math !== null && math < 85) {
    const prefix = math < 80 ? "⚠ Critically low — " : "";
    unmet.push(`${prefix}Mathematics must be ≥ 85 (you entered ${math})`);
  }
  if (english !== null && english < 85) {
    const prefix = english < 80 ? "⚠ Critically low — " : "";
    unmet.push(`${prefix}English must be ≥ 85 (you entered ${english})`);
  }

  // If any entered grade already fails, it's ineligible immediately.
  if (unmet.length > 0) {
    return { status: "ineligible", unmetCriteria: unmet };
  }

  // If some fields are still empty, status is pending.
  if (gwa === null || science === null || math === null || english === null) {
    return { status: "pending", unmetCriteria: [] };
  }

  return { status: "eligible", unmetCriteria: [] };
}

function evaluateSPA(grades: GradeInputs): EligibilityResult {
  const { gwa } = grades;
  if (gwa === null) return { status: "pending", unmetCriteria: [] };
  if (gwa >= 80) return { status: "eligible", unmetCriteria: [] };
  return {
    status: "ineligible",
    unmetCriteria: [`GWA must be ≥ 80 (you entered ${gwa})`],
  };
}

// SPS uses the same grade rule as SPA (GWA ≥ 80).
function evaluateSPS(grades: GradeInputs): EligibilityResult {
  return evaluateSPA(grades);
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface GradeFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
}

function GradeField({ id, label, value, onChange }: GradeFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-bold uppercase tracking-wide text-foreground/70">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={75}
        max={100}
        step={0.01}
        placeholder="e.g. 88"
        value={value}
        inputMode="decimal"
        className="h-11 font-bold text-center text-base bg-white"
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      />
    </div>
  );
}

interface EligibilityCardProps {
  title: string;
  acronym: string;
  result: EligibilityResult;
  icon: React.ReactNode;
  requirement: string;
}

function EligibilityCard({
  title,
  acronym,
  result,
  icon,
  requirement,
}: EligibilityCardProps) {
  const isEligible = result.status === "eligible";
  const isIneligible = result.status === "ineligible";
  const isPending = result.status === "pending";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border-2 p-4 transition-all",
        isEligible &&
          "border-emerald-400 bg-emerald-50 shadow-sm shadow-emerald-100",
        isIneligible && "border-red-300 bg-red-50",
        isPending && "border-border bg-muted/30",
      )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isEligible && "bg-emerald-100 text-emerald-700",
              isIneligible && "bg-red-100 text-red-600",
              isPending && "bg-muted/60 text-muted-foreground",
            )}>
            {icon}
          </span>
          <div>
            <p
              className={cn(
                "text-xs font-black uppercase tracking-widest",
                isEligible && "text-emerald-700",
                isIneligible && "text-red-700",
                isPending && "text-muted-foreground",
              )}>
              {acronym}
            </p>
            <p
              className={cn(
                "text-[11px] font-semibold leading-tight",
                isEligible && "text-emerald-800",
                isIneligible && "text-red-800",
                isPending && "text-muted-foreground",
              )}>
              {title}
            </p>
          </div>
        </div>

        {/* Status badge */}
        {isEligible && (
          <div className="flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 tracking-wide shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Eligible
          </div>
        )}
        {isIneligible && (
          <div className="flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black uppercase text-red-700 tracking-wide shrink-0">
            <XCircle className="w-3 h-3" />
            Not Met
          </div>
        )}
        {isPending && (
          <div className="flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-black uppercase text-muted-foreground tracking-wide shrink-0">
            <Clock3 className="w-3 h-3" />
            Awaiting
          </div>
        )}
      </div>

      {/* Requirement summary */}
      <p
        className={cn(
          "text-[11px] font-medium leading-relaxed",
          isEligible && "text-emerald-700",
          isIneligible && "text-red-700/80",
          isPending && "text-muted-foreground",
        )}>
        {requirement}
      </p>

      {/* Unmet criteria list */}
      {isIneligible && result.unmetCriteria.length > 0 && (
        <ul className="space-y-1.5 border-t border-red-200 pt-2">
          {result.unmetCriteria.map((criterion, idx) => (
            <li
              key={idx}
              className="flex items-start gap-1.5 text-[11px] font-semibold text-red-800">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-[1px] text-red-500" />
              <span>{criterion}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Eligible confirmation */}
      {isEligible && (
        <p className="text-[11px] font-bold text-emerald-700 border-t border-emerald-200 pt-2">
          All grade requirements are met. You may apply for this program.
        </p>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SCPEligibilityCheck({
  onEligibilityChange,
}: SCPEligibilityCheckProps) {
  const [grades, setGrades] = React.useState<GradeInputs>({
    gwa: null,
    science: null,
    math: null,
    english: null,
  });
  const [inputStrings, setInputStrings] = React.useState({
    gwa: "",
    science: "",
    math: "",
    english: "",
  });

  const ste = evaluateSTE(grades);
  const spa = evaluateSPA(grades);
  const sps = evaluateSPS(grades);

  const eligibilityState = React.useMemo<SCPEligibilityState>(
    () => ({
      ste:
        ste.status === "eligible"
          ? true
          : ste.status === "ineligible"
            ? false
            : null,
      spa:
        spa.status === "eligible"
          ? true
          : spa.status === "ineligible"
            ? false
            : null,
      sps:
        sps.status === "eligible"
          ? true
          : sps.status === "ineligible"
            ? false
            : null,
    }),
    [ste.status, spa.status, sps.status],
  );

  React.useEffect(() => {
    onEligibilityChange?.(eligibilityState);
  }, [eligibilityState, onEligibilityChange]);

  const handleGradeChange = (
    field: keyof GradeInputs,
    value: string,
  ) => {
    setInputStrings((prev) => ({ ...prev, [field]: value }));
    if (value === "" || value === "-") {
      setGrades((prev) => ({ ...prev, [field]: null }));
      return;
    }
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return;
    setGrades((prev) => ({ ...prev, [field]: parsed }));
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white p-5 space-y-5 shadow-sm">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <FlaskConical className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-primary">
            Grade-Based SCP Eligibility Check
          </p>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-0.5">
            Enter your Grade 6 grades below to simulate baseline eligibility.
            This is a guide — the school will verify official records.
          </p>
        </div>
      </div>

      {/* HNHS Policy Disclaimer */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium text-amber-900 leading-relaxed italic">
          Prerequisites and Documentary Requirements follow the HNHS policy of
          SCP application. Please note that full eligibility for programs like
          SPA and SPS also involves non-grade evaluations such as auditions,
          portfolios, or physical assessments. This tool only simulates the
          baseline grade requirements.
        </p>
      </div>

      {/* Grade Inputs */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/60 mb-3">
          Grade 6 Academic Baseline (from your SF9 / Report Card)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GradeField
            id="viz-gwa"
            label="Gen. Wtd. Avg."
            value={inputStrings.gwa}
            onChange={(v) => handleGradeChange("gwa", v)}
          />
          <GradeField
            id="viz-science"
            label="Science"
            value={inputStrings.science}
            onChange={(v) => handleGradeChange("science", v)}
          />
          <GradeField
            id="viz-math"
            label="Mathematics"
            value={inputStrings.math}
            onChange={(v) => handleGradeChange("math", v)}
          />
          <GradeField
            id="viz-english"
            label="English"
            value={inputStrings.english}
            onChange={(v) => handleGradeChange("english", v)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground font-medium mt-2 italic">
          Input range: 75 – 100. Leave a field blank if the grade is not yet
          available.
        </p>
      </div>

      {/* Status Cards */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-foreground/60 mb-3">
          Simulated Program Eligibility
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <EligibilityCard
            acronym="STE"
            title="Science, Technology & Engineering"
            result={ste}
            icon={<FlaskConical className="w-4 h-4" />}
            requirement="GWA ≥ 85, Science ≥ 85, Math ≥ 85, English ≥ 85 (all four required)"
          />
          <EligibilityCard
            acronym="SPA"
            title="Special Program in the Arts"
            result={spa}
            icon={<Music className="w-4 h-4" />}
            requirement="GWA ≥ 80 (plus audition / portfolio evaluation by the school)"
          />
          <EligibilityCard
            acronym="SPS"
            title="Special Program in Sports"
            result={sps}
            icon={<Trophy className="w-4 h-4" />}
            requirement="GWA ≥ 80 (plus physical tryout / sports screening by the school)"
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground italic leading-relaxed">
        This simulation is for reference only and does not constitute an
        official eligibility determination. Final acceptance is subject to
        school evaluation and DepEd guidelines.
      </p>
    </div>
  );
}
