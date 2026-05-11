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
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/radio-group";
import { Loader2 } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";

interface RemedialResolutionModalProps {
  open: boolean;
  recordId: number | null;
  learnerName: string;
  lrn: string | null;
  onClose: () => void;
  onResolved: (recordId: number, newStatus: "PROMOTED" | "RETAINED") => void;
}

type RemedialOutcome = "PROMOTED" | "RETAINED";

export function RemedialResolutionModal({
  open,
  recordId,
  learnerName,
  lrn,
  onClose,
  onResolved,
}: RemedialResolutionModalProps) {
  const [remedialGrade, setRemedialGrade] = useState("");
  const [outcome, setOutcome] = useState<RemedialOutcome>("PROMOTED");
  const [loading, setLoading] = useState(false);

  const gradeValue = Number.parseFloat(remedialGrade);
  const isGradeValid =
    remedialGrade.trim().length > 0 &&
    Number.isFinite(gradeValue) &&
    gradeValue >= 0 &&
    gradeValue <= 100;

  const handleClose = () => {
    setRemedialGrade("");
    setOutcome("PROMOTED");
    onClose();
  };

  const handleSubmit = async () => {
    if (!recordId || !isGradeValid) return;
    setLoading(true);
    try {
      await api.patch(`/eosy/records/${recordId}`, {
        eosyStatus: outcome,
        finalAverage: gradeValue,
      });
      sileo.success({
        title: "Remedial Grade Saved",
        description: `${learnerName} resolved as ${outcome === "PROMOTED" ? "Promoted" : "Retained"}.`,
      });
      onResolved(recordId, outcome);
      handleClose();
    } catch (error) {
      toastApiError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black uppercase text-sm">
            Resolve Remedial Grade
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter the result of the summer/remedial class for this learner. This
            will clear the CONDITIONALLY PROMOTED status and unlock year
            rollover.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs font-black uppercase text-foreground">
              Learner
            </Label>
            <p className="font-bold text-sm">{learnerName}</p>
            {lrn && (
              <p className="text-xs text-muted-foreground font-mono">
                LRN: {lrn}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="remedial-grade"
              className="text-xs font-black uppercase text-foreground">
              Final Remedial Grade (0–100)
            </Label>
            <Input
              id="remedial-grade"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={remedialGrade}
              onChange={(e) => setRemedialGrade(e.target.value)}
              placeholder="e.g. 75.00"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-foreground">
              Outcome
            </Label>
            <RadioGroup
              value={outcome}
              onValueChange={(v) => setOutcome(v as RemedialOutcome)}
              className="flex gap-6">
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="PROMOTED"
                  id="outcome-promoted"
                />
                <Label
                  htmlFor="outcome-promoted"
                  className="font-bold text-sm text-emerald-700 cursor-pointer">
                  Promoted
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="RETAINED"
                  id="outcome-retained"
                />
                <Label
                  htmlFor="outcome-retained"
                  className="font-bold text-sm text-amber-700 cursor-pointer">
                  Retained
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="font-black uppercase text-xs"
            disabled={!isGradeValid || loading}
            onClick={() => void handleSubmit()}>
            {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Save Remedial Result
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
