import { useMemo } from "react";
import { Loader2, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { DataTable } from "@/shared/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  ChecklistFieldKey,
  VerifyGridApplicant,
  VerifyGridColumn,
} from "./types";

interface PipelineBatchVerifyGridProps {
  disableDocumentChecks?: boolean;
  verifyGridLoading: boolean;
  verifyGridColumns: VerifyGridColumn[];
  verifyGridApplicants: VerifyGridApplicant[];
  verifyGridValues: Record<number, Record<ChecklistFieldKey, boolean>>;
  verifyLrnDrafts: Record<number, string>;
  lrnEditingId: number | null;
  savingLrnId: number | null;
  verifyAllChecked: boolean;
  isBatchProcessing: boolean;
  onReload: () => void;
  isVerifyRowReady: (applicantId: number) => boolean;
  isVerifyColumnFullyChecked: (key: ChecklistFieldKey) => boolean;
  setVerifyColumnForAll: (key: ChecklistFieldKey, value: boolean) => void;
  setVerifyAll: (value: boolean) => void;
  setVerifyCell: (
    applicantId: number,
    key: ChecklistFieldKey,
    value: boolean,
  ) => void;
  setVerifyRequiredDocsForRow: (applicantId: number, value: boolean) => void;
  setVerifyLrnDraft: (applicantId: number, value: string) => void;
  onStartLrnEdit: (applicantId: number) => void;
  onCancelLrnEdit: (applicantId: number) => void;
  onSaveLrn: (applicantId: number) => void;
}

export default function PipelineBatchVerifyGrid({
  disableDocumentChecks = false,
  verifyGridLoading,
  verifyGridColumns,
  verifyGridApplicants,
  verifyGridValues,
  verifyLrnDrafts,
  lrnEditingId,
  savingLrnId,
  verifyAllChecked,
  isBatchProcessing,
  onReload,
  isVerifyRowReady,
  isVerifyColumnFullyChecked,
  setVerifyColumnForAll,
  setVerifyAll,
  setVerifyCell,
  setVerifyRequiredDocsForRow,
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

  const clearedCount = verifyGridApplicants.filter((applicant) =>
    isVerifyRowReady(applicant.id),
  ).length;

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
                    title="Edit LRN"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  {applicant.isPendingLrnCreation && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">
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
                    className="h-7 px-2 text-xs font-bold"
                    disabled={
                      isBatchProcessing ||
                      savingLrnId === applicant.id ||
                      !hasValidLrnDraft ||
                      !hasChangedLrn
                    }
                    onClick={() => onSaveLrn(applicant.id)}
                  >
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
                    onClick={() => onCancelLrnEdit(applicant.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs leading-none">
                {!disableDocumentChecks && (
                  <>
                    <Checkbox
                      className={verificationCheckboxClassName}
                      checked={requiredDocsChecked}
                      onCheckedChange={(checked) =>
                        setVerifyRequiredDocsForRow(
                          applicant.id,
                          Boolean(checked),
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      disabled={
                        isBatchProcessing ||
                        applicant.requiredChecklistKeys.length === 0
                      }
                    />
                    <span className="font-bold text-foreground">
                      All required docs
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        },
      },
    ];

    if (!disableDocumentChecks) {
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
            return (
              <div className="flex items-center justify-center">
                <Checkbox
                  className={verificationCheckboxClassName}
                  checked={Boolean(
                    verifyGridValues[applicant.id]?.[column.key],
                  )}
                  onCheckedChange={(checked) =>
                    setVerifyCell(applicant.id, column.key, Boolean(checked))
                  }
                  disabled={isBatchProcessing}
                />
              </div>
            );
          },
        });
      });
    }

    cols.push({
      id: "clearance",
      header: "Clearance",
      cell: ({ row }) => {
        const applicant = row.original;
        const cleared = isVerifyRowReady(applicant.id);

        if (cleared) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 whitespace-nowrap">
              ✔ Cleared
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 whitespace-nowrap">
            ⏳ Pending
          </span>
        );
      },
    });

    return cols;
  }, [
    verifyGridColumns,
    verifyGridApplicants,
    verifyGridValues,
    verifyLrnDrafts,
    lrnEditingId,
    savingLrnId,
    isBatchProcessing,
    onStartLrnEdit,
    onCancelLrnEdit,
    onSaveLrn,
    setVerifyLrnDraft,
    setVerifyRequiredDocsForRow,
    setVerifyCell,
    isVerifyColumnFullyChecked,
    setVerifyColumnForAll,
    isVerifyRowReady,
    disableDocumentChecks,
  ]);

  return (
    <div className="space-y-3 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground">
          {disableDocumentChecks ? "Processed" : "Fully Verified"}:{" "}
          {clearedCount}/{verifyGridApplicants.length}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {!disableDocumentChecks && (
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
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={onReload}
            disabled={isBatchProcessing || verifyGridLoading}
          >
            {verifyGridLoading ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="size-3.5 mr-1.5" />
            )}
            Reload
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={verifyGridApplicants}
        loading={verifyGridLoading}
        className="rounded-lg border overflow-auto min-h-0 relative"
        tableClassName={
          disableDocumentChecks
            ? "table-fixed min-w-[760px]"
            : "table-fixed min-w-[1180px]"
        }
        noResultsMessage="No applicants loaded for verification."
      />
    </div>
  );
}
