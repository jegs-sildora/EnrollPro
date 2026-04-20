import { useCallback, useMemo, useRef } from "react";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table";
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
  const scoreInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleInterviewScoreChange = useCallback(
    (applicantId: number, value: string) => {
      updateFinalizeRow(applicantId, {
        interviewScore: value,
      });

      requestAnimationFrame(() => {
        const input = scoreInputRefs.current[applicantId];
        if (!input || input.disabled) return;
        if (document.activeElement !== input) {
          input.focus();
        }
      });
    },
    [updateFinalizeRow],
  );

  const columns = useMemo<ColumnDef<Application>[]>(() => {
    return [
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
      {
        id: "score",
        header: "Interview Score",
        cell: ({ row }) => {
          const applicant = row.original;
          const rowData = finalizeInterviewRows[applicant.id] ?? {
            interviewScore: "",
            decision: "PASS",
            rejectOutcome: "SUBMITTED_BEERF",
            remarks: "",
          };
          return (
            <div className="flex justify-center min-w-[140px]">
              <Input
                ref={(node) => {
                  scoreInputRefs.current[applicant.id] = node;
                }}
                type="number"
                min={0}
                max={100}
                step="1"
                value={rowData.interviewScore}
                onChange={(event) => {
                  handleInterviewScoreChange(applicant.id, event.target.value);
                }}
                disabled={isBatchProcessing}
                className="h-8 w-24 text-center text-sm font-bold"
              />
            </div>
          );
        },
      },
      {
        id: "decision",
        header: "Decision",
        cell: ({ row }) => {
          const applicant = row.original;
          const rowData = finalizeInterviewRows[applicant.id] ?? {
            interviewScore: "",
            decision: "PASS",
            rejectOutcome: "SUBMITTED_BEERF",
            remarks: "",
          };
          return (
            <div className="flex justify-center min-w-[150px]">
              <Select
                value={rowData.decision}
                onValueChange={(value: "PASS" | "REJECT") =>
                  updateFinalizeRow(applicant.id, {
                    decision: value,
                    rejectOutcome:
                      value === "REJECT"
                        ? rowData.rejectOutcome
                        : "SUBMITTED_BEERF",
                  })
                }
                disabled={isBatchProcessing}>
                <SelectTrigger className="h-8 w-32 text-xs font-bold">
                  <SelectValue placeholder="Decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">Pass</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "outcome",
        header: "Reject Outcome",
        cell: ({ row }) => {
          const applicant = row.original;
          const rowData = finalizeInterviewRows[applicant.id] ?? {
            interviewScore: "",
            decision: "PASS",
            rejectOutcome: "SUBMITTED_BEERF",
            remarks: "",
          };
          return (
            <div className="flex justify-center min-w-[190px]">
              <Select
                value={rowData.rejectOutcome}
                onValueChange={(value: "SUBMITTED_BEERF" | "REJECTED") =>
                  updateFinalizeRow(applicant.id, {
                    rejectOutcome: value,
                  })
                }
                disabled={isBatchProcessing || rowData.decision !== "REJECT"}>
                <SelectTrigger className="h-8 w-full text-xs font-bold">
                  <SelectValue placeholder="Reject outcome" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUBMITTED_BEERF">
                    Submitted BEERF (Regular Intake)
                  </SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        },
      },
      {
        id: "remarks",
        header: "Remarks",
        cell: ({ row }) => {
          const applicant = row.original;
          const rowData = finalizeInterviewRows[applicant.id] ?? {
            interviewScore: "",
            decision: "PASS",
            rejectOutcome: "SUBMITTED_BEERF",
            remarks: "",
          };
          return (
            <div className="flex justify-center min-w-[220px]">
              <Input
                value={rowData.remarks}
                onChange={(event) =>
                  updateFinalizeRow(applicant.id, {
                    remarks: event.target.value,
                  })
                }
                placeholder="Optional notes"
                disabled={isBatchProcessing}
                className="h-8 text-sm font-bold w-full"
              />
            </div>
          );
        },
      },
    ];
  }, [
    finalizeInterviewRows,
    isBatchProcessing,
    updateFinalizeRow,
    handleInterviewScoreChange,
  ]);

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-xs font-bold text-foreground">
          Encode interview decision per applicant. Rejected applicants can be
          rerouted to Submitted BEERF (regular intake) or fully Rejected.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={selectedApplications}
        className="rounded-lg border overflow-auto min-h-0"
        noResultsMessage="No applicants loaded."
      />
    </div>
  );
}
