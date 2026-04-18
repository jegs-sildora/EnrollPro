import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Clock, Circle, Lock } from "lucide-react";
import type { AssessmentStep } from "@/features/enrollment/hooks/useApplicationDetail";
import { formatDisplayTime12Hour, formatScpType } from "@/shared/lib/utils";
import { ASSESSMENT_KIND_LABELS } from "@enrollpro/shared";
import type { AssessmentKind } from "@enrollpro/shared";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";

export interface SCPAssessmentApplicant {
  applicantType: string;
  status: string;
  assessmentSteps: AssessmentStep[];
  assessmentType?: string | null;
  examDate?: string | null;
  examVenue?: string | null;
  examScore?: number | null;
  examResult?: string | null;
  examNotes?: string | null;
}

interface Props {
  applicant: SCPAssessmentApplicant;
  onSaveStepResult?: (
    stepOrder: number,
    kind: string,
    score: number,
    cutoffScore: number | null,
  ) => Promise<void>;
  onSubmitInterviewResult?: (passed: boolean) => Promise<void>;
  interviewPassChecked?: boolean;
  onInterviewPassChange?: (checked: boolean) => void;
}

const STATUS_CONFIG = {
  COMPLETED: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    badge: "bg-emerald-100 text-emerald-800",
    line: "bg-emerald-300",
  },
  SCHEDULED: {
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-800",
    line: "bg-blue-300",
  },
  PENDING: {
    icon: Circle,
    color: "text-foreground",
    bg: "bg/30",
    border: "border-border",
    badge: "bg text-foreground",
    line: "bg-border",
  },
  LOCKED: {
    icon: Lock,
    color: "text-foreground/50",
    bg: "bg/20",
    border: "border-border",
    badge: "bg text-foreground/60",
    line: "bg-border",
  },
} as const;

