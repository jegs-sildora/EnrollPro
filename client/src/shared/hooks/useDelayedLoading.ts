import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage delayed loading states to prevent "flickering" of skeletons.
 *
 * Defaults to 0ms for immediate feedback.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = 0,
  minDisplay: number = 0,
): boolean {
  // If no delay or min display is requested, just return the raw loading state.
  if (delay === 0 && minDisplay === 0) {
    return isLoading;
  }

  const [showLoading, setShowLoading] = useState(false);
  const showStartTime = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (isLoading) {
      if (showLoading || timerRef.current) return;

      timerRef.current = setTimeout(() => {
        setShowLoading(true);
        showStartTime.current = Date.now();
        timerRef.current = null;
      }, delay);
    } else {
      if (timerRef.current) {
        clearTimer();
        return;
      }

      if (showLoading) {
        const elapsed = Date.now() - showStartTime.current;
        const remaining = Math.max(0, minDisplay - elapsed);

        // Always use a timer to avoid sync state updates in effects (Linter Rule)
        timerRef.current = setTimeout(() => {
          setShowLoading(false);
          timerRef.current = null;
        }, remaining);
      }
    }

    return () => clearTimer();
  }, [isLoading, delay, minDisplay, showLoading]);

  return showLoading;
}
