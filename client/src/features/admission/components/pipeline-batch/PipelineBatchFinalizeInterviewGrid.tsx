import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import type { Application, FinalizeInterviewRowState } from "./types";

interface PipelineBatchFinalizeInterviewGridProps {
  selectedApplications: Application[];
  finalizeInterviewRows: Record<number, FinalizeInterviewRowState>;
  isBatchProcessing: boolean;
  updateFinalizeRow: (
    applicantId: number,
    patch: Partial<FinalizeInterviewRowState>,
  ) => void;
}

export default function PipelineBatchFinalizeInterviewGrid({
  selectedApplications,
  finalizeInterviewRows,
  isBatchProcessing,
  updateFinalizeRow,
}: PipelineBatchFinalizeInterviewGridProps) {
  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-xs font-bold text-foreground">
          Encode interview decision per applicant. Rejected applicants can be
          marked as Not Qualified or Rejected.
        </p>
      </div>

      <div className="rounded-lg border overflow-auto min-h-0">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="sticky left-0 bg-muted/40 min-w-[220px] z-10 text-xs font-bold">
                Applicant
              </TableHead>
              <TableHead className="text-center min-w-[140px] text-xs font-bold">
                Interview Score
              </TableHead>
              <TableHead className="text-center min-w-[150px] text-xs font-bold">
                Decision
              </TableHead>
              <TableHead className="text-center min-w-[190px] text-xs font-bold">
                Reject Outcome
              </TableHead>
              <TableHead className="text-center min-w-[220px] text-xs font-bold">
                Remarks
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedApplications.map((applicant) => {
              const row = finalizeInterviewRows[applicant.id] ?? {
                interviewScore: "",
                decision: "PASS",
                rejectOutcome: "NOT_QUALIFIED",
                remarks: "",
              };

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

                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={row.interviewScore}
                      onChange={(event) =>
                        updateFinalizeRow(applicant.id, {
                          interviewScore: event.target.value,
                        })
                      }
                      disabled={isBatchProcessing}
                      className="h-8 text-center text-sm font-bold"
                    />
                  </TableCell>

                  <TableCell>
                    <Select
                      value={row.decision}
                      onValueChange={(value: "PASS" | "REJECT") =>
                        updateFinalizeRow(applicant.id, {
                          decision: value,
                          rejectOutcome:
                            value === "REJECT"
                              ? row.rejectOutcome
                              : "NOT_QUALIFIED",
                        })
                      }
                      disabled={isBatchProcessing}>
                      <SelectTrigger className="h-8 text-xs font-bold">
                        <SelectValue placeholder="Decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASS">Pass</SelectItem>
                        <SelectItem value="REJECT">Reject</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={row.rejectOutcome}
                      onValueChange={(value: "NOT_QUALIFIED" | "REJECTED") =>
                        updateFinalizeRow(applicant.id, {
                          rejectOutcome: value,
                        })
                      }
                      disabled={isBatchProcessing || row.decision !== "REJECT"}>
                      <SelectTrigger className="h-8 text-xs font-bold">
                        <SelectValue placeholder="Reject outcome" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOT_QUALIFIED">
                          Not Qualified
                        </SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    <Input
                      value={row.remarks}
                      onChange={(event) =>
                        updateFinalizeRow(applicant.id, {
                          remarks: event.target.value,
                        })
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
    </div>
  );
}
