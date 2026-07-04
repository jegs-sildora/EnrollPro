import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import type { EosyStatus } from "@enrollpro/shared";
import type { EnrollmentRecord } from "@/features/enrollment/pages/EosyIndex";

interface Props {
  record: EnrollmentRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EosyOverrideModal({ record, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [eosyStatus, setEosyStatus] = useState<EosyStatus | "">("");
  const [finalAverage, setFinalAverage] = useState<string>("");
  const [academicDeficiencyNote, setAcademicDeficiencyNote] = useState("");
  const [dropOutReason, setDropOutReason] = useState("");
  const [transferOutDate, setTransferOutDate] = useState("");

  useEffect(() => {
    if (record) {
      setEosyStatus(record.eosyStatus || "");
      setFinalAverage(record.finalAverage !== null ? String(record.finalAverage) : "");
      setAcademicDeficiencyNote(record.academicDeficiencyNote || "");
      setDropOutReason(record.dropOutReason || "");
      setTransferOutDate(record.transferOutDate ? new Date(record.transferOutDate).toISOString().split("T")[0] : "");
    }
  }, [record]);

  const handleSubmit = async () => {
    if (!record || !eosyStatus) return;

    if (eosyStatus === "DROPPED_OUT" && !dropOutReason) {
      sileo.error({ title: "Validation Error", description: "Drop out reason is required." });
      return;
    }
    if (eosyStatus === "TRANSFERRED_OUT" && !transferOutDate) {
      sileo.error({ title: "Validation Error", description: "Transfer out date is required." });
      return;
    }
    
    let parsedAve: number | undefined;
    if (finalAverage) {
      parsedAve = parseFloat(finalAverage);
      if (isNaN(parsedAve) || parsedAve < 60 || parsedAve > 100) {
        sileo.error({ title: "Validation Error", description: "Final Average must be a number between 60 and 100." });
        return;
      }
    }

    setLoading(true);
    try {
      await api.post(`/eosy/records/${record.id}/override`, {
        eosyStatus,
        academicDeficiencyNote:
          eosyStatus === "CONDITIONALLY_PROMOTED"
            ? academicDeficiencyNote
            : null,
        dropOutReason: eosyStatus === "DROPPED_OUT" ? dropOutReason : null,
        transferOutDate: eosyStatus === "TRANSFERRED_OUT" ? transferOutDate : null,
        finalAverage: parsedAve,
      });

      sileo.success({
        title: "Override Applied",
        description: `Successfully overrode data for ${record.enrollmentApplication.learner.firstName} ${record.enrollmentApplication.learner.lastName}.`,
      });
      onSuccess();
      onClose();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!record} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="w-full max-w-3xl border-amber-200 bg-amber-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-800 uppercase font-extrabold text-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            Emergency Data Override
          </DialogTitle>
          <DialogDescription className="text-amber-700/80 font-bold">
            You are bypassing standard progression logic. This action is permanently logged to the system audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4 bg-white p-4 rounded-md border border-amber-100 shadow-sm">
          <div className="space-y-1">
            <Label className="font-extrabold text-amber-900">Learner</Label>
            <p className="text-base font-medium">
              {record?.enrollmentApplication.learner.lastName},{" "}
              {record?.enrollmentApplication.learner.firstName}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="font-extrabold text-amber-900">Final General Average</Label>
            <Input
              type="number"
              step="0.01"
              value={finalAverage}
              onChange={(e) => setFinalAverage(e.target.value)}
              placeholder="e.g. 85.50"
              className="font-extrabold"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-extrabold text-amber-900">EOSY Status</Label>
            <Select value={eosyStatus} onValueChange={(val) => setEosyStatus(val as EosyStatus)}>
              <SelectTrigger className="font-extrabold">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROMOTED">PROMOTED</SelectItem>
                <SelectItem value="RETAINED">RETAINED</SelectItem>
                <SelectItem value="CONDITIONALLY_PROMOTED">CONDITIONALLY PROMOTED</SelectItem>
                <SelectItem value="TRANSFERRED_OUT">TRANSFERRED OUT</SelectItem>
                <SelectItem value="DROPPED_OUT">DROPPED OUT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {eosyStatus === "CONDITIONALLY_PROMOTED" && (
            <div className="space-y-1.5">
              <Label className="font-extrabold text-amber-900">Academic Deficiency Note</Label>
              <Input
                value={academicDeficiencyNote}
                onChange={(e) => setAcademicDeficiencyNote(e.target.value)}
                placeholder="Example: Mathematics"
              />
            </div>
          )}

          {eosyStatus === "DROPPED_OUT" && (
            <div className="space-y-1.5">
              <Label className="font-extrabold text-amber-900">Drop Out Reason</Label>
              <Input
                value={dropOutReason}
                onChange={(e) => setDropOutReason(e.target.value)}
                placeholder="Required for Drop Out"
              />
            </div>
          )}

          {eosyStatus === "TRANSFERRED_OUT" && (
            <div className="space-y-1.5">
              <Label className="font-extrabold text-amber-900">Transfer Out Date</Label>
              <Input
                type="date"
                value={transferOutDate}
                onChange={(e) => setTransferOutDate(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading} className="font-extrabold border-amber-300 text-amber-800 hover:bg-amber-100">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !eosyStatus} className="font-extrabold bg-amber-600 hover:bg-amber-700 text-white shadow-md">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
