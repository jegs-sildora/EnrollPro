import { useMemo } from "react";
import { Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DataTable } from "@/shared/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AcademicStatusValue,
  ChecklistFieldKey,
  VerifyGridApplicant,
  VerifyGridColumn,
} from "./types";

interface PipelineBatchVerifyGridProps {
  verifyGridLoading: boolean;
  verifyGridColumns: VerifyGridColumn[];
  verifyGridApplicants: VerifyGridApplicant[];
  verifyGridValues: Record<number, Record<ChecklistFieldKey, boolean>>;
  verifyAcademicStatuses: Record<number, AcademicStatusValue>;
  verifyLrnDrafts: Record<number, string>;
  lrnEditingId: number | null;
  savingLrnId: number | null;
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
  setVerifyRequiredDocsForRow: (applicantId: number, value: boolean) => void;
  setVerifyAcademicStatus: (
    applicantId: number,
    status: AcademicStatusValue,
  ) => void;
  setVerifyLrnDraft: (applicantId: number, value: string) => void;
  onStartLrnEdit: (applicantId: number) => void;
  onCancelLrnEdit: (applicantId: number) => void;
  onSaveLrn: (applicantId: number) => void;
}

export default function PipelineBatchVerifyGrid({
  verifyGridLoading,
  verifyGridColumns,
  verifyGridApplicants,
  verifyGridValues,
  verifyAcademicStatuses,
  verifyLrnDrafts,
  lrnEditingId,
  savingLrnId,
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
  setVerifyRequiredDocsForRow,
  setVerifyAcademicStatus,
  setVerifyLrnDraft,
  onStartLrnEdit,
  onCancelLrnEdit,
  onSaveLrn,
}: PipelineBatchVerifyGridProps) {
  const verificationCheckboxClassName =
    "border-emerald-400/80 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white";

  const getColumnHeaderLabel = (column: VerifyGridColumn) => {
    const labelByKey: Partial<Record<ChecklistFieldKey, string>> = {
      isSf9Submitted: "SF9 (Report Card)",
      isGoodMoralPresented: "Good Moral Cert.",
      isMedicalEvalSubmitted: "Medical Cert.",
      isPsaBirthCertPresented: "PSA Birth Cert.",
    };

    return labelByKey[column.key] ?? column.label;
  };

  const markedCount = verifyGridApplicants.reduce(
    (count, applicant) => count + (verifyRowsMarked[applicant.id] ? 1 : 0),
    0,
  );

  const columns = useMemo<ColumnDef<VerifyGridApplicant>[]>(() => {
    const cols: ColumnDef<VerifyGridApplicant>[] = [
      {
        id: "details",
        header: "Applicant Details",
        cell: ({ row }) => {
          const applicant = row.original;
          const isEditingLrn = lrnEditingId === applicant.id;
          const lrnDraft = verifyLrnDrafts[applicant.id] ?? applicant.lrn ?? "";
          const normalizedLrnDraft = lrnDraft.trim();
          const hasValidLrnDraft = /^\d{12}$/.test(normalizedLrnDraft);
          const hasChangedLrn =
            normalizedLrnDraft !== (applicant.lrn ?? "").trim();
          const requiredDocsChecked =
            applicant.requiredChecklistKeys.length > 0 &&
            applicant.requiredChecklistKeys.every((requiredKey) =>
              Boolean(verifyGridValues[applicant.id]?.[requiredKey]),
            );
          const academicStatus =
            verifyAcademicStatuses[applicant.id] ?? "PROMOTED";
          const isRetained = academicStatus === "RETAINED";

          return (
            <div className="space-y-1 text-left">
              <p className="text-xs font-bold uppercase leading-tight">
                {applicant.name}
              </p>
              <p className="text-[11px] font-bold text-foreground leading-tight">
                #{applicant.trackingNumber}
              </p>

              {!isEditingLrn ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-none">
                  <span className="font-bold text-foreground">
                    {applicant.lrn ? `LRN: ${applicant.lrn}` : "LRN: —"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={isBatchProcessing}
                    onClick={() => onStartLrnEdit(applicant.id)}
                    title="Edit LRN">
                    <Pencil className="size-3.5" />
                  </Button>
                  {applicant.isPendingLrnCreation && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Pending LRN
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    value={lrnDraft}
                    onChange={(event) =>
                      setVerifyLrnDraft(applicant.id, event.target.value)
                    }
                    className="h-7 w-36 text-[11px] font-bold"
                    placeholder="12-digit LRN"
                    maxLength={12}
                    disabled={isBatchProcessing || savingLrnId === applicant.id}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10px] font-bold"
                    disabled={
                      isBatchProcessing ||
                      savingLrnId === applicant.id ||
                      !hasValidLrnDraft ||
                      !hasChangedLrn
                    }
                    onClick={() => onSaveLrn(applicant.id)}>
                    {savingLrnId === applicant.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-1"
                    disabled={isBatchProcessing || savingLrnId === applicant.id}
                    onClick={() => onCancelLrnEdit(applicant.id)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-[10px] leading-none">
                <Checkbox
                  className={verificationCheckboxClassName}
                  checked={requiredDocsChecked}
                  onCheckedChange={(checked) =>
                    setVerifyRequiredDocsForRow(applicant.id, Boolean(checked))
                  }
                  onClick={(e) => e.stopPropagation()}
                  disabled={
                    isBatchProcessing ||
                    isRetained ||
                    applicant.requiredChecklistKeys.length === 0
                  }
                />
                <span
                  className={`font-bold ${
                    isRetained ? "text-muted-foreground" : "text-foreground"
                  }`}>
                  All required docs
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "academicStatus",
        header: "Academic Status",
        cell: ({ row }) => {
          const applicant = row.original;
          const academicStatus =
            verifyAcademicStatuses[applicant.id] ?? "PROMOTED";
          return (
            <Select
              value={academicStatus}
              onValueChange={(value) =>
                setVerifyAcademicStatus(
                  applicant.id,
                  value as AcademicStatusValue,
                )
              }
              disabled={isBatchProcessing}>
              <SelectTrigger className="h-8 w-full text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROMOTED">Promoted</SelectItem>
                <SelectItem value="RETAINED">Retained</SelectItem>
              </SelectContent>
            </Select>
          );
        },
      },
    ];

    verifyGridColumns.forEach((column) => {
      cols.push({
        id: column.key,
        header: () => {
          const columnChecked = isVerifyColumnFullyChecked(column.key);
          return (
            <div className="flex flex-col items-center gap-1 mx-auto">
              <span className="leading-tight">
                {getColumnHeaderLabel(column)}
                {column.isMandatory && (
                  <span className="ml-0.5 text-destructive">*</span>
                )}
              </span>
              <Checkbox
                className={verificationCheckboxClassName}
                checked={columnChecked}
                onCheckedChange={(checked) =>
                  setVerifyColumnForAll(column.key, Boolean(checked))
                }
                onClick={(e) => e.stopPropagation()}
                disabled={
                  isBatchProcessing || verifyGridApplicants.length === 0
                }
              />
            </div>
          );
        },
        cell: ({ row }) => {
          const applicant = row.original;
          const academicStatus =
            verifyAcademicStatuses[applicant.id] ?? "PROMOTED";
          const isRetained = academicStatus === "RETAINED";
          return (
            <div
              className={`flex items-center justify-center ${
                isRetained ? "opacity-50" : ""
              }`}>
              <Checkbox
                className={verificationCheckboxClassName}
                checked={Boolean(verifyGridValues[applicant.id]?.[column.key])}
                onCheckedChange={(checked) =>
                  setVerifyCell(applicant.id, column.key, Boolean(checked))
                }
                disabled={isBatchProcessing || isRetained}
              />
            </div>
          );
        },
      });
    });

    cols.push({
      id: "clearance",
      header: "Clearance",
      cell: ({ row }) => {
        const applicant = row.original;
        const academicStatus =
          verifyAcademicStatuses[applicant.id] ?? "PROMOTED";
        const isRetained = academicStatus === "RETAINED";
        const rowReady = isVerifyRowReady(applicant.id);
        const rowMarked = Boolean(verifyRowsMarked[applicant.id]);
        const clearanceDisabled =
          isBatchProcessing || (!isRetained && !rowReady);
        const clearanceClassName = isRetained
          ? rowMarked
            ? "border-amber-700 bg-amber-600 text-white"
            : "border-amber-300 bg-amber-100 text-amber-800"
          : rowMarked
            ? "border-emerald-700 bg-emerald-600 text-white"
            : rowReady
              ? "border-primary/90 bg-primary text-primary-foreground"
              : "border-border bg-muted/60 text-muted-foreground opacity-60";
        const clearanceLabel = isRetained
          ? rowMarked
            ? "Retained Tagged"
            : "Mark Retained"
          : rowMarked
            ? "Cleared"
            : "Mark Verified";

        return (
          <div
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 transition-colors mx-auto ${clearanceClassName} ${
              clearanceDisabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}>
            <Checkbox
              className={verificationCheckboxClassName}
              checked={rowMarked}
              onCheckedChange={(checked) =>
                setVerifyRowMarked(applicant.id, Boolean(checked))
              }
              onClick={(e) => e.stopPropagation()}
              disabled={clearanceDisabled}
            />
            <span className="text-[11px] font-bold whitespace-nowrap">
              {clearanceLabel}
            </span>
          </div>
        );
      },
    });

    return cols;
  }, [
    verifyGridColumns,
    verifyGridApplicants,
    verifyGridValues,
    verifyAcademicStatuses,
    verifyLrnDrafts,
    lrnEditingId,
    savingLrnId,
    verifyRowsMarked,
    isBatchProcessing,
    onStartLrnEdit,
    onCancelLrnEdit,
    onSaveLrn,
    setVerifyLrnDraft,
    setVerifyRequiredDocsForRow,
    setVerifyAcademicStatus,
    setVerifyCell,
    setVerifyRowMarked,
    isVerifyColumnFullyChecked,
    setVerifyColumnForAll,
    isVerifyRowReady,
  ]);

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground">
          Clearance marked: {markedCount}/{verifyGridApplicants.length}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
            <Checkbox
              className={verificationCheckboxClassName}
              checked={verifyAllChecked}
              onCheckedChange={(checked) => setVerifyAll(Boolean(checked))}
              onClick={(e) => e.stopPropagation()}
              disabled={
                isBatchProcessing ||
                verifyGridApplicants.length === 0 ||
                verifyGridColumns.length === 0
              }
            />
            <span className="text-[11px] font-bold text-foreground leading-none">
              Toggle all docs
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
        <DataTable
          columns={columns}
          data={verifyGridApplicants}
          loading={verifyGridLoading}
          className="rounded-lg border overflow-auto min-h-0 relative"
          tableClassName="table-fixed min-w-[1180px]"
          noResultsMessage="No applicants loaded for verification."
        />
      )}
    </div>
  );
}
