import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import type { RegistrationBatchActionConfig } from "@/features/admission/constants/registrationWorkflow";
import type { Application } from "./types";

interface PipelineBatchPreflightSummary {
  eligible: Application[];
  ineligible: Array<{ app: Application; reason: string }>;
  reasonGroups: Record<string, number>;
}

interface PipelineBatchActionDialogProps {
  open: boolean;
  isBatchProcessing: boolean;
  activeBatchAction: RegistrationBatchActionConfig | null;
  selectedIdsSize: number;
  preflightSummary: PipelineBatchPreflightSummary | null;
  actionFormError: string | null;
  actionReadinessHint: string | null;
  isActionFormReady: boolean;
  actionSubmitCount: number;
  /** Task-oriented metrics shown when the action is VERIFY_DOCUMENTS */
  verifyMetrics: { total: number; fullyVerified: number; pending: number } | null;
  renderActionForm: () => ReactNode;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function PipelineBatchActionDialog({
  open,
  isBatchProcessing,
  activeBatchAction,
  selectedIdsSize,
  preflightSummary,
  actionFormError,
  actionReadinessHint,
  isActionFormReady,
  actionSubmitCount,
  verifyMetrics,
  renderActionForm,
  onOpenChange,
  onCancel,
  onConfirm,
}: PipelineBatchActionDialogProps) {

  const isVerifyMode = activeBatchAction?.id === "VERIFY_DOCUMENTS";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[80vw] max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            {activeBatchAction?.modalTitle ?? "Batch Action"}
          </DialogTitle>
          <DialogDescription className="text-sm font-bold">
            {activeBatchAction?.modalDescription ??
              "Review selected applicants before batch processing."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
          {/* Metrics header — task-oriented for VERIFY_DOCUMENTS, preflight otherwise */}
          {isVerifyMode && verifyMetrics ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-xs text-foreground font-bold">Total Applicants</p>
                <p className="text-lg font-bold">{verifyMetrics.total}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs text-emerald-700 font-bold">Fully Verified</p>
                <p className="text-lg font-bold text-emerald-700">{verifyMetrics.fullyVerified}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-700 font-bold">Pending</p>
                <p className="text-lg font-bold text-amber-700">{verifyMetrics.pending}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-xs text-foreground font-bold">Selected</p>
                <p className="text-lg font-bold">{selectedIdsSize}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-xs text-emerald-700 font-bold">Eligible</p>
                <p className="text-lg font-bold text-emerald-700">
                  {preflightSummary?.eligible.length ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs text-red-700 font-bold">Blocked</p>
                <p className="text-lg font-bold text-red-700">
                  {preflightSummary?.ineligible.length ?? 0}
                </p>
              </div>
            </div>
          )}

          {actionFormError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-bold text-destructive">
                {actionFormError}
              </p>
            </div>
          )}

          {!actionFormError && actionReadinessHint && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="text-xs font-bold text-amber-800">
                {actionReadinessHint}
              </p>
            </div>
          )}

          {renderActionForm()}

          {preflightSummary && preflightSummary.ineligible.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50/30 p-3 space-y-2">
              <p className="text-sm font-bold text-red-700">Blocked groups</p>
              <div className="space-y-1 max-h-32 overflow-auto">
                {Object.entries(preflightSummary.reasonGroups).map(
                  ([reason, count]) => (
                    <p
                      key={reason}
                      className="text-xs font-bold text-red-700">
                      {count}x {reason}
                    </p>
                  ),
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isBatchProcessing}
            className="font-bold">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              isBatchProcessing ||
              !activeBatchAction ||
              !isActionFormReady ||
              actionSubmitCount === 0
            }
            className="font-bold">
            {isBatchProcessing ? (
              <>
                <Loader2 className="size-4 animate-spin mr-1.5" />
                {isVerifyMode ? "Saving" : (activeBatchAction?.submitLabel ?? "Processing")}...
              </>
            ) : isVerifyMode ? (
              `Save Verifications (${actionSubmitCount})`
            ) : (
              `${activeBatchAction?.submitLabel ?? "Process"} (${actionSubmitCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
