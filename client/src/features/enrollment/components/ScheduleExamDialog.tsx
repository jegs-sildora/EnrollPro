import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { format } from "date-fns";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { sileo } from "sileo";
import type {
  ApplicantDetail,
  AssessmentStep,
} from "@/features/enrollment/hooks/useApplicationDetail";
import { formatScpType } from "@/shared/lib/utils";
import { ASSESSMENT_KIND_LABELS } from "@enrollpro/shared";
import type { AssessmentKind } from "@enrollpro/shared";

interface ScpStepConfig {
  stepOrder: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  venue: string | null;
  notes: string | null;
}

interface ScpConfig {
  scpType: string;
  steps: ScpStepConfig[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: ApplicantDetail | null;
  /** The specific pipeline step to schedule. When null, falls back to legacy behavior. */
  step?: AssessmentStep | null;
  endpointBase?: string;
  onSuccess: () => void;
  onCloseSheet?: () => void;
}

export function ScheduleExamDialog({
  open,
  onOpenChange,
  applicant,
  step,
  endpointBase = "/applications",
  onSuccess,
  onCloseSheet,
}: Props) {
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [venue, setVenue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const effectiveStep =
    step ??
    applicant?.assessmentSteps?.find((s) => s.status === "PENDING") ??
    applicant?.assessmentSteps?.[0] ??
    null;

  useEffect(() => {
    if (!open || !applicant) return;

    if (effectiveStep) {
      // Fetch fresh config defaults from the SCP assessment step table
      api
        .get(`/curriculum/${applicant.schoolYearId}/scp-config`)
        .then((res) => {
          const configs: ScpConfig[] = res.data?.scpProgramConfigs ?? [];
          const match = configs.find(
            (c) => c.scpType === applicant.applicantType,
          );
          const stepConfig = match?.steps?.find(
            (s) => s.stepOrder === effectiveStep.stepOrder,
          );
          if (stepConfig) {
            setScheduledDate(
              stepConfig.scheduledDate
                ? format(new Date(stepConfig.scheduledDate), "yyyy-MM-dd")
                : "",
            );
            setScheduledTime(stepConfig.scheduledTime || "");
            setVenue(stepConfig.venue || "");
            setNotes(stepConfig.notes || "");
          } else {
            // Fallback to step prop data
            setScheduledDate(
              effectiveStep.configDate
                ? format(new Date(effectiveStep.configDate), "yyyy-MM-dd")
                : "",
            );
            setScheduledTime(effectiveStep.configTime || "");
            setVenue(effectiveStep.configVenue || "");
            setNotes(effectiveStep.configNotes || "");
          }
        })
        .catch(() => {
          // Fallback to step prop data on error
          setScheduledDate(
            effectiveStep.configDate
              ? format(new Date(effectiveStep.configDate), "yyyy-MM-dd")
              : "",
          );
          setScheduledTime(effectiveStep.configTime || "");
          setVenue(effectiveStep.configVenue || "");
          setNotes(effectiveStep.configNotes || "");
        });
    } else {
      setScheduledDate("");
      setScheduledTime("");
      setVenue("");
      setNotes("");
    }
  }, [open, effectiveStep, applicant]);

  if (!applicant) return null;

  const stepLabel = effectiveStep
    ? effectiveStep.label ||
      ASSESSMENT_KIND_LABELS[effectiveStep.kind as AssessmentKind] ||
      effectiveStep.kind
    : "Assessment";

  const primaryEmailAddress =
    (applicant.primaryContact === "MOTHER"
      ? applicant.motherName?.email
      : applicant.primaryContact === "FATHER"
        ? applicant.fatherName?.email
        : applicant.primaryContact === "GUARDIAN"
          ? applicant.guardianInfo?.email
          : null) ||
    applicant.emailAddress ||
    applicant.guardianInfo?.email ||
    applicant.motherName?.email ||
    applicant.fatherName?.email ||
    null;

  const handleSchedule = async () => {
    if (!scheduledDate || !effectiveStep) return;
    setSubmitting(true);
    try {
      await api.patch(`${endpointBase}/${applicant.id}/schedule-assessment`, {
        stepOrder: effectiveStep.stepOrder,
        kind: effectiveStep.kind,
        scheduledDate,
        scheduledTime: scheduledTime || undefined,
        venue: venue || undefined,
        notes: notes || undefined,
      });
      sileo.success({
        title: "Scheduled",
        description: `${stepLabel} scheduled successfully.`,
      });
      onOpenChange(false);
      onSuccess();
      if (onCloseSheet) onCloseSheet();
    } catch (err) {
      toastApiError(err as never);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto max-h-[85vh] scrollbar-thin p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-bold text-sm sm:text-base uppercase">
            Schedule {stepLabel}
          </DialogTitle>
          <DialogDescription className="font-bold text-xs sm:text-sm text-foreground">
            Applicant: {applicant.lastName}, {applicant.firstName} (
            {applicant.gradeLevel.name} -{" "}
            {formatScpType(applicant.applicantType)})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {effectiveStep && (
            <div className="rounded-lg border p-3 bg-slate-50 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                <span className="text-xs sm:text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                  Step {effectiveStep.stepOrder}
                </span>
                <span>{stepLabel}</span>
              </div>
              {effectiveStep.description && (
                <p className="text-xs sm:text-sm font-bold">
                  {effectiveStep.description}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs sm:text-sm">Date</Label>
              <Input
                readOnly
                className="font-bold text-xs sm:text-sm"
                value={
                  scheduledDate
                    ? format(new Date(scheduledDate), "MMMM dd, yyyy")
                    : "—"
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs sm:text-sm">Time</Label>
              <Input
                readOnly
                className="font-bold text-xs sm:text-sm"
                value={scheduledTime || "—"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs sm:text-sm">Venue</Label>
              <Input
                readOnly
                className="font-bold text-xs sm:text-sm"
                value={venue || "—"}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs sm:text-sm">Notes</Label>
              <Input
                readOnly
                className="font-bold text-xs sm:text-sm"
                value={notes || "—"}
              />
            </div>
          </div>

          <Alert className="flex items-center bg-primary/5 border-primary/20 p-3 gap-3 min-h-0 [&>svg]:static [&>svg]:translate-y-0">
            <Info className="h-4 w-4 stroke-primary shrink-0" />
            <AlertDescription className="!p-0 !m-0 !translate-y-0 font-bold text-primary/80 text-xs sm:text-sm leading-tight">
              A confirmation email will be sent to the parent/guardian at{" "}
              <span className="font-bold underline text-primary">
                {primaryEmailAddress || "N/A"}
              </span>{" "}
              with the schedule details.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            className="font-bold w-full sm:w-auto"
            variant="outline"
            onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="font-bold w-full sm:w-auto"
            onClick={handleSchedule}
            disabled={!scheduledDate || !effectiveStep || submitting}>
            Confirm Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
