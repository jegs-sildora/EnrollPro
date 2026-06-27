import { useState } from "react";
import { AlertTriangle, User } from "lucide-react";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { sileo } from "sileo";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { DatePicker } from "@/shared/ui/date-picker";

interface Application {
  id: number;
  lrn: string;
  status?: string;
  isPendingLrnCreation?: boolean;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  suffix?: string | null;
  enrollmentRecord?: {
    section?: { name: string } | null;
    transferOutDate?: string | null;
    transferOutReason?: string | null;
    dropOutDate?: string | null;
    dropOutReason?: string | null;
    sf1Remarks?: string | null;
  } | null;
  section?: { name: string } | null;
}

type ExitType = "TRANSFERRED_OUT" | "DROPPED_OUT" | "NO_LONGER_PARTICIPATING";

interface LearnerExitModalProps {
  open: boolean;
  mode?: "create" | "view";
  application: Application | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EXIT_TYPE_OPTIONS: { value: ExitType; label: string }[] = [
  { value: "TRANSFERRED_OUT", label: "Transferred Out (T/O)" },
  { value: "DROPPED_OUT", label: "Dropped Out (NLPA)" },
  { value: "NO_LONGER_PARTICIPATING", label: "Did Not Attend / Admin Error (NLP)" },
];

export function LearnerExitModal({
  open,
  mode = "create",
  application,
  onClose,
  onSuccess,
}: LearnerExitModalProps) {
  const [exitType, setExitType] = useState<ExitType | "">("");
  const [effectiveDate, setEffectiveDate] = useState<Date | undefined>(
    new Date(),
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Derive saved exit data for view mode directly from the application
  const savedExitType: ExitType | "" = (() => {
    if (!application?.status) return "";
    if (
      application.status === "TRANSFERRED_OUT" ||
      application.status === "DROPPED_OUT" ||
      application.status === "NO_LONGER_PARTICIPATING"
    ) {
      return application.status as ExitType;
    }
    return "";
  })();

  const savedReason =
    application?.enrollmentRecord?.transferOutReason ??
    application?.enrollmentRecord?.dropOutReason ??
    application?.enrollmentRecord?.sf1Remarks ??
    "";

  const savedEffectiveDateStr =
    application?.enrollmentRecord?.transferOutDate ??
    application?.enrollmentRecord?.dropOutDate ??
    null;

  const savedEffectiveDate = savedEffectiveDateStr
    ? new Date(savedEffectiveDateStr)
    : undefined;

  const isViewMode = mode === "view";

  function resetForm() {
    setExitType("");
    setEffectiveDate(new Date());
    setReason("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const sectionName =
    application?.enrollmentRecord?.section?.name ??
    application?.section?.name ??
    null;

  const fullName = application
    ? [
      application.lastName,
      ", ",
      application.firstName,
      application.middleName ? ` ${application.middleName}` : "",
      application.suffix ? `, ${application.suffix}` : "",
    ].join("")
    : "—";

  const lrnDisplay = application?.isPendingLrnCreation
    ? "Pending LRN Assignment"
    : (application?.lrn ?? "—");

  async function handleSubmit() {
    if (!application || !exitType || !effectiveDate) return;
    if (!reason.trim()) {
      sileo.error({
        title: "Reason Required",
        description: "Enter a reason before processing this exit.",
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.patch(`/applications/${application.id}/process-exit`, {
        exitType,
        effectiveDate: effectiveDate.toISOString(),
        reason: reason.trim(),
      });

      sileo.success({
        title: "Exit Processed",
        description: "Learner exit has been recorded for SF4 reporting.",
      });

      resetForm();
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base leading-tight font-extrabold uppercase tracking-wide">
            {isViewMode ? "Learner Exit Record" : "Process Learner Exit"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Identity verification block */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold leading-snug text-slate-900">
                {fullName}
              </p>
              <p className="mt-0.5 text-base leading-tight text-foreground">
                LRN:{" "}
                <span className="font-extrabold text-slate-700">
                  {lrnDisplay}
                </span>
              </p>
              {sectionName && (
                <p className="text-base leading-tight text-foreground">
                  Section:{" "}
                  <span className="font-extrabold text-slate-700">
                    {sectionName}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Exit Type */}
          <div className="space-y-2">
            <Label
              htmlFor="exitType"
              className="text-base leading-tight font-extrabold uppercase">
              Exit Type
            </Label>
            <Select
              value={isViewMode ? savedExitType : exitType}
              onValueChange={
                isViewMode ? undefined : (v) => setExitType(v as ExitType)
              }
              disabled={isViewMode}>
              <SelectTrigger
                id="exitType"
                className="h-10 text-base leading-tight font-extrabold">
                <SelectValue placeholder="Select exit type" />
              </SelectTrigger>
              <SelectContent>
                {EXIT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-base leading-tight font-extrabold">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label className="text-base leading-tight font-extrabold uppercase">Effective Date</Label>
            <DatePicker
              date={isViewMode ? savedEffectiveDate : effectiveDate}
              setDate={isViewMode ? () => { } : setEffectiveDate}
              placeholder={isViewMode ? "No date recorded" : "Select effective date"}
              maxDate={new Date()}
            />
          </div>

          {/* Reason with character counter */}
          <div className="space-y-2">
            <Label
              htmlFor="exitReason"
              className="text-base leading-tight font-extrabold uppercase">
              Reason / Remarks
            </Label>
            <Textarea
              id="exitReason"
              value={isViewMode ? savedReason : reason}
              onChange={
                isViewMode ? undefined : (e) => setReason(e.target.value)
              }
              readOnly={isViewMode}
              placeholder={
                isViewMode
                  ? "No reason recorded"
                  : "Provide a clear reason for this exit action (required)"
              }
              className="min-h-24 text-base leading-tight font-extrabold"
              maxLength={isViewMode ? undefined : 500}
            />
            {!isViewMode && (
              <p className="text-right text-base text-foreground">
                {reason.length}/500
              </p>
            )}
          </div>

          {/* Warning banner — create mode only */}
          {!isViewMode && (
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-base leading-relaxed">
                <strong>Notice:</strong> Processing this exit will change the
                learner's official status for DepEd{" "}
                <strong>School Form 4 (SF4)</strong> reporting. The learner will
                remain on the historical SF1 but will be excluded from active
                grading.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="text-base leading-tight font-extrabold"
            onClick={handleClose}
            disabled={submitting}>
            {isViewMode ? "Close" : "Cancel"}
          </Button>
          {!isViewMode && (
            <Button
              className="text-base leading-tight font-extrabold bg-red-600 hover:bg-red-700 text-white"
              disabled={
                !exitType || !effectiveDate || !reason.trim() || submitting
              }
              onClick={() => {
                void handleSubmit();
              }}>
              {submitting ? "Processing..." : "Confirm Exit"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