function InlineScoreCard({
  steps,
  onSave,
}: {
  steps: AssessmentStep[];
  onSave: (
    stepOrder: number,
    kind: string,
    score: number,
    cutoffScore: number | null,
  ) => Promise<void>;
}) {
  const examSteps = steps.filter((s) => s.kind !== "INTERVIEW");
  const [scores, setScores] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<number | null>(null);

  if (examSteps.length === 0) return null;

  return (
    <div className="border border-amber-400/60 bg-amber-50/50 rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm border-b border-amber-400/60 pb-2">
        <span>&#128221;</span>
        <span>Record Assessment Score</span>
      </div>
      {examSteps.map((step) => {
        const isScheduled = step.status === "SCHEDULED";
        const isCompleted = step.status === "COMPLETED";
        const isEditing = editingStep === step.stepOrder;
        const scoreVal =
          scores[step.stepOrder] ??
          (step.score !== null ? String(step.score) : "");
        const numericScore = parseFloat(scoreVal);
        const hasScore = scoreVal !== "" && !isNaN(numericScore);

        return (
          <div
            key={step.stepOrder}
            className="space-y-2 rounded-md border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {step.label ||
                  ASSESSMENT_KIND_LABELS[step.kind as AssessmentKind] ||
                  step.kind}
              </span>
              {isCompleted && step.result && (
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    step.result === "PASSED"
                      ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                      : "border-red-500 text-red-700 bg-red-50"
                  }`}>
                  {step.result}
                </Badge>
              )}
            </div>

            {step.cutoffScore != null && (
              <p className="text-xs font-bold">
                Cut-off Score: {step.cutoffScore}
              </p>
            )}

            {(isScheduled || isEditing) && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {isEditing ? "Update Result" : "Score / Rating"}
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="e.g. 85.5"
                    value={scoreVal}
                    onChange={(e) =>
                      setScores((prev) => ({
                        ...prev,
                        [step.stepOrder]: e.target.value,
                      }))
                    }
                    className="text-sm font-bold"
                  />
                </div>

                {hasScore && step.cutoffScore != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-bold ${
                      numericScore >= step.cutoffScore
                        ? "border-emerald-500 text-emerald-700 bg-emerald-50"
                        : "border-red-500 text-red-700 bg-red-50"
                    }`}>
                    {numericScore >= step.cutoffScore
                      ? "PASSED \u2014 Meets cut-off"
                      : "FAILED \u2014 Below cut-off"}
                  </Badge>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-sm font-bold"
                    disabled={!hasScore || saving === step.stepOrder}
                    onClick={async () => {
                      setSaving(step.stepOrder);
                      try {
                        await onSave(
                          step.stepOrder,
                          step.kind,
                          numericScore,
                          step.cutoffScore,
                        );
                        setScores((prev) => {
                          const updated = { ...prev };
                          delete updated[step.stepOrder];
                          return updated;
                        });
                        setEditingStep(null);
                      } finally {
                        setSaving(null);
                      }
                    }}>
                    {saving === step.stepOrder
                      ? "Saving..."
                      : isEditing
                        ? "Update Result"
                        : "Save Result"}
                  </Button>
                  {isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-sm font-bold"
                      disabled={saving === step.stepOrder}
                      onClick={() => {
                        setEditingStep(null);
                        setScores((prev) => {
                          const updated = { ...prev };
                          delete updated[step.stepOrder];
                          return updated;
                        });
                      }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </>
            )}

            {isCompleted && step.score !== null && !isEditing && (
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Score: {step.score}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-bold"
                  onClick={() => {
                    setEditingStep(step.stepOrder);
                    setScores((prev) => ({
                      ...prev,
                      [step.stepOrder]: String(step.score),
                    }));
                  }}>
                  Edit Score
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InterviewResultCard({
  passed,
  onPassedChange,
  onSubmitInterviewResult,
}: {
  passed: boolean;
  onPassedChange: (checked: boolean) => void;
  onSubmitInterviewResult?: (passed: boolean) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!onSubmitInterviewResult) return;

    setSubmitting(true);
    try {
      await onSubmitInterviewResult(passed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-violet-400/60 bg-violet-50/50 rounded-md p-3 space-y-3 mb-4">
      <div className="flex items-center gap-2 font-bold text-sm border-b border-violet-400/60 pb-2">
        <span>&#128221;</span>
        <span>Faculty Interview Result</span>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={passed}
          disabled={submitting}
          onChange={(e) => {
            onPassedChange(e.target.checked);
          }}
          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="text-sm font-bold">
          Did the learner pass the interview?
        </span>
      </label>

      <Button
        className={`w-full font-bold ${
          passed
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-red-600 text-white hover:bg-red-700"
        }`}
        disabled={submitting}
        onClick={() => {
          void handleSubmit();
        }}>
        {submitting
          ? "Saving interview result..."
          : passed
            ? "Mark as Passed"
            : "Mark as Failed"}
      </Button>
    </div>
  );
}

export function SCPAssessmentBlock({
  applicant,
  onSaveStepResult,
  onSubmitInterviewResult,
  interviewPassChecked,
  onInterviewPassChange,
}: Props) {
  if (applicant.applicantType === "REGULAR") return null;

  const steps = applicant.assessmentSteps;
  const hasSteps = steps && steps.length > 0;

  return (
    <>
      <div className="border border-primary/50 bg-primary/8 rounded-md p-3 mb-4 space-y-2">
        <div className="flex items-center gap-2 font-bold border-b border-primary/50 pb-2 mb-2">
          <span>&#9889;</span>
          <span>{formatScpType(applicant.applicantType)} Assessment</span>
          {hasSteps && (
            <span className="ml-auto text-xs text-foreground font-bold">
              {steps.filter((s) => s.status === "COMPLETED").length}/
              {steps.length} completed
            </span>
          )}
        </div>

        {hasSteps ? (
          <div className="relative space-y-0">
            {steps.map((step, idx) => {
              // Determine if this PENDING step is locked behind unmet prerequisites
              const isLocked =
                step.status === "PENDING" &&
                steps
                  .filter(
                    (prev) =>
                      prev.stepOrder < step.stepOrder && prev.isRequired,
                  )
                  .some((prev) => prev.result !== "PASSED");
              const effectiveStatus = isLocked ? "LOCKED" : step.status;
              const cfg = STATUS_CONFIG[effectiveStatus];
              const Icon = cfg.icon;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.stepOrder} className="flex gap-3 pt-1">
                  {/* Vertical timeline */}
                  <div className="flex flex-col items-center">
                    <Icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                    {!isLast && (
                      <div className={`w-0.5 flex-1 min-h-4 ${cfg.line}`} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`flex-1 ${isLast ? "" : ""}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold ">
                        {step.label ||
                          ASSESSMENT_KIND_LABELS[step.kind as AssessmentKind] ||
                          step.kind}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[0.6rem] px-1.5 py-0 h-4 font-bold ${cfg.badge}`}>
                        {isLocked ? "LOCKED" : step.status}
                      </Badge>
                      {!step.isRequired && (
                        <span className="text-[0.6rem] text-foreground italic">
                          Optional
                        </span>
                      )}
                    </div>

                    {/* Details row */}
                    <div className="text-xs text-foreground mt-0.5 space-x-3">
                      {step.scheduledDate && (
                        <span>
                          {format(new Date(step.scheduledDate), "MMM dd, yyyy")}
                          {step.scheduledTime &&
                            ` at ${formatDisplayTime12Hour(step.scheduledTime)}`}
                        </span>
                      )}
                      {step.venue && <span>@ {step.venue}</span>}
                      {step.score !== null && (
                        <span className="font-bold text-foreground">
                          Score: {step.score}
                        </span>
                      )}
                      {step.result && (
                        <span className="font-bold text-foreground uppercase">
                          {step.result}
                        </span>
                      )}
                    </div>

                    {step.notes && (
                      <p className="text-xs italic text-foreground mt-0.5">
                        {step.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Fallback: legacy flat display for old data without pipeline steps */
          <div className="text-sm grid grid-cols-[110px_1fr] gap-1 font-bold">
            <span>Type:</span>
            <span className="uppercase">
              {applicant.assessmentType || "Not specified"}
            </span>

            <span>Date:</span>
            <span className="uppercase">
              {applicant.examDate
                ? format(new Date(applicant.examDate), "MMMM dd, yyyy")
                : "Not yet scheduled"}
            </span>

            {applicant.examVenue && (
              <>
                <span>Venue:</span>
                <span className="uppercase">{applicant.examVenue}</span>
              </>
            )}

            <span>Score/Result:</span>
            <span className="uppercase">
              {applicant.examScore !== null
                ? `${applicant.examScore} / 100`
                : applicant.examResult || "\u2014"}
            </span>

            {applicant.examNotes && (
              <>
                <span>Notes:</span>
                <span className="uppercase italic">{applicant.examNotes}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Inline Score Recording — separate card below */}
      {(applicant.status === "EXAM_SCHEDULED" ||
        applicant.status === "ASSESSMENT_TAKEN") &&
        hasSteps &&
        onSaveStepResult && (
          <InlineScoreCard steps={steps} onSave={onSaveStepResult} />
        )}

      {/* Interview Result Card — shown when interview is scheduled */}
      {applicant.status === "INTERVIEW_SCHEDULED" &&
        onSubmitInterviewResult && (
          <InterviewResultCard
            passed={interviewPassChecked ?? false}
            onPassedChange={onInterviewPassChange ?? (() => {})}
            onSubmitInterviewResult={onSubmitInterviewResult}
          />
        )}
    </>
  );
}
