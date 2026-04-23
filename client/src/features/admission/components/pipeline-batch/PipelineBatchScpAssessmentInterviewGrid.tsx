import { useCallback, useMemo, useRef } from "react";
import { CheckCircle2, Minus, XCircle } from "lucide-react";
import { Checkbox } from "@/shared/ui/checkbox";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { DataTable } from "@/shared/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { Application } from "./types";

interface PipelineBatchScpAssessmentInterviewGridProps {
  loading: boolean;
  selectedApplications: Application[];
  isBatchProcessing: boolean;
  mode: "RECORD_ASSESSMENT" | "FINALIZE_PHASE_ONE";
  assessmentCutoffScore: number | null;
  getScoreValue: (applicantId: number, applicant: Application) => string;
  getAbsentNoShow: (applicantId: number) => boolean;
  onScoreChange: (applicantId: number, value: string) => void;
  onAbsentNoShowChange: (applicantId: number, value: boolean) => void;
  isScoreInvalid: (value: string) => boolean;
  getInterviewDecision: (applicantId: number) => "PASS" | "REJECT" | null;
  onInterviewDecisionChange: (
    applicantId: number,
    decision: "PASS" | "REJECT",
  ) => void;
}

export default function PipelineBatchScpAssessmentInterviewGrid({
  loading,
  selectedApplications,
  isBatchProcessing,
  mode,
  assessmentCutoffScore,
  getScoreValue,
  getAbsentNoShow,
  onScoreChange,
  onAbsentNoShowChange,
  isScoreInvalid,
  getInterviewDecision,
  onInterviewDecisionChange,
}: PipelineBatchScpAssessmentInterviewGridProps) {
  const isAssessmentMode = mode === "RECORD_ASSESSMENT";
  const scoreInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const hasConfiguredCutoffScore =
    assessmentCutoffScore != null && Number.isFinite(assessmentCutoffScore);
  const scoreHeaderLabel = isAssessmentMode
    ? `Score (Cut-off: ${hasConfiguredCutoffScore ? assessmentCutoffScore : "Not set"})`
    : "Recorded Assessment Score";

  const handleScoreChange = useCallback(
    (applicantId: number, value: string) => {
      onScoreChange(applicantId, value);

      requestAnimationFrame(() => {
        if (!isAssessmentMode) return;
        const input = scoreInputRefs.current[applicantId];
        if (!input || input.disabled) return;
        if (document.activeElement !== input) {
          input.focus();
        }
      });
    },
    [isAssessmentMode, onScoreChange],
  );

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [
      {
        id: "applicant",
        header: "Name",
        cell: ({ row }) => {
          const applicant = row.original;
          return (
            <div className="space-y-1 text-left min-w-[240px]">
              <p className="text-xs font-bold uppercase leading-tight">
                {applicant.lastName}, {applicant.firstName}
              </p>
              <p className="text-[11px] font-bold text-foreground leading-tight">
                #{applicant.trackingNumber}
              </p>
            </div>
          );
        },
      },
      {
        id: "score",
        header: scoreHeaderLabel,
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreValue = getScoreValue(applicant.id, applicant);
          const absentNoShow = getAbsentNoShow(applicant.id);
          const normalizedScore = scoreValue.trim();
          const numericScore = Number(normalizedScore);
          const hasNumericScore =
            normalizedScore.length > 0 && Number.isFinite(numericScore);
          const scoreInvalid = isAssessmentMode
            ? !absentNoShow &&
              normalizedScore.length > 0 &&
              isScoreInvalid(scoreValue)
            : false;

          const isPassed =
            isAssessmentMode &&
            !absentNoShow &&
            hasNumericScore &&
            hasConfiguredCutoffScore &&
            !scoreInvalid &&
            numericScore >= Number(assessmentCutoffScore ?? 0);
          const isFailed =
            isAssessmentMode &&
            !absentNoShow &&
            hasNumericScore &&
            hasConfiguredCutoffScore &&
            !scoreInvalid &&
            numericScore < Number(assessmentCutoffScore ?? 0);

          let scoreInputToneClass = "";
          if (scoreInvalid) {
            scoreInputToneClass =
              "border-destructive text-destructive focus-visible:ring-destructive";
          } else if (isPassed) {
            scoreInputToneClass =
              "border-emerald-500 text-emerald-700 focus-visible:ring-emerald-500";
          } else if (isFailed) {
            scoreInputToneClass =
              "border-destructive text-destructive focus-visible:ring-destructive";
          }

          return (
            <div className="space-y-1.5 min-w-[280px]">
              <Input
                ref={(node) => {
                  scoreInputRefs.current[applicant.id] = node;
                }}
                type="number"
                min={0}
                max={100}
                step="1"
                value={scoreValue}
                onChange={(event) => {
                  handleScoreChange(applicant.id, event.target.value);
                }}
                readOnly={!isAssessmentMode}
                disabled={
                  isBatchProcessing || !isAssessmentMode || absentNoShow
                }
                placeholder={isAssessmentMode ? "0 - 100" : "No score encoded"}
                className={`h-8 text-center text-sm font-bold ${scoreInputToneClass}`}
              />

              {isAssessmentMode && (
                <label className="inline-flex items-center gap-2 text-[11px] font-bold text-foreground mx-auto">
                  <Checkbox
                    checked={absentNoShow}
                    onCheckedChange={(checked) =>
                      onAbsentNoShowChange(applicant.id, Boolean(checked))
                    }
                    disabled={isBatchProcessing}
                  />
                  Absent / No-Show
                </label>
              )}
            </div>
          );
        },
      },
    ];

    if (isAssessmentMode) {
      cols.push({
        id: "remarks",
        header: "Remarks",
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreValue = getScoreValue(applicant.id, applicant);
          const absentNoShow = getAbsentNoShow(applicant.id);
          const normalizedScore = scoreValue.trim();
          const numericScore = Number(normalizedScore);
          const hasNumericScore =
            normalizedScore.length > 0 && Number.isFinite(numericScore);
          const scoreInvalid =
            !absentNoShow &&
            normalizedScore.length > 0 &&
            isScoreInvalid(scoreValue);

          const isPassed =
            !absentNoShow &&
            hasNumericScore &&
            hasConfiguredCutoffScore &&
            !scoreInvalid &&
            numericScore >= Number(assessmentCutoffScore ?? 0);
          const isFailed =
            !absentNoShow &&
            hasNumericScore &&
            hasConfiguredCutoffScore &&
            !scoreInvalid &&
            numericScore < Number(assessmentCutoffScore ?? 0);

          const renderAssessmentRemark = () => {
            if (absentNoShow) {
              return (
                <Badge className="h-6 gap-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">
                  <XCircle className="size-3.5" />
                  No-Show
                </Badge>
              );
            }

            if (scoreInvalid) {
              return (
                <Badge className="h-6 gap-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">
                  <XCircle className="size-3.5" />
                  Invalid
                </Badge>
              );
            }

            if (isPassed) {
              return (
                <Badge className="h-6 gap-1 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  <CheckCircle2 className="size-3.5" />
                  Passed
                </Badge>
              );
            }

            if (isFailed) {
              return (
                <Badge className="h-6 gap-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">
                  <XCircle className="size-3.5" />
                  Failed
                </Badge>
              );
            }

            return (
              <Badge className="h-6 gap-1 rounded-full bg-muted text-muted-foreground hover:bg-muted">
                <Minus className="size-3.5" />
                Pending
              </Badge>
            );
          };

          return (
            <div className="flex items-center justify-center min-w-[200px]">
              {renderAssessmentRemark()}
            </div>
          );
        },
      });
    } else {
      cols.push({
        id: "interview",
        header: "Did the learner pass the interview?",
        cell: ({ row }) => {
          const applicant = row.original;
          const decision = getInterviewDecision(applicant.id);
          const yesChecked = decision === "PASS";
          const noChecked = decision === "REJECT";

          return (
            <div className="flex items-center justify-center gap-5 min-w-[270px]">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <Checkbox
                  checked={yesChecked}
                  onCheckedChange={(checked) => {
                    if (!isAssessmentMode && checked) {
                      onInterviewDecisionChange(applicant.id, "PASS");
                    }
                  }}
                  disabled={isBatchProcessing || isAssessmentMode}
                />
                Yes
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <Checkbox
                  checked={noChecked}
                  onCheckedChange={(checked) => {
                    if (!isAssessmentMode && checked) {
                      onInterviewDecisionChange(applicant.id, "REJECT");
                    }
                  }}
                  disabled={isBatchProcessing || isAssessmentMode}
                />
                No
              </label>
            </div>
          );
        },
      });
    }

    return cols;
  }, [
    isAssessmentMode,
    handleScoreChange,
    scoreHeaderLabel,
    getScoreValue,
    getAbsentNoShow,
    isScoreInvalid,
    assessmentCutoffScore,
    hasConfiguredCutoffScore,
    isBatchProcessing,
    getInterviewDecision,
    onAbsentNoShowChange,
    onInterviewDecisionChange,
  ]);

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-xs font-bold text-foreground">
          {isAssessmentMode
            ? "Record assessment scores for each learner. Remarks will update live based on the configured SCP cut-off score."
            : "Finalize interview outcomes per learner. Assessment score is shown as reference from encoded assessment results."}
        </p>
      </div>

      <div className="rounded-lg border overflow-auto min-h-0 relative">
        <DataTable
          columns={columns}
          data={selectedApplications}
          loading={loading}
          className="rounded-lg border overflow-auto min-h-0 relative"
          noResultsMessage="No applicants loaded."
        />
      </div>
    </div>
  );
}
