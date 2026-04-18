import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
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
  ChecklistFieldKey,
  VerifyGridApplicant,
  VerifyGridColumn,
} from "./types";

interface PipelineBatchVerifyGridProps {
  verifyGridLoading: boolean;
  verifyGridColumns: VerifyGridColumn[];
  verifyGridApplicants: VerifyGridApplicant[];
  verifyGridValues: Record<number, Record<ChecklistFieldKey, boolean>>;
  verifyRowsMarked: Record<number, boolean>;
  verifyAllChecked: boolean;
  isBatchProcessing: boolean;
  onReload: () => void;
  isVerifyRowReady: (applicantId: number) => boolean;
  setVerifyRowMarked: (applicantId: number, value: boolean) => void;
  isVerifyColumnFullyChecked: (key: ChecklistFieldKey) => boolean;
  setVerifyColumnForAll: (key: ChecklistFieldKey, value: boolean) => void;
  setVerifyAll: (value: boolean) => void;
  setVerifyCell: (
    applicantId: number,
    key: ChecklistFieldKey,
    value: boolean,
  ) => void;
}

export default function PipelineBatchVerifyGrid({
  verifyGridLoading,
  verifyGridColumns,
  verifyGridApplicants,
  verifyGridValues,
  verifyRowsMarked,
  verifyAllChecked,
  isBatchProcessing,
  onReload,
  isVerifyRowReady,
  setVerifyRowMarked,
  isVerifyColumnFullyChecked,
  setVerifyColumnForAll,
  setVerifyAll,
  setVerifyCell,
}: PipelineBatchVerifyGridProps) {
  const markedCount = verifyGridApplicants.reduce(
    (count, applicant) => count + (verifyRowsMarked[applicant.id] ? 1 : 0),
    0,
  );

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground space-y-0.5">
          <span className="block">
            Mark document checklist per applicant. Mandatory columns are
            highlighted.
          </span>
          <span className="block text-[11px]">
            Marked as verified: {markedCount}/{verifyGridApplicants.length}
          </span>
        </p>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <Checkbox
              checked={verifyAllChecked}
              onCheckedChange={(checked) => setVerifyAll(Boolean(checked))}
              disabled={
                isBatchProcessing ||
                verifyGridApplicants.length === 0 ||
                verifyGridColumns.length === 0
              }
            />
            <span className="text-[11px] font-bold text-foreground">
              Toggle all checklist cells
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={onReload}
            disabled={isBatchProcessing || verifyGridLoading}>
            {verifyGridLoading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Reload
          </Button>
        </div>
      </div>

      {verifyGridLoading ? (
        <div className="rounded-lg border p-6 text-center text-sm font-bold text-foreground">
          Loading checklist matrix...
        </div>
      ) : (
        <div className="rounded-lg border overflow-auto min-h-0 relative">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="sticky left-0 z-[90] bg-muted/40 min-w-[220px] shadow-[2px_0_0_0_hsl(var(--border))]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Applicant</span>
                    <Badge variant="secondary" className="text-[10px]">
                      Row Gate
                    </Badge>
                  </div>
                </TableHead>

                {verifyGridColumns.map((column) => {
                  const columnChecked = isVerifyColumnFullyChecked(column.key);

                  return (
                    <TableHead
                      key={column.key}
                      className="text-center min-w-[170px] text-xs font-bold z-[85] bg-muted/40">
                      <span className="block">{column.label}</span>

                      {column.isMandatory && (
                        <span className="block text-[10px] font-bold text-primary">
                          Required
                        </span>
                      )}

                      <div className="mt-1 flex items-center justify-center gap-2">
                        <Checkbox
                          checked={columnChecked}
                          onCheckedChange={(checked) =>
                            setVerifyColumnForAll(column.key, Boolean(checked))
                          }
                          disabled={isBatchProcessing}
                        />
                        <span className="text-[10px] font-bold text-foreground">
                          Toggle column
                        </span>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>

            <TableBody>
              {verifyGridApplicants.map((applicant) => {
                const rowReady = isVerifyRowReady(applicant.id);
                const rowMarked = Boolean(verifyRowsMarked[applicant.id]);

                return (
                  <TableRow key={applicant.id}>
                    <TableCell className="sticky left-0 bg-background z-[80] shadow-[2px_0_0_0_hsl(var(--border))] min-w-[220px]">
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase">
                          {applicant.name}
                        </p>
                        <p className="text-[11px] font-bold text-foreground">
                          #{applicant.trackingNumber}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Checkbox
                            checked={rowMarked}
                            onCheckedChange={(checked) =>
                              setVerifyRowMarked(applicant.id, Boolean(checked))
                            }
                            disabled={isBatchProcessing || !rowReady}
                          />
                          <span
                            className={`text-[10px] font-bold ${
                              rowReady ? "text-emerald-700" : "text-foreground"
                            }`}>
                            {rowReady
                              ? "Mark as Verified"
                              : "Complete required docs first"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {verifyGridColumns.map((column) => {
                      const required = applicant.requiredChecklistKeys.includes(
                        column.key,
                      );

                      return (
                        <TableCell
                          key={`${applicant.id}-${column.key}`}
                          className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Checkbox
                              checked={Boolean(
                                verifyGridValues[applicant.id]?.[column.key],
                              )}
                              onCheckedChange={(checked) =>
                                setVerifyCell(
                                  applicant.id,
                                  column.key,
                                  Boolean(checked),
                                )
                              }
                              disabled={isBatchProcessing}
                            />
                            {required && (
                              <span className="text-[10px] font-bold text-primary">
                                Required
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
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
