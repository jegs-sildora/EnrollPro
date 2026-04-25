import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { CheckCircle2, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { sileo } from "sileo";
import { cn } from "@/shared/lib/utils";

interface PinResetHandoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  gradeLevel: string;
  onConfirmReset: () => Promise<string>;
}

export function PinResetHandoverModal({
  open,
  onOpenChange,
  studentName,
  gradeLevel,
  onConfirmReset,
}: PinResetHandoverModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [newPin, setNewPin] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasCopiedPin, setHasCopiedPin] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setIsGenerating(true);
    try {
      const pin = await onConfirmReset();
      setNewPin(pin);
      setStep(2);
    } catch (err) {
      // Parent handles toast error via toastApiError
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newPin);
    setCopied(true);
    sileo.success({
      title: "PIN Copied",
      description: "Portal PIN has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (step === 2 && !hasCopiedPin) return;
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep(1);
      setNewPin("");
      setHasCopiedPin(false);
      setCopied(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing in step 2 until acknowledged
      if (step === 2 && !hasCopiedPin) return;
      if (!val) handleClose();
      else onOpenChange(val);
    }}>
      <DialogContent 
        className={cn(
          "sm:max-w-[500px] border-t-4 transition-all duration-300"
        )}
        onPointerDownOutside={(e) => {
          if (step === 2 && !hasCopiedPin) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (step === 2 && !hasCopiedPin) e.preventDefault();
        }}
      >
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase text-amber-700 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6" />
                Initiate PIN Reset
              </DialogTitle>
              <DialogDescription className="font-bold text-foreground pt-2">
                You are about to reset the Learner Portal PIN for:
                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-foreground uppercase">
                  {studentName} ({gradeLevel})
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-bold text-red-800 leading-relaxed">
                  WARNING: Generating a new PIN will immediately invalidate the current one. 
                  The learner will be locked out until you provide them with the new credential.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={handleClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button 
                onClick={handleReset} 
                disabled={isGenerating}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-widest"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Generate New PIN
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-black uppercase text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                Portal PIN Reset Successful
              </DialogTitle>
              <DialogDescription className="font-bold text-foreground pt-2">
                The previous PIN has been invalidated.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4 text-center">
                <p className="text-xs font-black uppercase text-foreground tracking-widest">
                  New Portal PIN:
                </p>
                
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-black tracking-[0.2em] text-foreground">
                    {newPin.split("").join(" ")}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    className="h-10 w-10 shrink-0 border-slate-200 text-foreground hover:text-emerald-600 hover:border-emerald-200 transition-colors"
                  >
                    {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={handleCopy}
                  className="text-xs font-bold uppercase text-foreground hover:text-emerald-600"
                >
                  {copied ? "PIN Copied!" : "📋 Copy to Clipboard"}
                </Button>
              </div>

              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm font-bold text-amber-900 leading-relaxed">
                  IMPORTANT: For security reasons, this PIN will not be shown again. 
                  Please ensure you have securely transmitted this to the guardian.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                <Checkbox
                  id="pin-transmitted"
                  checked={hasCopiedPin}
                  onCheckedChange={(checked) => setHasCopiedPin(checked === true)}
                  className="mt-1 border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <Label
                  htmlFor="pin-transmitted"
                  className="text-sm font-black uppercase text-foreground leading-snug cursor-pointer select-none"
                >
                  I have copied and securely forwarded this new PIN.
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={handleClose}
                disabled={!hasCopiedPin}
                className={cn(
                  "w-full h-12 font-black uppercase tracking-widest transition-all",
                  hasCopiedPin
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                    : "bg-slate-200 text-foreground cursor-not-allowed border-none shadow-none"
                )}
              >
                Close & Return to Profile
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
