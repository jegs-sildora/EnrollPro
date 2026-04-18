import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
        <div className="rounded-lg border overflow-auto min-h-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="sticky left-0 bg-muted/40 min-w-[220px] z-10 text-xs font-bold">
                  Applicant
                </TableHead>
                {scoreComponents.map((component) => (
                  <TableHead
                    key={component.key}
                    className="text-center min-w-[170px] text-xs font-bold">
                    {component.label}
                    <span className="block text-[10px] text-foreground">
                      Weight: {component.weight}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[150px] text-xs font-bold">
                  Absent / No Show
                </TableHead>
                <TableHead className="text-center min-w-[120px] text-xs font-bold">
                  Weighted Total
                </TableHead>
                <TableHead className="text-center min-w-[220px] text-xs font-bold">
                  Remarks
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedApplications.map((applicant) => {
                const row = scoreGridRows[applicant.id];
                const absentNoShow = Boolean(row?.absentNoShow);
                const total = computeWeightedTotal(row);

                return (
                  <TableRow key={applicant.id}>
                    <TableCell className="sticky left-0 bg-background z-10 min-w-[220px]">
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase">
                          {applicant.lastName}, {applicant.firstName}
                        </p>
                        <p className="text-[11px] font-bold text-foreground">
                          #{applicant.trackingNumber}
                        </p>
                      </div>
                    </TableCell>

                    {scoreComponents.map((component) => {
                      const scoreValue =
                        row?.componentScores?.[component.key] ?? "";
                      const invalid = isScoreValueInvalid(
                        applicant.id,
                        component.key,
                        scoreValue,
                      );

                      return (
                        <TableCell key={`${applicant.id}-${component.key}`}>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={scoreValue}
                            onChange={(event) =>
                              updateScoreCell(
                                applicant.id,
                                component.key,
                                event.target.value,
                              )
                            }
                            disabled={isBatchProcessing || absentNoShow}
                            className={`h-8 text-center text-sm font-bold ${
                              invalid
                                ? "border-destructive focus-visible:ring-destructive"
                                : ""
                            }`}
                          />
                        </TableCell>
                      );
                    })}

                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox
                          checked={absentNoShow}
                          onCheckedChange={(checked) =>
                            setAbsentNoShow(applicant.id, Boolean(checked))
                          }
                          disabled={isBatchProcessing}
                        />
                        <span className="text-xs font-bold text-foreground">
                          Absent
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <span
                        className={`text-sm font-bold ${
                          absentNoShow ? "text-destructive" : ""
                        }`}>
                        {total == null ? "--" : total.toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row?.remarks ?? ""}
                        onChange={(event) =>
                          updateScoreRemarks(applicant.id, event.target.value)
                        }
                        placeholder="Optional notes"
                        disabled={isBatchProcessing}
                        className="h-8 text-sm font-bold"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
