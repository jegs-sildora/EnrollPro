import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";

interface SystemRolloverModalProps {
  disabled: boolean;
  activeYearLabel: string | undefined;
}

export default function SystemRolloverModal({ disabled, activeYearLabel }: SystemRolloverModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNextStep = () => setStep(2);

  const handleExecute = async () => {
    if (confirmText !== "FINALIZE EOSY") return;

    setIsLoading(true);
    try {
      await api.post("/system/finalize-eosy");
      sileo.success({
        title: "EOSY Finalized",
        description: "The school year has been finalized and a new year opened successfully."
      });
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      toastApiError(err as any);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setTimeout(() => {
          setStep(1);
          setConfirmText("");
        }, 300);
      }
    }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={disabled}
          className={cn(
            "w-full min-w-max",
            disabled
              ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300 shadow-none !opacity-100"
              : "bg-maroon-700 text-white font-medium px-4 py-2 rounded-md shadow-sm transition-all hover:bg-maroon-800"
          )}
        >
          Finalize EOSY & Open New School Year
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            End of School Year (EOSY) Finalization
          </DialogTitle>
          <DialogDescription>
            You are initiating the highest level of system transition.
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                Warning: You are about to finalize the End of School Year (EOSY) data for SY {activeYearLabel || "Current"}. This will permanently archive current scholastic records and open the system for BOSY Enrollment.
              </AlertDescription>
            </Alert>
            <p className="text-base leading-tight text-muted-foreground">
              This process will:
              <br />• Archive current enrollment records into the immutable ledger
              <br />• Erase operational data from the current school year
              <br />• Advance learners to their next grade levels
              <br />• Create and activate the next school year
              <br />• Reset the system phase to BOSY_ENROLLMENT
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleNextStep}>Proceed to Confirmation</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type "FINALIZE EOSY" to proceed</Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="FINALIZE EOSY"
                className="border-destructive/50 focus-visible:ring-destructive"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancel</Button>
              <Button
                className="bg-maroon-700 text-white hover:bg-maroon-800"
                onClick={handleExecute}
                disabled={confirmText !== "FINALIZE EOSY" || isLoading}
              >
                {isLoading ? "Executing..." : "Finalize EOSY"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
