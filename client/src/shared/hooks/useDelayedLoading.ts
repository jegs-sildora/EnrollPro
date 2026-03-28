import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage delayed loading states to prevent "flickering" of skeletons.
 * 
 * Rule A: The 250ms Threshold. Don't show loading if it's faster than this.
 * Rule B: Minimum Display Time. If shown, stay for at least 450ms.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = 250,
  minDisplay: number = 450
): boolean {
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
