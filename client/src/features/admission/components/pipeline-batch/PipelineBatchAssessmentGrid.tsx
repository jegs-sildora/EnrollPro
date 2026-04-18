import { useMemo } from "react";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { DataTable } from "@/shared/ui/data-table";
import type {
  Application,
  RankingFormulaComponent,
  ScoreRowState,
} from "./types";

interface PipelineBatchAssessmentGridProps {
  scoreGridLoading: boolean;
  selectedApplications: Application[];
  scoreComponents: RankingFormulaComponent[];
  scoreGridRows: Record<number, ScoreRowState>;
  isBatchProcessing: boolean;
  computeWeightedTotal: (row: ScoreRowState | undefined) => number | null;
  updateScoreCell: (applicantId: number, key: string, value: string) => void;
  updateScoreRemarks: (applicantId: number, value: string) => void;
  setAbsentNoShow: (applicantId: number, value: boolean) => void;
  isScoreValueInvalid: (
    applicantId: number,
    key: string,
    value: string,
  ) => boolean;
}

export default function PipelineBatchAssessmentGrid({
  scoreGridLoading,
  selectedApplications,
  scoreComponents,
  scoreGridRows,
  isBatchProcessing,
  computeWeightedTotal,
  updateScoreCell,
  updateScoreRemarks,
  setAbsentNoShow,
  isScoreValueInvalid,
}: PipelineBatchAssessmentGridProps) {
  const columns = useMemo<ColumnDef<Application>[]>(() => {
    const cols: ColumnDef<Application>[] = [
      {
        id: "applicant",
        header: "Applicant",
        cell: ({ row }) => {
          const applicant = row.original;
          return (
            <div className="space-y-1 text-left min-w-[220px]">
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
    ];

    scoreComponents.forEach((component) => {
      cols.push({
        id: component.key,
        header: () => (
          <div className="flex flex-col items-center gap-0.5 mx-auto">
            <span className="leading-tight">{component.label}</span>
            <span className="text-[10px] opacity-90">
              Weight: {component.weight}
            </span>
          </div>
        ),
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreRow = scoreGridRows[applicant.id];
          const scoreValue = scoreRow?.componentScores?.[component.key] ?? "";
          const absentNoShow = Boolean(scoreRow?.absentNoShow);
          const invalid = isScoreValueInvalid(
            applicant.id,
            component.key,
            scoreValue,
          );

          return (
            <div className="flex justify-center min-w-[170px]">
              <Input
                type="number"
                min={0}
                max={100}
                step="1"
                value={scoreValue}
                onChange={(event) =>
                  updateScoreCell(
                    applicant.id,
                    component.key,
                    event.target.value,
                  )
                }
                disabled={isBatchProcessing || absentNoShow}
                className={`h-8 w-24 text-center text-sm font-bold ${
                  invalid
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
              />
            </div>
          );
        },
      });
    });

    cols.push(
      {
        id: "absent",
        header: "Absent / No Show",
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreRow = scoreGridRows[applicant.id];
          const absentNoShow = Boolean(scoreRow?.absentNoShow);

          return (
            <div className="flex items-center justify-center gap-2 min-w-[150px]">
              <Checkbox
                checked={absentNoShow}
                onCheckedChange={(checked) =>
                  setAbsentNoShow(applicant.id, Boolean(checked))
                }
                disabled={isBatchProcessing}
              />
              <span className="text-xs font-bold text-foreground">Absent</span>
            </div>
          );
        },
      },
      {
        id: "total",
        header: "Weighted Total",
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreRow = scoreGridRows[applicant.id];
          const absentNoShow = Boolean(scoreRow?.absentNoShow);
          const total = computeWeightedTotal(scoreRow);

          return (
            <div className="flex justify-center min-w-[120px]">
              <span
                className={`text-sm font-bold ${
                  absentNoShow ? "text-destructive" : ""
                }`}>
                {total == null ? "--" : total.toFixed(2)}
              </span>
            </div>
          );
        },
      },
      {
        id: "remarks",
        header: "Remarks",
        cell: ({ row }) => {
          const applicant = row.original;
          const scoreRow = scoreGridRows[applicant.id];

          return (
            <div className="flex justify-center min-w-[220px]">
              <Input
                value={scoreRow?.remarks ?? ""}
                onChange={(event) =>
                  updateScoreRemarks(applicant.id, event.target.value)
                }
                placeholder="Optional notes"
                disabled={isBatchProcessing}
                className="h-8 text-sm font-bold w-full"
              />
            </div>
          );
        },
      },
    );

    return cols;
  }, [
    scoreComponents,
    scoreGridRows,
    isBatchProcessing,
    updateScoreCell,
    updateScoreRemarks,
    setAbsentNoShow,
    isScoreValueInvalid,
    computeWeightedTotal,
  ]);

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-xs font-bold text-foreground">
          Enter component scores per applicant. Weighted total is computed from
          the active ranking formula.
        </p>
      </div>

      {scoreGridLoading ? (
        <div className="rounded-lg border p-6 text-center text-sm font-bold text-foreground">
          Loading ranking formula...
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={selectedApplications}
          loading={scoreGridLoading}
          className="rounded-lg border overflow-auto min-h-0"
          noResultsMessage="No applicants loaded."
        />
      )}
    </div>
  );
}
