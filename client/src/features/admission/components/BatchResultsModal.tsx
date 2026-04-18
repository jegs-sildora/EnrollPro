import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { REGISTRATION_STAGE_QUICK_FILTERS } from "@/features/admission/constants/registrationWorkflow";

export interface BatchResults {
  processed: number;
  succeeded: Array<{
    id: number;
    name: string;
    trackingNumber: string;
    previousStatus: string;
    status?: string;
    outcomeSummary?: string;
  }>;
  failed: Array<{
    id: number;
    name: string;
    trackingNumber: string;
    reason: string;
  }>;
}

interface Props {
  results: BatchResults | null;
  onReselectFailed?: (ids: number[]) => void;
  onClose: () => void;
}

export default function BatchResultsModal({
  results,
  onReselectFailed,
  onClose,
}: Props) {
  if (!results) return null;

  const { processed, succeeded, failed } = results;

  const toStatusLabel = (status: string) => {
    const normalized = status.trim().toUpperCase();
    const fromCatalog = REGISTRATION_STAGE_QUICK_FILTERS.find(
      (stage) => stage.value === normalized,
    )?.label;

    if (fromCatalog) return fromCatalog;

    return normalized
      .split("_")
      .filter(Boolean)
      .map((token) => `${token.charAt(0)}${token.slice(1).toLowerCase()}`)
      .join(" ");
  };

  const toSucceededOutcome = (
    item: BatchResults["succeeded"][number],
  ): string => {
    if (item.outcomeSummary?.trim()) {
      return item.outcomeSummary;
    }

    if (item.status?.trim()) {
      return `Moved to: ${toStatusLabel(item.status)}`;
    }

    return "Processed successfully";
  };

  return (
    <Dialog open={!!results} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Batch Processing Results
          </DialogTitle>
          <DialogDescription>
            {processed} applicant{processed !== 1 ? "s" : ""} processed
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 py-2">
          {/* Summary */}
          <div
            className={`grid gap-3 ${failed.length > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2 flex-1">
              <CheckCircle2 className="size-5 text-green-600" />
              <div>
                <p className="text-xl font-bold text-green-700">
                  {succeeded.length}
                </p>
                <p className="text-xs font-bold text-green-600">Succeeded</p>
              </div>
            </div>
            {failed.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 flex-1">
                <XCircle className="size-5 text-red-600" />
                <div>
                  <p className="text-xl font-bold text-red-700">
                    {failed.length}
                  </p>
                  <p className="text-xs font-bold text-red-600">Failed</p>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto pr-1 space-y-4">
            {/* Failed records */}
            {failed.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-red-700 mb-2">
                  Failed Actions (Requires Attention)
                </h4>
                <div className="space-y-1.5">
                  {failed.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-red-200 bg-red-50/50 px-3 py-2">
                      <p className="text-sm font-bold">
                        {item.name}
                        {item.trackingNumber && (
                          <span className="ml-1 text-xs font-medium text-muted-foreground">
                            (#{item.trackingNumber})
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-bold text-red-700">
                        Error: {item.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Succeeded records */}
            {succeeded.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-green-700 mb-2">
                  Succeeded
                </h4>
                <div className="space-y-1.5">
                  {succeeded.map((item) => (
                    <div
                      key={item.id}
                      className="rounded border border-green-200 bg-green-50/50 px-3 py-2">
                      <p className="text-sm font-bold">
                        {item.name}
                        {item.trackingNumber && (
                          <span className="ml-1 text-xs font-medium text-muted-foreground">
                            (#{item.trackingNumber})
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-bold text-green-700">
                        {toSucceededOutcome(item)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {failed.length > 0 && onReselectFailed && (
            <Button
              variant="outline"
              onClick={() => {
                onReselectFailed(failed.map((item) => item.id));
                onClose();
              }}
              className="font-bold">
              Re-select Failed & Close
            </Button>
          )}
          <Button onClick={onClose} className="font-bold">
            Close & Refresh
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
