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
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { AdminPinInput } from "@/shared/components/AdminPinInput";
import api from "@/shared/api/axiosInstance";
import { motion, useReducedMotion } from "motion/react";
import {
  getReducedMotionProps,
  listVariants,
  panelTransition,
  sectionVariants,
  staggerTransition,
} from "@/shared/lib/motion";
import { lifecycleFeedback } from "@/shared/lib/lifecycle-feedback";

const EOSY_UNLOCK_CATEGORIES = [
  "SF5 Calculation Error Correction",
  "SF6 Grade Registry Correction",
  "Division Office Mandate",
  "Administrative Data Sync",
  "Other (Please Specify)",
];

interface EmergencyEosyUnlockModalProps {
  open: boolean;
  schoolYearId: number | null;
  schoolYearLabel: string | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EmergencyEosyUnlockModal({
  open,
  schoolYearId,
  schoolYearLabel,
  onOpenChange,
  onSuccess,
}: EmergencyEosyUnlockModalProps) {
  const [category, setCategory] = useState("");
  const [justification, setJustification] = useState("");
  const [pin, setPin] = useState("");
  const [pinTouched, setPinTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPinValid = /^\d{6}$/.test(pin);
  const isFormValid =
    category !== "" && justification.trim().length >= 10 && isPinValid;
  const shouldReduceMotion = useReducedMotion() ?? false;
  const motionState = getReducedMotionProps(shouldReduceMotion);

  const handleClose = (next: boolean) => {
    if (isSubmitting) return;
    onOpenChange(next);
    if (!next) {
      setCategory("");
      setJustification("");
      setPin("");
      setPinTouched(false);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid || !schoolYearId) return;
    lifecycleFeedback.progress(
      "Processing EOSY Unlock",
      "Reopening the archived academic phase for controlled corrections.",
    );
    setIsSubmitting(true);
    try {
      await api.post("/eosy/school-year/unlock", {
        schoolYearId,
        justification: `[${category}] ${justification.trim()}`,
        pin,
      });
      lifecycleFeedback.success(
        "EOSY Unlock Completed",
        `School year "${schoolYearLabel}" is back in the academic phase for corrections.`,
      );
      onSuccess();
      handleClose(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (
              err as { response: { data?: { message?: string } } }
            ).response.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to unlock EOSY.";
      lifecycleFeedback.error(
        "EOSY Unlock Failed",
        message || "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <motion.div
          variants={listVariants}
          transition={staggerTransition}
          {...motionState}>
        <motion.div variants={sectionVariants} transition={panelTransition}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase text-primary flex items-center gap-2">
            Emergency Unlock Protocol
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground pt-2">
            Reopening EOSY is a heavily restricted action.
          </DialogDescription>
        </DialogHeader>
        </motion.div>

        <motion.div
          className="space-y-6 py-4"
          variants={sectionVariants}
          transition={panelTransition}>
          {/* System Disruption Warning */}
          <div className="bg-red-800 text-white p-4 rounded-lg space-y-2 shadow-inner">
            <p className="text-sm font-black uppercase flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              System Disruption Warning:
            </p>
            <p className="text-[11px] font-bold leading-relaxed opacity-90">
              Unlocking the system will reverse the &ldquo;Rollover
              Ready&rdquo; state and reopen the End of School Year (EOSY)
              phase. You will need to manually unlock specific class sections
              to make grading corrections.
            </p>
          </div>

          <div className="space-y-4">
            {/* Category */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-primary">
                Authorization Category (Required)
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="font-bold border-primary/20 focus:ring-primary">
                  <SelectValue placeholder="Select a reason category" />
                </SelectTrigger>
                <SelectContent>
                  {EOSY_UNLOCK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="font-bold">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <Label
                htmlFor="eosy-unlock-reason"
                className="text-xs font-black uppercase text-primary">
                Specific Justification (Required for Audit)
              </Label>
              <Textarea
                id="eosy-unlock-reason"
                placeholder="Provide the specific mandate or administrative reason for reopening the grading phase..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="min-h-[80px] font-bold border-primary/20 focus-visible:ring-primary"
                disabled={isSubmitting}
              />
            </div>

            {/* Admin PIN */}
            <div className="space-y-3 pt-2 border-t border-primary/10">
              <Label className="text-xs font-black uppercase text-primary">
                Enter 6-Digit Admin PIN to Override:
              </Label>
              <AdminPinInput
                value={pin}
                onChange={setPin}
                invalid={pinTouched && !isPinValid}
                onBlur={() => setPinTouched(true)}
                autoFocus={open}
                disabled={isSubmitting}
                ariaLabel="EOSY emergency unlock admin PIN"
              />
              {pinTouched && !isPinValid && (
                <p className="text-xs text-primary font-bold uppercase animate-in fade-in slide-in-from-top-1 duration-200">
                  Valid 6-digit administrative PIN required
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div variants={sectionVariants} transition={panelTransition}>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            className="font-bold">
            Cancel
          </Button>
          <Button
            className={cn(
              "font-black uppercase transition-all px-6 shrink-0",
              !isFormValid || isSubmitting
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-red-700 text-white hover:bg-red-800 shadow-lg border-b-4 border-red-900/40 active:border-b-0 active:translate-y-1",
            )}
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? (
              "Processing..."
            ) : (
              <>
                <ShieldAlert className="mr-2 h-4 w-4" /> Force System Unlock
              </>
            )}
          </Button>
        </DialogFooter>
        </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
