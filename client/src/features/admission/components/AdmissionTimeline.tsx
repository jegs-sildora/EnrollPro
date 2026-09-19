import { CheckCircle2, CircleAlert, CircleDashed, ArrowRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { useNavigate } from "react-router";
import type { ApplicationTrackResponse } from "@enrollpro/shared";

interface AdmissionTimelineProps {
  application: ApplicationTrackResponse & {
    firstName: string;
    lastName: string;
    scpAssessmentResult: string | null;
  };
  onBack: () => void;
}

export default function AdmissionTimeline({ application, onBack }: AdmissionTimelineProps) {
  const navigate = useNavigate();
  const { current_step, status, programType } = application;
  const programLabel = programType === "SCP" ? "Special Curricular Program" : "Program";

  const handleProceed = () => {
    // Route to online enrollment and auto-fill tracking number
    navigate(`/enrollment?tracking=${application.trackingNumber}`);
  };

  const steps = [
    {
      step: 1,
      title: "Document Verification",
      pending: "Awaiting physical submission of SF9 and requirements.",
      passed: "Requirements verified by Registrar.",
    },
    {
      step: 2,
      title: "Screening & Assessment",
      pending: "Awaiting exam and/or interview results.",
      passed: "Screening completed.",
    },
    {
      step: 3,
      title: "Final Admission Result",
      pending: "",
      passed: `Congratulations! You are qualified for ${programLabel}.`,
      failed: "Did not meet program requirements. Please proceed to the registrar to explore Regular BEC enrollment options.",
      waitlisted: "Passed screening, but placed on the waitlist due to limited program slots.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {steps.map((s) => {
          let isCompleted = current_step > s.step;
          let isActive = current_step === s.step;
          let isFailed = isActive && status === "FAILED";
          let isWaitlisted = isActive && status === "WAITLISTED";

          if (s.step === 3 && current_step === 3) {
            isCompleted = status === "PASSED";
            isFailed = status === "FAILED";
            isWaitlisted = status === "WAITLISTED";
            isActive = true;
          }

          const isMuted = current_step < s.step;

          return (
            <div key={s.step} className={cn("relative flex items-start gap-4 p-4 rounded-xl border bg-card shadow-sm", isMuted && "opacity-50")}>
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                  isCompleted ? "bg-green-500 text-white" :
                  isFailed ? "bg-red-500 text-white" :
                  isWaitlisted ? "bg-yellow-500 text-white" :
                  isActive ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                 isFailed || isWaitlisted ? <CircleAlert className="w-5 h-5" /> :
                 isActive ? <CircleDashed className="w-5 h-5 animate-spin-slow" /> :
                 <span className="font-bold text-sm">{s.step}</span>}
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <h4 className={cn("text-base font-bold uppercase", isMuted ? "text-muted-foreground" : "text-foreground")}>
                  {s.title}
                </h4>
                {!isMuted && (
                  <p className={cn("text-sm", isFailed ? "text-red-500 font-bold" : isWaitlisted ? "text-yellow-600 font-bold" : "text-muted-foreground")}>
                    {isCompleted ? s.passed : isFailed ? s.failed : isWaitlisted ? s.waitlisted : s.pending}
                  </p>
                )}
                {s.step === 3 && isCompleted && (
                  <div className="mt-4">
                    <Button onClick={handleProceed} className="w-full sm:w-auto font-bold uppercase bg-green-600 hover:bg-green-700 text-white">
                      Proceed to Official Enrollment
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center pt-4">
        <Button type="button" variant="outline" className="w-full font-bold sm:w-auto" onClick={onBack}>
          Check Another Tracking Number
        </Button>
      </div>
    </div>
  );
}
