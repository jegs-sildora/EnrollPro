import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
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
  selectedApplications: Application[];
  preflightSummary: PipelineBatchPreflightSummary | null;
  actionFormError: string | null;
  actionReadinessHint: string | null;
  derivedTargetStatus: string;
  isActionFormReady: boolean;
  actionSubmitCount: number;
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
  selectedApplications,
  preflightSummary,
  actionFormError,
  actionReadinessHint,
  derivedTargetStatus,
  isActionFormReady,
  actionSubmitCount,
  renderActionForm,
  onOpenChange,
  onCancel,
  onConfirm,
}: PipelineBatchActionDialogProps) {
  const [showSelectedApplicants, setShowSelectedApplicants] = useState(false);

  const selectedApplicantNames = useMemo(
    () =>
      selectedApplications.map((applicant) => {
        const middleInitial = applicant.middleName?.trim()
          ? ` ${applicant.middleName.trim().charAt(0).toUpperCase()}.`
          : "";
        const suffix = applicant.suffix?.trim()
          ? ` ${applicant.suffix.trim()}`
          : "";

        return `${applicant.lastName}, ${applicant.firstName}${middleInitial}${suffix}`;
      }),
    [selectedApplications],
  );

  const selectedLabel =
    selectedIdsSize === 1 ? "Selected Applicant" : "Selected Applicants";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setShowSelectedApplicants(false);
        }
        onOpenChange(nextOpen);
      }}>
      <DialogContent className="w-[94vw] max-w-[94vw] h-[88vh] overflow-hidden flex flex-col">
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

          <Collapsible
            open={showSelectedApplicants}
            onOpenChange={setShowSelectedApplicants}
            className="rounded-lg border border-border bg-muted/40">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-foreground hover:bg-muted/70 transition-colors">
                <span>
                  {showSelectedApplicants ? "Hide" : "View"} {selectedIdsSize}{" "}
                  {selectedLabel}
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${
                    showSelectedApplicants ? "rotate-180" : ""
                  }`}
                />
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t border-border bg-background/80 px-3 py-2">
                <div className="max-h-32 overflow-y-auto">
                  {selectedApplicantNames.length > 0 ? (
                    <p className="text-xs font-bold text-foreground leading-relaxed">
                      {selectedApplicantNames.join("; ")}
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-muted-foreground">
                      No applicants selected.
                    </p>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <p className="text-xs text-foreground font-bold">
              Current Batch Action
            </p>
            <p className="text-sm font-bold">
              {activeBatchAction?.buttonLabel ?? "No action available"}
            </p>
            <p className="text-xs font-bold text-foreground">
              Target status:{" "}
              {activeBatchAction?.id === "ASSIGN_REGULAR_SECTION"
                ? "ENROLLED / TEMPORARILY ENROLLED"
                : derivedTargetStatus.replaceAll("_", " ") || "N/A"}
            </p>
          </div>

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
                    <p key={reason} className="text-xs font-bold text-red-700">
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
                {activeBatchAction?.submitLabel ?? "Processing"}...
              </>
            ) : (
              `${activeBatchAction?.submitLabel ?? "Process"} (${actionSubmitCount})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
