import { CheckCircle2, CircleDashed, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import type { ApplicationTrackResponse } from "@enrollpro/shared";

interface EnrollmentTimelineProps {
  application: ApplicationTrackResponse & {
    firstName: string;
    lastName: string;
    scpAssessmentResult: string | null;
  };
  onBack: () => void;
}

export default function EnrollmentTimeline({ application, onBack }: EnrollmentTimelineProps) {
  const { current_step } = application;

  const steps = [
    {
      step: 1,
      title: "Registrar Review",
      description: "The Registrar's Office is verifying your official enrollment records.",
    },
    {
      step: 2,
      title: "Ready for Sectioning",
      description: "Learner is queued for automated class sectioning.",
    },
    {
      step: 3,
      title: "Officially Enrolled",
      description: "Section finalized. Welcome to the active school year.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {steps.map((s) => {
          let isCompleted = current_step > s.step;
          let isActive = current_step === s.step;

          if (s.step === 3 && current_step === 3) {
            isCompleted = true;
          }

          const isMuted = current_step < s.step;

          return (
            <div key={s.step} className={cn("relative flex items-start gap-4 p-4 rounded-xl border bg-card shadow-sm", isMuted && "opacity-50")}>
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                  isCompleted ? "bg-green-500 text-white" :
                  isActive ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                 isActive ? <CircleDashed className="w-5 h-5 animate-spin-slow" /> :
                 <span className="font-bold text-sm">{s.step}</span>}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <h4 className={cn("text-base font-bold uppercase", isMuted ? "text-muted-foreground" : "text-foreground")}>
                  {s.title}
                </h4>
                {!isMuted && (
                  <p className="text-sm text-muted-foreground">
                    {s.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center pt-4">
        <Button type="button" variant="outline" className="w-full font-bold sm:w-auto" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Check Another Tracking Number
        </Button>
      </div>
    </div>
  );
}
