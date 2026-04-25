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
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { ShieldCheck, InfoIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface DocumentAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  trackingNumber: string;
  onConfirm: (type: "PSA" | "SECONDARY") => Promise<void>;
}

export function DocumentAuthModal({
  open,
  onOpenChange,
  studentName,
  trackingNumber,
  onConfirm,
}: DocumentAuthModalProps) {
  const [documentType, setDocumentType] = useState<"PSA" | "SECONDARY">("PSA");
  const [hasCertified, setHasCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!hasCertified) return;
    setIsSubmitting(true);
    try {
      await onConfirm(documentType);
      onOpenChange(false);
      // Reset state
      setHasCertified(false);
      setDocumentType("PSA");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] border-t-4 border-t-blue-600">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase text-blue-700 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Authenticate Permanent Record
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground pt-2">
            You are authenticating the identity document for:
            <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 uppercase">
              {studentName} ({trackingNumber})
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <InfoIcon className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-blue-800 leading-relaxed">
              DepEd D.O. 017, s. 2025 mandates that a learner only submits their 
              Birth Certificate <span className="font-black underline">ONCE</span> during their basic education. 
              Verifying an original PSA document permanently satisfies this requirement.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Select Document Presented:
            </Label>
            
            <RadioGroup 
              value={documentType} 
              onValueChange={(val) => setDocumentType(val as "PSA" | "SECONDARY")}
              className="space-y-3"
            >
              <div 
                className={cn(
                  "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                  documentType === "PSA" ? "border-blue-600 bg-blue-50/50" : "border-slate-100 bg-white hover:border-slate-200"
                )}
                onClick={() => setDocumentType("PSA")}
              >
                <RadioGroupItem value="PSA" id="psa" className="mt-1" />
                <Label htmlFor="psa" className="cursor-pointer">
                  <span className="block font-black text-sm uppercase text-slate-900">Original PSA / NSO Birth Certificate</span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5">Satisfies requirement. This will permanently lock the identity vault for this learner.</span>
                </Label>
              </div>

              <div 
                className={cn(
                  "flex items-start space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                  documentType === "SECONDARY" ? "border-amber-500 bg-amber-50/50" : "border-slate-100 bg-white hover:border-slate-200"
                )}
                onClick={() => setDocumentType("SECONDARY")}
              >
                <RadioGroupItem value="SECONDARY" id="secondary" className="mt-1" />
                <Label htmlFor="secondary" className="cursor-pointer">
                  <span className="block font-black text-sm uppercase text-slate-900">Recognized Secondary Document</span>
                  <span className="block text-xs font-medium text-slate-500 mt-0.5 text-balance">e.g., Local Civil Registry, Baptismal, Barangay Cert. Grants temporary clearance. PSA still required by Oct 31, 2026.</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <Checkbox
              id="certify"
              checked={hasCertified}
              onCheckedChange={(checked) => setHasCertified(checked === true)}
              className="mt-1"
            />
            <Label
              htmlFor="certify"
              className="text-sm font-bold text-slate-700 leading-snug cursor-pointer select-none"
            >
              I certify that I have physically inspected and verified the 
              authenticity of the selected document.
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasCertified || isSubmitting}
            className={cn(
              "font-black uppercase tracking-widest transition-all px-8",
              hasCertified 
                ? "bg-blue-700 text-white hover:bg-blue-800 shadow-lg" 
                : "bg-slate-200 text-slate-500 cursor-not-allowed border-none shadow-none"
            )}
          >
            {isSubmitting ? "Processing..." : "🔒 Authenticate & Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
