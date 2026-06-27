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
  onClose: () => void;
}

export default function BatchResultsModal({ results, onClose }: Props) {
  if (!results) return null;

  const { processed, succeeded, failed } = results;

  return (
    <Dialog
      open={!!results}
      onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">
            Batch Processing Results
          </DialogTitle>
          <DialogDescription>
            {processed} applicant{processed !== 1 ? "s" : ""} processed
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 py-2">
          {/* Summary */}
          <div className="grid gap-3 grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2 flex-1">
              <CheckCircle2 className="size-5 text-green-600" />
              <div>
                <p className="text-xl font-extrabold text-green-700">
                  {succeeded.length}
                </p>
                <p className="text-base font-extrabold text-green-600">Succeeded</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-2 flex-1">
              <XCircle className="size-5 text-red-600" />
              <div>
                <p className="text-xl font-extrabold text-red-700">
                  {failed.length}
                </p>
                <p className="text-base font-extrabold text-red-600">Failed</p>
              </div>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto pr-1">
            <h4 className="text-base leading-tight font-extrabold text-red-700 mb-2">
              Action Required for Failed Applicants
            </h4>
            <div className="space-y-1.5">
              {failed.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-red-200 bg-red-50/50 px-3 py-2">
                  <p className="text-base leading-tight font-extrabold">
                    {item.name}
                    {item.trackingNumber && (
                      <span className="ml-1 text-base font-extrabold text-foreground">
                        (#{item.trackingNumber})
                      </span>
                    )}
                  </p>
                  <p className="text-base font-extrabold text-red-700">
                    Error: {item.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="font-extrabold">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
