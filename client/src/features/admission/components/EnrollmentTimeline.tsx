import { CheckCircle2, CircleDashed } from "lucide-react";
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
    <div className="flex flex-col gap-8">
      {steps.map((s, index) => {
        let isCompleted = current_step > s.step;
        let isActive = current_step === s.step;

        if (s.step === 3 && current_step === 3) {
          isCompleted = true;
          isActive = false;
        }

        const isMuted = current_step < s.step;
        const isLast = index === steps.length - 1;

        return (
          <div key={s.step} className="relative grid grid-cols-[40px_1fr] gap-4 group">
            {/* Left Column: Line and Circle */}
            <div className="relative flex flex-col items-center justify-center">
              {/* Top half line (from previous row) */}
              {index > 0 && (
                <div
                  className={cn(
                    "absolute left-[19px] top-0 bottom-[50%] w-[2px]",
                    current_step >= s.step ? "bg-green-500" : "bg-white"
                  )}
                />
              )}

              {/* Bottom half line (to next row) */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[19px] top-[50%] bottom-[-2rem] w-[2px]",
                    isCompleted ? "bg-green-500" : "bg-white"
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 border-2 bg-card",
                  isCompleted ? "border-green-600 bg-green-600 text-white" :
                  isActive ? "border-blue-500 text-blue-500" :
                  "border-bg text-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> : 
                 isActive ? <CircleDashed className="w-5 h-5 animate-spin-slow" /> :
                 <span className="font-bold">{s.step}</span>}
              </div>
            </div>
            
            {/* Right Column: Content */}
            <div className={cn(
              "flex-1 flex flex-col gap-1 rounded-xl p-4 border shadow-sm",
              isCompleted ? "border-green-500 bg-card" :
              isActive ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "bg-card",
            )}>
              <h4 className={cn("text-xl font-extrabold uppercase",
                isCompleted ? "text-green-700 dark:text-green-400" :
                isActive ? "text-blue-700 dark:text-blue-400" :
                "text-foreground"
              )}>
                {s.title}
              </h4>
              <p className={cn("-mt-2",
                isCompleted ? "text-green-600 dark:text-green-500" :
                isActive ? "text-blue-600 dark:text-blue-500" :
                "text-foreground"
              )}>
                {!isMuted ? s.description : "Waiting for the previous step to be completed."}
              </p>
            </div>
          </div>
        );
      })}

      <div className="flex justify-center pt-4">
        <Button type="button" variant="outline" className="w-full font-bold bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white" onClick={onBack}>
          Check Another Tracking Number
        </Button>
      </div>
    </div>
  );
}
