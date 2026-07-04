import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { BOSYQueueItem, TLEProgram } from "../types";

interface TLEConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BOSYQueueItem | null;
  tlePrograms: TLEProgram[];
  onConfirm: (applicationId: number, tleProgramId: number) => Promise<void>;
  loading: boolean;
}

export function TLEConfirmModal({
  open,
  onOpenChange,
  item,
  tlePrograms,
  onConfirm,
  loading,
}: TLEConfirmModalProps) {
  const [selectedTleProgramId, setSelectedTleProgramId] = useState<string>("");

  const handleOpenChange = (v: boolean) => {
    if (!loading) {
      setSelectedTleProgramId("");
      onOpenChange(v);
    }
  };

  const handleConfirm = async () => {
    if (!item || !selectedTleProgramId) return;
    await onConfirm(item.applicationId, Number(selectedTleProgramId));
    setSelectedTleProgramId("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-extrabold uppercase text-base leading-tight">
            Enroll Learner — TLE Selection Required
          </DialogTitle>
          {item && (
            <DialogDescription className="text-base leading-tight">
              <span className="font-extrabold">
                {item.lastName}, {item.firstName}
              </span>{" "}
              ({item.gradeLevelName}) must select a TLE specialization before
              enrollment can be completed.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <p className="text-base font-extrabold uppercase text-foreground">
            TLE Specialization
          </p>
          <Select
            value={selectedTleProgramId}
            onValueChange={setSelectedTleProgramId}>
            <SelectTrigger className="text-base leading-tight">
              <SelectValue placeholder="Select a TLE program..." />
            </SelectTrigger>
            <SelectContent>
              {(tlePrograms || []).map((p) => (
                <SelectItem
                  key={p.id}
                  value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}>
            Cancel
          </Button>
          <Button
            disabled={!selectedTleProgramId || loading}
            onClick={() => void handleConfirm()}
            className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
