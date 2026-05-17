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

const DEFAULT_COMPLETION_MESSAGE =
  "Everything has been set up. This window will close in {seconds} seconds...";

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

function useCompletionCountdown(enabled: boolean, seconds = 5): number {
  const initialSeconds = Math.max(1, Math.floor(seconds));
  const [countdown, setCountdown] = useState(initialSeconds);

  useEffect(() => {
    if (!enabled) {
      setCountdown(initialSeconds);
      return;
    }

    setCountdown(initialSeconds);

    const interval = setInterval(() => {
      setCountdown((current) => (current > 1 ? current - 1 : 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, initialSeconds]);

  return countdown;
}

export const LoaderCore = ({
  loadingStates,
  value = 0,
  stepDelay = 500,
  completionMessage = DEFAULT_COMPLETION_MESSAGE,
  completionCountdownSeconds = 5,
  showCompletionMessage = false,
}: {
  loadingStates: LoadingState[];
  value?: number;
  stepDelay?: number;
  completionMessage?: string;
  completionCountdownSeconds?: number;
  showCompletionMessage?: boolean;
}) => {
  const displayedValue = useAnimatedStep(value, stepDelay);
  const countdown = useCompletionCountdown(
    showCompletionMessage,
    completionCountdownSeconds,
  );
  const finalStepIndex = Math.max(loadingStates.length - 1, 0);
  const isFinalizing = showCompletionMessage && loadingStates.length > 0;
  const progressPercent = loadingStates.length === 0
    ? 0
    : Math.min(
        100,
        isFinalizing
          ? 100
          : ((Math.min(displayedValue + 1, loadingStates.length) / loadingStates.length) * 100),
      );
  const resolvedCompletionMessage = completionMessage.replace(
    "{seconds}",
    String(countdown),
  );

  return (
    <div className="flex w-full max-w-xl flex-col gap-3 mx-auto">
      <div className="h-1.5 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-emerald-500"
          initial={false}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>

      {loadingStates.map((loadingState, index) => {
        const isCompleted =
          index < displayedValue || (isFinalizing && index === finalStepIndex);
        const isCurrent =
          !isFinalizing &&
          index === displayedValue &&
          displayedValue < loadingStates.length;
        const isPending = index > displayedValue;
        const isFinalStep = index === finalStepIndex;

        return (
          <motion.div
            key={index}
            animate={{ opacity: isPending ? 0.35 : 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors",
              isCurrent && "border-primary/20 bg-primary/5 shadow-sm",
              isCompleted && isFinalStep && isFinalizing && "border-emerald-500/20 bg-emerald-500/5",
            )}
          >
            {/* Status icon */}
            <div className="shrink-0 flex h-5 w-6 items-center justify-center">
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
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-[0.98rem] leading-snug transition-colors duration-300",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : isCompleted
                      ? "font-medium text-muted-foreground"
                      : "font-medium text-muted-foreground/55",
                )}
              >
                {loadingState.text}
              </div>
              {isFinalStep && isFinalizing ? (
                <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Final checks complete
                </div>
              ) : null}
            </div>
          </motion.div>
        );
      })}

      <AnimatePresence>
        {isFinalizing ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm font-semibold text-emerald-950 shadow-sm"
          >
            {resolvedCompletionMessage}
          </motion.div>
        ) : null}
      </AnimatePresence>
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
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex min-h-dvh w-screen items-center justify-center overflow-hidden bg-white/80 backdrop-blur-2xl"
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
