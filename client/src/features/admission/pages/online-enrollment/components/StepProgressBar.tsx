import {
  Check,
  ClipboardCheck,
  FileText,
  Lock,
  School,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
  steps: { id: number; title: string }[];
  description?: string;
  completedUpTo?: number;
}

export default function StepProgressBar({
  currentStep,
  totalSteps,
  steps,
  description,
  completedUpTo,
}: StepProgressBarProps) {
  const maxCompleted = completedUpTo ?? currentStep;
  const currentStepData =
    steps.find((step) => step.id === currentStep) ||
    steps[Math.max(0, currentStep - 1)];
  const progressPercent =
    totalSteps > 1
      ? Math.round(((currentStep - 1) / (totalSteps - 1)) * 100)
      : 100;

  const getStepIcon = (title: string, index: number): LucideIcon => {
    const normalized = title.toLowerCase();

    if (normalized.includes("personal")) return UserRound;
    if (normalized.includes("family")) return Users;
    if (normalized.includes("background")) return FileText;
    if (normalized.includes("school")) return School;
    if (normalized.includes("preference")) return SlidersHorizontal;
    if (normalized.includes("review") || normalized.includes("submit")) {
      return ClipboardCheck;
    }

    const fallbackIcons: LucideIcon[] = [
      Lock,
      UserRound,
      FileText,
      School,
      SlidersHorizontal,
      ClipboardCheck,
    ];
    return fallbackIcons[index % fallbackIcons.length];
  };

  return (
    <div className="w-full my-6">
      <div className="rounded-2xl border border-border/60 bg-card px-3 py-4 sm:px-4 md:px-5 md:py-5">
        {/* Mobile */}
        <div className="md:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">
              Step {currentStep} of {totalSteps}
            </p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-center">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = !isActive && step.id < maxCompleted;
              const isLast = index === steps.length - 1;
              const StepIcon = getStepIcon(step.title, index);

              return (
                <div key={step.id} className="relative min-w-0 flex-1">
                  {!isLast && (
                    <>
                      <div className="absolute left-1/2 right-[-50%] top-3.5 h-[2px] rounded-full bg-border/70" />
                      <div
                        className={cn(
                          "absolute left-1/2 top-3.5 h-[2px] rounded-full bg-primary transition-all duration-0",
                          isCompleted ? "right-[-50%]" : "right-1/2",
                        )}
                      />
                    </>
                  )}

                  <div
                    className={cn(
                      "relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-0",
                      isCompleted
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--card)),0_0_0_4px_hsl(var(--primary)/0.25)]"
                          : "border-border bg-card text-muted-foreground",
                    )}
                    aria-current={isActive ? "step" : undefined}>
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-bold text-foreground">
                {currentStepData?.title}
              </p>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-primary">
                Current
              </span>
            </div>
            {description && (
              <p className="text-sm font-bold mt-0.5 leading-snug text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Desktop and larger */}
        <div className="hidden md:block">
          <p className="mb-3 text-center text-base font-semibold uppercase tracking-[0.14em] text-foreground">
            Step {currentStep} of {totalSteps}
          </p>

          <div className="flex items-start">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = !isActive && step.id < maxCompleted;
              const isLast = index === steps.length - 1;
              const StepIcon = getStepIcon(step.title, index);
              const statusLabel = isCompleted
                ? "Done"
                : isActive
                  ? "Current"
                  : "Pending";

              return (
                <div key={step.id} className="relative min-w-0 flex-1">
                  {!isLast && (
                    <>
                      <div className="absolute left-1/2 right-[-50%] top-[1.125rem] h-[3px] rounded-full bg-border/70" />
                      <div
                        className={cn(
                          "absolute left-1/2 top-[1.125rem] h-[3px] rounded-full bg-primary transition-all duration-0",
                          isCompleted ? "right-[-50%]" : "right-1/2",
                        )}
                      />
                    </>
                  )}

                  <div className="relative z-10 flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-0",
                        isCompleted
                          ? "border-primary bg-primary text-primary-foreground"
                          : isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_2px_hsl(var(--card)),0_0_0_4px_hsl(var(--primary)/0.25)]"
                            : "border-border bg-card text-muted-foreground",
                      )}
                      aria-current={isActive ? "step" : undefined}>
                      {isCompleted ? (
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>

                    <span
                      className={cn(
                        "mt-2 block w-full truncate px-1 text-center leading-tight",
                        isActive
                          ? "font-bold text-foreground"
                          : isCompleted
                            ? "font-semibold text-foreground"
                            : "font-medium text-foreground",
                      )}
                      title={step.title}>
                      {step.title}
                    </span>

                    <span
                      className={cn(
                        "mt-1 rounded-full px-2 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider transition-colors",
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted/70 text-muted-foreground",
                      )}
                      aria-label={`Step status: ${statusLabel}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {description && (
            <p className="mt-4 text-center font-bold text-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
