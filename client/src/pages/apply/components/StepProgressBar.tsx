import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Stepper } from '@/pages/apply/stepper';

interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
  steps: { id: number; title: string }[];
  description?: string;
  completedUpTo?: number;
}

export default function StepProgressBar({ currentStep, totalSteps, steps, description, completedUpTo }: StepProgressBarProps) {
  const currentStepData = steps[currentStep - 1];
  const maxCompleted = completedUpTo ?? currentStep;

  return (
    <div className="w-full mb-6">

      {/* ── Mobile ── */}
      <div className="md:hidden">
        <div 
          className="flex items-center justify-between mb-4 p-4 rounded-2xl shadow-sm border border-[#061E29]/10 bg-[#061E29] text-white"
        >
          <div className="flex flex-col">
            <span 
              className="text-[10px] font-bold uppercase tracking-widest opacity-85 text-white"
            >
              Step {currentStep} of {totalSteps}
            </span>
            <span 
              className="text-lg font-extrabold leading-tight text-white"
            >
              {currentStepData.title}
            </span>
            {description && (
              <span 
                className="text-xs font-medium mt-1 opacity-90 text-white"
              >
                {description}
              </span>
            )}
          </div>
          {/* Percentage badge: semi-transparent contrast on black bg */}
          <span
            className="text-xs font-bold tabular-nums px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/10 text-white"
          >
            {Math.round(((currentStep - 1) / (totalSteps - 1)) * 100)}%
          </span>
        </div>
        {/* Segmented track */}
        <div className="flex gap-1 px-1">
          {steps.map((step) => (
            <div
              key={step.id}
              className="h-1 flex-1 rounded-full transition-all duration-500"
              style={{
                backgroundColor:
                  step.id === currentStep
                    ? 'rgba(6,30,41,0.2)'
                    : step.id < maxCompleted
                    ? '#061E29'
                    : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Desktop — stepperize primitives ── */}
      <div className="hidden md:block">
        <Stepper.Root
          className="rounded-2xl border border-border/60 px-8 py-6 bg-card"
        >
          <Stepper.List className="flex items-center w-full">
            {steps.map((step, index) => {
              const isActive    = step.id === currentStep;
              // A step is "Done" if it's below the max reached and NOT the one we're currently on
              const isCompleted = step.id < maxCompleted && !isActive;
              const isLast      = index === steps.length - 1;

              return (
                <Stepper.Item
                  key={step.id}
                  step={`step-${step.id}` as never}
                  className="flex items-center flex-1 last:flex-none"
                >
                  <div className="flex flex-col items-center gap-2.5">
                    {/* Circle indicator */}
                    <Stepper.Indicator
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 border-2',
                        isCompleted
                          ? 'bg-[#061E29] border-[#061E29] text-white'
                          : isActive
                          ? 'bg-[#061E29] border-[#061E29] text-white shadow-[0_0_0_3px_rgba(6,30,41,0.1)]'
                          : 'bg-background border-border text-muted-foreground'
                      )}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.id}
                    </Stepper.Indicator>

                    {/* Label */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          "text-[10px] lg:text-[11px] font-semibold uppercase tracking-wider text-center whitespace-nowrap transition-colors duration-200",
                          isCompleted || isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {step.title}
                      </span>
                      {/* Status badge */}
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full transition-all duration-200",
                          isCompleted 
                            ? "bg-[#061E29] text-white" 
                            : isActive 
                            ? "bg-[#061E29]/10 text-[#061E29]" 
                            : "bg-transparent text-transparent"
                        )}
                      >
                        {isCompleted ? 'Done' : isActive ? 'Current' : '·'}
                      </span>
                    </div>
                  </div>

                  {/* Connector */}
                  {!isLast && (
                    <Stepper.Separator
                      className="flex-1 mx-3 h-px relative overflow-hidden rounded-full bg-border"
                      style={{ marginBottom: '2.25rem' }}
                    >
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-in-out bg-[#061E29]",
                          isCompleted ? "w-full" : "w-0"
                        )}
                      />
                    </Stepper.Separator>
                  )}
                </Stepper.Item>
              );
            })}
          </Stepper.List>
        </Stepper.Root>
      </div>

    </div>
  );
}
