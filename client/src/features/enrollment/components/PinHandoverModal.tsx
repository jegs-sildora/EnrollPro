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
import { CheckCircle2, Copy, Check, AlertTriangle } from "lucide-react";
import { sileo } from "sileo";

interface PinHandoverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  learnerName: string;
  pin: string;
}

export function PinHandoverModal({
  open,
  onOpenChange,
  learnerName,
  pin,
}: PinHandoverModalProps) {
  const [hasWrittenPin, setHasWrittenPin] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    sileo.success({
      title: "PIN Copied",
      description: "Portal PIN has been copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (hasWrittenPin) {
      onOpenChange(false);
      setHasWrittenPin(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      // Prevent closing by clicking outside or escape unless checkbox is ticked
      if (hasWrittenPin) {
        onOpenChange(val);
        if (!val) setHasWrittenPin(false);
      }
    }}>
      <DialogContent className="sm:max-w-[500px] border-emerald-200" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6" />
            Official Enrollment Confirmed
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground pt-2">
            {learnerName.toUpperCase()} has been successfully enrolled and sectioned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4 text-center">
            <p className="text-xs font-black uppercase text-slate-500 tracking-widest">
              Temporary Portal PIN:
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <span className="text-4xl font-black tracking-[0.2em] text-slate-900 font-mono">
                {pin.split("").join(" ")}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="h-10 w-10 shrink-0 border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 transition-colors"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-900 leading-relaxed">
              IMPORTANT: This PIN will only be shown once. Please write this 
              down on the upper-right corner of the learner's physical form now.
            </p>
          </div>

          <div className="flex items-start space-x-3 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
            <Checkbox
              id="pin-written"
              checked={hasWrittenPin}
              onCheckedChange={(checked) => setHasWrittenPin(checked === true)}
              className="mt-1 border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
            />
            <Label
              htmlFor="pin-written"
              className="text-sm font-black uppercase text-slate-700 leading-snug cursor-pointer select-none"
            >
              I have written this PIN on the physical enrollment slip.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleClose}
            disabled={!hasWrittenPin}
            className={`w-full h-12 font-black uppercase tracking-widest transition-all ${
              hasWrittenPin
                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                : "bg-slate-200 text-slate-500 cursor-not-allowed border-none shadow-none"
            }`}
          >
            Complete Enrollment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
