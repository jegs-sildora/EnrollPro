"use client";
import { cn } from "@/shared/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect, useRef } from "react";

const CheckFilled = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("w-4 h-4", className)}
  >
    <path
      fillRule="evenodd"
      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
      clipRule="evenodd"
    />
  </svg>
);

/** Three dots that bounce in a wave pattern for the active loading step. */
const WaveDots = () => (
  <div className="flex items-center gap-[3px]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="block h-[5px] w-[5px] rounded-full bg-primary"
        animate={{ y: [0, -5, 0] }}
        transition={{
          duration: 0.9,
          repeat: Infinity,
          delay: i * 0.15,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

export type LoadingState = {
  text: string;
};

/**
 * Smoothly follows `target` with `stepDelay` ms between each integer step.
 * Resets immediately when target goes backward (e.g. loader is closed/reset).
 */
function useAnimatedStep(target: number, stepDelay = 500) {
  const [displayed, setDisplayed] = useState(target);
  const stateRef = useRef({ displayed: target, target, timer: null as ReturnType<typeof setTimeout> | null });

  useEffect(() => {
    stateRef.current.target = target;

    if (target < stateRef.current.displayed) {
      // Hard reset downward
      if (stateRef.current.timer) {
        clearTimeout(stateRef.current.timer);
        stateRef.current.timer = null;
      }
      stateRef.current.displayed = target;
      setDisplayed(target);
      return;
    }

    if (stateRef.current.timer === null && target > stateRef.current.displayed) {
      const tick = () => {
        const s = stateRef.current;
        if (s.displayed < s.target) {
          s.displayed += 1;
          setDisplayed(s.displayed);
          s.timer = setTimeout(tick, stepDelay);
        } else {
          s.timer = null;
        }
      };
      stateRef.current.timer = setTimeout(tick, stepDelay);
    }
  }, [target, stepDelay]);

  return displayed;
}

export const LoaderCore = ({
  loadingStates,
  value = 0,
  stepDelay = 500,
}: {
  loadingStates: LoadingState[];
  value?: number;
  stepDelay?: number;
}) => {
  const displayedValue = useAnimatedStep(value, stepDelay);

  return (
    <div className="flex flex-col gap-2 w-full max-w-lg mx-auto">
      {loadingStates.map((loadingState, index) => {
        const isCompleted = index < displayedValue;
        const isCurrent =
          index === displayedValue && displayedValue < loadingStates.length;
        const isPending = index > displayedValue;

        return (
          <motion.div
            key={index}
            animate={{ opacity: isPending ? 0.35 : 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              isCurrent && "bg-primary/5 ring-1 ring-primary/15",
            )}
          >
            {/* Status icon */}
            <div className="shrink-0 flex items-center justify-center w-6 h-5">
              <AnimatePresence mode="wait">
                {isCompleted ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <CheckFilled className="text-primary" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    key="dots"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <WaveDots />
                  </motion.div>
                ) : (
                  <motion.div
                    key="pending"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.5 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="block h-[6px] w-[6px] rounded-full border border-muted-foreground/40" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Step text */}
            <span
              className={cn(
                "text-md leading-snug transition-colors duration-300",
                isCurrent
                  ? "text-foreground font-semibold"
                  : isCompleted
                    ? "text-muted-foreground font-medium"
                    : "text-muted-foreground/50 font-medium",
              )}
            >
              {loadingState.text}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = true,
}: {
  loadingStates: LoadingState[];
  loading?: boolean;
  duration?: number;
  loop?: boolean;
}) => {
  const [currentState, setCurrentState] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      setCurrentState((prevState) =>
        loop
          ? prevState === loadingStates.length - 1
            ? 0
            : prevState + 1
          : Math.min(prevState + 1, loadingStates.length - 1),
      );
    }, duration);
    return () => clearTimeout(timeout);
  }, [currentState, loading, loop, loadingStates.length, duration]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-white/75 backdrop-blur-2xl"
        >
          <div className="absolute inset-0 pointer-events-none">
            <svg
              aria-hidden="true"
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <pattern
                  id="multi-step-loader-pixel-grid"
                  x="0"
                  y="0"
                  width="80"
                  height="80"
                  patternUnits="userSpaceOnUse"
                >
                  <rect
                    x="2"
                    y="2"
                    width="36"
                    height="36"
                    rx="6"
                    fill="none"
                    stroke="rgba(128,0,0,0.12)"
                    strokeWidth="1.1"
                  />
                  <rect
                    x="42"
                    y="2"
                    width="36"
                    height="36"
                    rx="6"
                    fill="none"
                    stroke="rgba(128,0,0,0.1)"
                    strokeWidth="1.1"
                  />
                  <rect
                    x="2"
                    y="42"
                    width="36"
                    height="36"
                    rx="6"
                    fill="none"
                    stroke="rgba(128,0,0,0.09)"
                    strokeWidth="1.1"
                  />
                  <rect
                    x="42"
                    y="42"
                    width="36"
                    height="36"
                    rx="6"
                    fill="none"
                    stroke="rgba(128,0,0,0.11)"
                    strokeWidth="1.1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#multi-step-loader-pixel-grid)" />
            </svg>
          </div>

          <div className="relative z-10 w-full max-w-3xl px-6">
            <LoaderCore value={currentState} loadingStates={loadingStates} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
