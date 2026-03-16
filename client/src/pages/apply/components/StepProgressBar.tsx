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
          className="flex items-center justify-between mb-4 p-4 rounded-2xl shadow-sm border border-accent/10"
          style={{ backgroundColor: 'hsl(var(--accent))' }}
        >
          <div className="flex flex-col">
            <span 
              className="text-[10px] font-bold uppercase tracking-widest opacity-85"
              style={{ color: 'hsl(var(--accent-foreground))' }}
            >
              Step {currentStep} of {totalSteps}
            </span>
            <span 
              className="text-lg font-extrabold leading-tight"
              style={{ color: 'hsl(var(--accent-foreground))' }}
            >
              {currentStepData.title}
            </span>
            {description && (
              <span 
                className="text-xs font-medium mt-1 opacity-90"
                style={{ color: 'hsl(var(--accent-foreground))' }}
              >
                {description}
              </span>
            )}
          </div>
          {/* Percentage badge: semi-transparent contrast on accent bg */}
          <span
            className="text-xs font-bold tabular-nums px-3 py-1.5 rounded-full bg-background/20 backdrop-blur-md border border-background/10"
            style={{
              color: 'hsl(var(--accent-foreground))',
            }}
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
                    ? 'hsl(var(--accent) / 0.4)'
                    : step.id < maxCompleted
                    ? 'hsl(var(--accent))'
                    : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Desktop — stepperize primitives ── */}
      <div className="hidden md:block">
        <Stepper.Root
          className="rounded-2xl border border-border/60 px-8 py-6"
          style={{ backgroundColor: 'hsl(var(--card))' }}
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
                      )}
                      style={{
                        backgroundColor: isCompleted
                          ? 'hsl(var(--accent))'
                          : isActive
                          ? 'hsl(var(--sidebar-accent))'
                          : 'hsl(var(--background))',
                        borderColor: isCompleted || isActive
                          ? 'hsl(var(--accent))'
                          : 'hsl(var(--border))',
                        color: isCompleted
                          ? 'hsl(var(--accent-foreground))'
                          : isActive
                          ? 'hsl(var(--sidebar-accent-foreground))'
                          : 'hsl(var(--muted-foreground))',
                        boxShadow: isActive
                          ? '0 0 0 3px hsl(var(--accent) / 0.2)'
                          : 'none',
                      }}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.id}
                    </Stepper.Indicator>

                    {/* Label */}
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-[10px] lg:text-[11px] font-semibold uppercase tracking-wider text-center whitespace-nowrap transition-colors duration-200"
                        style={{
                          color: isCompleted || isActive
                            ? 'hsl(var(--foreground))'
                            : 'hsl(var(--muted-foreground))',
                        }}
                      >
                        {step.title}
                      </span>
                      {/* Status badge: accent bg → accent-foreground text (WCAG) */}
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full transition-all duration-200"
                        style={
                          isCompleted
                            ? {
                                backgroundColor: 'hsl(var(--accent))',
                                color: 'hsl(var(--accent-foreground))',
                              }
                            : isActive
                            ? {
                                backgroundColor: 'hsl(var(--accent) / 0.12)',
                                color: 'hsl(var(--accent))',
                              }
                            : {
                                backgroundColor: 'transparent',
                                color: 'transparent',
                              }
                        }
                      >
                        {isCompleted ? 'Done' : isActive ? 'Current' : '·'}
                      </span>
                    </div>
                  </div>

                  {/* Connector */}
                  {!isLast && (
                    <Stepper.Separator
                      className="flex-1 mx-3 h-px relative overflow-hidden rounded-full"
                      style={{
                        marginBottom: '2.25rem',
                        backgroundColor: 'hsl(var(--border))',
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-in-out"
                        style={{
                          width: isCompleted ? '100%' : '0%',
                          backgroundColor: 'hsl(var(--accent))',
                        }}
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
