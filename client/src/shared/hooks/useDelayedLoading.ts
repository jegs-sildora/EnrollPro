import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage delayed loading states to prevent "flickering" of skeletons.
 *
 * Defaults to 300ms delay to avoid flashing for fast requests.
 * Defaults to 500ms min display to ensure the skeleton is readable if shown.
 */
export function useDelayedLoading(
  isLoading: boolean,
  delay: number = 300,
  minDisplay: number = 500,
): boolean {
  const [showLoading, setShowLoading] = useState(false);
  const showStartTimeRef = useRef<number>(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // If we are starting to load
    if (isLoading) {
      // Clear any pending exit timers
      if (minDisplayTimerRef.current) {
        clearTimeout(minDisplayTimerRef.current);
        minDisplayTimerRef.current = null;
      }

      // If not already showing, start the delay timer
      if (!showLoading && !delayTimerRef.current) {
        delayTimerRef.current = setTimeout(() => {
          setShowLoading(true);
          showStartTimeRef.current = Date.now();
          delayTimerRef.current = null;
        }, delay);
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
      }
    }

    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
      if (minDisplayTimerRef.current) clearTimeout(minDisplayTimerRef.current);
    };
  }, [isLoading, delay, minDisplay, showLoading]);

  // If no delay or min display is requested, fallback to raw isLoading
  if (delay === 0 && minDisplay === 0) {
    return isLoading;
  }

  return showLoading;
}
