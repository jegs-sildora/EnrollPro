import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage delayed loading states to prevent "flickering" of skeletons.
 *
 * Defaults to 0ms delay to ensure the skeleton is shown immediately.
 * Defaults to 300ms min display to ensure the skeleton is readable if shown.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = 0,
  minDisplay: number = 300,
): boolean {
  // Initialize state immediately if delay is 0
  const [showLoading, setShowLoading] = useState(isLoading && delay === 0);
  const showStartTimeRef = useRef<number>(isLoading && delay === 0 ? Date.now() : 0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If we are starting to load
    if (isLoading) {
      // Clear any pending exit timers since we're loading again
      if (minDisplayTimerRef.current) {
        clearTimeout(minDisplayTimerRef.current);
        minDisplayTimerRef.current = null;
      }

      // If not already showing, start the delay timer
      if (!showLoading && !delayTimerRef.current) {
        if (delay === 0) {
          setShowLoading(true);
          showStartTimeRef.current = Date.now();
        } else {
          delayTimerRef.current = setTimeout(() => {
            setShowLoading(true);
            showStartTimeRef.current = Date.now();
            delayTimerRef.current = null;
          }, delay);
        }
      }
    } 
    // If we stopped loading
    else {
      // Clear any pending entry timers
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }

      // If we are currently showing, enforce minimum display time
      if (showLoading && !minDisplayTimerRef.current) {
        const elapsed = Date.now() - showStartTimeRef.current;
        const remaining = Math.max(0, minDisplay - elapsed);

        minDisplayTimerRef.current = setTimeout(() => {
          setShowLoading(false);
          minDisplayTimerRef.current = null;
        }, remaining);
      } else if (!showLoading) {
        // Just in case we're not showing and loading stopped
        showStartTimeRef.current = 0;
      }
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (minDisplayTimerRef.current) clearTimeout(minDisplayTimerRef.current);
    };
  }, [isLoading, delay, minDisplay, showLoading]);

  return showLoading;
}
