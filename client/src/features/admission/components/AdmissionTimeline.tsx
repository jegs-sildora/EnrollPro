import { CheckCircle2, CircleAlert, Loader2, ArrowRight, Ban } from "lucide-react";
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

type StepStatus = "PENDING" | "PASSED" | "FAILED" | "QUALIFIED" | "DISQUALIFIED" | "WAITLISTED";

interface StepDefinition {
  step: number;
  title: string;
  pending: string;
  passed: string;
  failed: string;
  waitlisted?: string;
  skipped?: string;
  upcoming?: string;
  status: StepStatus;
}

interface ProcessedStep extends StepDefinition {
  isCompleted: boolean;
  isActive: boolean;
  isFailed: boolean;
  isWaitlisted: boolean;
  isUpcoming: boolean;
  isSkipped: boolean;
}

export default function AdmissionTimeline({ application, onBack }: AdmissionTimelineProps) {
  const navigate = useNavigate();
  const { verification_status, exam_status, interview_status, final_result } = application;

  const handleProceed = () => {
    navigate(`/enrollment?tracking=${application.trackingNumber}`);
  };

  // "Fail Fast" rule: if exam failed, interview is skipped (N/A)
  const examFailed = exam_status === "FAILED";

  const steps: StepDefinition[] = [
    {
      step: 1,
      title: "Checking of Requirements",
      pending: "Please submit your SF9, PSA Birth Certificate, and other requirements to the assigned office.",
      passed: "All documents have been submitted and verified.",
      failed: "Requirements did not pass verification.",
      status: (verification_status || "PENDING") as StepStatus,
    },
    {
      step: 2,
      title: "Admission Test / Audition",
      pending: "Waiting for the scheduled test/audition or the release of results.",
      passed: "Passed the admission test/audition.",
      failed: "Did not pass the admission test/audition.",
      upcoming: "Must submit and pass the documentary requirements first.",
      status: (exam_status || "PENDING") as StepStatus,
    },
    {
      step: 3,
      title: "Interview",
      pending: "Waiting for the scheduled interview with the applicant and parents/guardians.",
      passed: "Interview completed.",
      failed: "Did not pass the interview.",
      skipped: "Not applicable — did not pass the admission test/audition.",
      upcoming: "Must pass the admission test/audition first.",
      status: (interview_status || "PENDING") as StepStatus,
    },
    {
      step: 4,
      title: "Final Screening Result",
      pending: "Waiting for the official posting of qualified applicants.",
      passed: "Congratulations! You are officially qualified. Please proceed to the Online Enrollment Form.",
      failed: "Did not meet the cut-off. Please proceed to enroll in the Regular Basic Education (BEC) program.",
      waitlisted: "Passed the screening, but placed on the waitlist due to limited slots.",
      upcoming: "Waiting for the official posting of qualified applicants.",
      status: (final_result || "PENDING") as StepStatus,
    },
  ];

  // Determine which step is "active" (0-indexed)
  const isTerminal = final_result === "QUALIFIED" || final_result === "DISQUALIFIED" || final_result === "WAITLISTED";
  let activeStepIndex: number;

  if (isTerminal) {
    activeStepIndex = 3; // Step 4 (terminal)
  } else {
    // Find the first step that isn't completed
    activeStepIndex = steps.findIndex(s => s.status !== "PASSED" && s.status !== "QUALIFIED");
    if (activeStepIndex === -1) activeStepIndex = 3;
  }

  // If exam failed, "Fail Fast": skip interview, jump active to step 4
  if (examFailed && activeStepIndex < 3) {
    activeStepIndex = 3;
  }

  const processedSteps: ProcessedStep[] = steps.map((s, index) => {
    let isCompleted = false;
    let isActive = false;
    let isFailed = false;
    let isWaitlisted = false;
    let isUpcoming = false;
    let isSkipped = false;

    if (s.step === 4) {
      // Final result step uses terminal statuses
      isCompleted = s.status === "QUALIFIED";
      isFailed = s.status === "DISQUALIFIED" || s.status === "FAILED";
      isWaitlisted = s.status === "WAITLISTED";
      isActive = !isCompleted && !isFailed && !isWaitlisted && activeStepIndex === index;
      isUpcoming = activeStepIndex < index;
    } else if (s.step === 3 && examFailed) {
      // "Fail Fast": interview is skipped entirely when exam fails
      isSkipped = true;
      isFailed = true;
    } else {
      isCompleted = s.status === "PASSED";
      isFailed = s.status === "FAILED";
      isActive = !isCompleted && !isFailed && activeStepIndex === index;
      isUpcoming = activeStepIndex < index;
    }

    return { ...s, isCompleted, isActive, isFailed, isWaitlisted, isUpcoming, isSkipped };
  });

  return (
    <div className="flex flex-col gap-8">
      {processedSteps.map((s, index) => {
        const isLast = index === processedSteps.length - 1;
        const { isCompleted, isActive, isFailed, isWaitlisted, isUpcoming, isSkipped } = s;

        return (
          <div key={s.step} className="relative grid grid-cols-[40px_1fr] gap-4 group">
            {/* Left Column: Line and Circle */}
            <div className="relative flex flex-col items-center justify-center">
              {/* Top half line (from previous row) */}
              {index > 0 && (
                <div
                  className={cn(
                    "absolute left-[19px] top-0 bottom-[50%] w-[2px]",
                    processedSteps[index - 1].isCompleted && !processedSteps[index - 1].isFailed ? "bg-green-500" : "bg-white"
                  )}
                />
              )}

              {/* Bottom half line (to next row) */}
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[19px] top-[50%] bottom-[-2rem] w-[2px]",
                    isCompleted && !isFailed ? "bg-green-500" : "bg-white"
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 border-2 bg-card",
                  isCompleted ? "border-green-600 bg-green-600 text-white" :
                    isSkipped ? "border bg text-foreground line-through" :
                      isFailed ? "border-red-500 bg-red-500 text-white" :
                        isWaitlisted ? "border-yellow-500 bg-yellow-500 text-white" :
                          isActive ? "border-amber-500 text-amber-500" :
                            "border-bg text-foreground"
                )}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                  isSkipped ? <Ban className="w-5 h-5" /> :
                    isFailed || isWaitlisted ? <CircleAlert className="w-5 h-5 text-white" /> :
                      isActive ? <Loader2 className="w-5 h-5 animate-spin" /> :
                        <span className="font-bold">{s.step}</span>}
              </div>
            </div>
            <div className={cn(
              "flex-1 flex flex-col gap-1 rounded-xl p-4 border shadow-sm",
              isCompleted ? "border-green-500 bg-card" :
              isActive ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/10" : "bg-card",
              isSkipped && "opacity-60 bg/30"
            )}>
              <h4 className={cn("text-xl font-extrabold uppercase",
                isCompleted ? "text-green-700 dark:text-green-400" :
                  isSkipped ? "text-foreground line-through" :
                    isFailed ? "text-red-700 dark:text-red-400" :
                      isWaitlisted ? "text-yellow-700 dark:text-yellow-400" :
                        isActive ? "text-amber-700 dark:text-amber-400" :
                          "text-foreground"
              )}>
                {s.title}
              </h4>
              {isSkipped ? (
                <p className="text-sm font-semibold text-foreground italic">
                  {s.skipped ?? "N/A"}
                </p>
              ) : !isUpcoming || isActive ? (
                <p className={cn("-mt-2",
                  isCompleted ? "text-green-600 dark:text-green-500" :
                    isFailed ? "text-red-600 dark:text-red-500" :
                      isWaitlisted ? "text-yellow-600 dark:text-yellow-500" :
                        isActive ? "text-amber-600 dark:text-amber-500" :
                          "text-foreground"
                )}>
                  {isCompleted ? s.passed : isFailed ? s.failed : isWaitlisted ? s.waitlisted : s.pending}
                </p>
              ) : (
                <p className="text-foreground -mt-2">{s.upcoming ?? "Waiting for the previous step to be completed."}</p>
              )}
              {s.step === 4 && isCompleted && (
                <div className="mt-4">
                  <Button onClick={handleProceed} className="w-full font-bold uppercase bg-green-600 hover:bg-green-700 text-white ">
                    Enroll Now
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex justify-center pt-4">
        <Button type="button" variant="outline" className="w-full font-bold bg-green-600 text-white hover:bg-green-700 hover:text-white" onClick={onBack}>
          Check Another Tracking Number
        </Button>
      </div>
    </div>
  );
}
