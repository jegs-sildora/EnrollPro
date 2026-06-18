import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface FinalizeEnrollmentPayload {
  confirmationSlipReceived: boolean;
  heightCm: number;
  weightKg: number;
}

interface FinalizeEnrollmentModalProps {
  open: boolean;
  title?: string;
  learnerName?: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: FinalizeEnrollmentPayload) => void;
}

export default function FinalizeEnrollmentModal({
  open,
  title = "Finalize Enrollment",
  learnerName,
  loading = false,
  onOpenChange,
  onSubmit,
}: FinalizeEnrollmentModalProps) {
  const [confirmationSlipReceived, setConfirmationSlipReceived] = useState(false);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmationSlipReceived(false);
      setHeightCm("");
      setWeightKg("");
    }
  }, [open]);

  const heightNum = Number(heightCm);
  const weightNum = Number(weightKg);

  const isHeightValid = Number.isFinite(heightNum) && heightNum >= 90 && heightNum <= 220;
  const isWeightValid = Number.isFinite(weightNum) && weightNum >= 20 && weightNum <= 150;

  const canSubmit =
    confirmationSlipReceived &&
    isHeightValid &&
    isWeightValid &&
    !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base leading-tight font-black uppercase tracking-wide">{title}</DialogTitle>
          {learnerName ? (
            <p className="text-base text-foreground font-bold">{learnerName}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
            <Checkbox
              checked={confirmationSlipReceived}
              onCheckedChange={(checked) => setConfirmationSlipReceived(Boolean(checked))}
            />
            <span className="text-base font-bold">
              Physical Enrollment Form / Confirmation Slip Received
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Height (cm)</Label>
              <Input
                type="number"
                min={90}
                max={220}
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g. 150"
              />
              {!isHeightValid && heightCm ? (
                <p className="text-base text-destructive font-bold">Height must be 90 to 220 cm.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest">Weight (kg)</Label>
              <Input
                type="number"
                min={20}
                max={150}
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="e.g. 45"
              />
              {!isWeightValid && weightKg ? (
                <p className="text-base text-destructive font-bold">Weight must be 20 to 150 kg.</p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                confirmationSlipReceived,
                heightCm: heightNum,
                weightKg: weightNum,
              })
            }
            className="font-black uppercase text-base bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm Enrollment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
