import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import { format } from "date-fns";
import api from "@/shared/api/axiosInstance";
import { toastApiError } from "@/shared/hooks/useApiToast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { sileo } from "sileo";
import type { ApplicantDetail } from "@/features/enrollment/hooks/useApplicationDetail";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicant: ApplicantDetail | null;
  onSuccess: () => void;
}

export function ScheduleExamDialog({
  open,
  onOpenChange,
  applicant,
  onSuccess,
}: Props) {
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [examVenue, setExamVenue] = useState("");
  const [examNotes, setExamNotes] = useState("");
  const [scpConfig, setScpConfig] = useState<{
    scpType: string;
    examRequired: boolean;
    documentsRequired: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && applicant) {
      const fetchScpConfig = async () => {
        setLoading(true);
        try {
          const scpRes = await api.get(`/settings/scp-config`);
          const config = scpRes.data.scpConfigs.find(
            (c: { scpType: string }) => c.scpType === applicant.applicantType,
          );
          setScpConfig(config || null);

          if (config?.examDate) {
            setExamDate(format(new Date(config.examDate), "yyyy-MM-dd"));
          } else {
            setExamDate("");
          }

          if (config?.examTime) {
            setExamTime(config.examTime);
          } else {
            setExamTime("");
          }

          if (config?.notes) {
            setExamNotes(config.notes);
          } else {
            setExamNotes("");
          }

          setExamVenue("");
        } catch (err) {
          toastApiError(err as never);
        } finally {
          setLoading(false);
        }
      };
      fetchScpConfig();
    }
  }, [open, applicant]);

  if (!applicant) return null;

  const handleSchedule = async () => {
    if (!examDate) return;
    try {
      await api.patch(`/applications/${applicant.id}/schedule-exam`, {
        examDate,
        examTime,
        examVenue,
        examNotes,
      });
      sileo.success({
        title: "Scheduled",
        description: "Exam scheduled successfully.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toastApiError(err as never);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[95vw] max-w-md sm:w-full overflow-y-auto max-h-[90vh] scrollbar-thin'>
        <DialogHeader>
          <DialogTitle>Schedule Assessment</DialogTitle>
          <DialogDescription>
            Candidate: {applicant.lastName}, {applicant.firstName} (
            {applicant.gradeLevel.name} - {applicant.applicantType})
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='rounded-lg border p-3 bg-slate-50 space-y-2'>
            <div className='flex items-center gap-2 text-emerald-700 font-bold text-sm'>
              <span>✓</span>
              <span>Documents Verified</span>
            </div>
            <p className='text-[10px] text-muted-foreground leading-relaxed'>
              SF9 (Grade 6 Report Card) and PSA Birth Certificate have been
              checked and filed.
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label className='text-[10px] uppercase tracking-widest text-muted-foreground'>
              Assessment Type
            </Label>
            <div className='p-2 rounded border bg-muted/30 text-sm font-bold uppercase'>
              {scpConfig?.assessmentType || "Written Entrance Exam (EXAM_ONLY)"}
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Exam Date</Label>
              <div className='p-2 rounded border bg-muted/30 text-sm font-bold'>
                {examDate
                  ? format(new Date(examDate), "MMMM dd, yyyy")
                  : "NOT SET BY ADMIN"}
              </div>
            </div>
            <div className='space-y-2'>
              <Label>Exam Time</Label>
              <div className='p-2 rounded border bg-muted/30 text-sm font-bold'>
                {examTime
                  ? // Convert 24h to 12h for friendly display
                    new Date(`2000-01-01T${examTime}`).toLocaleTimeString(
                      "en-US",
                      {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      },
                    )
                  : "NOT SET BY ADMIN"}
              </div>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label>Venue (Optional)</Label>
              <Input
                placeholder='e.g. Science Lab'
                value={examVenue}
                onChange={(e) => setExamVenue(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>Notes (Optional)</Label>
              <Input
                placeholder='e.g. Bring pencils'
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
              />
            </div>
          </div>

          <div className='flex items-start gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-[10px]'>
            <Info className='h-3.5 w-3.5 shrink-0 mt-0.5' />
            <p>
              A confirmation email will be sent to the parent/guardian at{" "}
              <span className='font-bold'>
                {applicant.emailAddress || "N/A"}
              </span>{" "}
              with the exam schedule.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={!examDate || loading}>
            Confirm Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
