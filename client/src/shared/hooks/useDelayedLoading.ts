import { useState, useEffect, useRef } from "react";

/**
 * Hook to manage loading states.
 * Modified to ensure loading skeletons appear immediately ON EVERY MOUNT
 * and display for a MINIMUM amount of time (default 400ms) to prevent flashing.
 */
export function useDelayedLoading(isLoading: boolean, minimumLoadTimeMs = 400) {
  // Always start as true to enforce minimum loading skeleton on mount
  const [isShowingLoading, setIsShowingLoading] = useState(true);
  
  // Do not initialize with Date.now() during render, as React Suspense or 
  // concurrent rendering can cause long delays before the effect actually runs.
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const activationFrameRef = useRef<number | null>(null);
  const prevIsLoading = useRef<boolean>(isLoading);

  useEffect(() => {
    // Set the start time exactly when the component is mounted and painted to the screen
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    // Detect transition from false -> true to reset the timer for subsequent loads
    if (isLoading && !prevIsLoading.current) {
      startTimeRef.current = Date.now();
    }
    prevIsLoading.current = isLoading;

    if (isLoading) {
      activationFrameRef.current = window.requestAnimationFrame(() => {
        setIsShowingLoading(true);
        activationFrameRef.current = null;
      });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= minimumLoadTimeMs) {
        activationFrameRef.current = window.requestAnimationFrame(() => {
          setIsShowingLoading(false);
          activationFrameRef.current = null;
        });
      } else {
        const remaining = minimumLoadTimeMs - elapsed;
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(() => {
          setIsShowingLoading(false);
        }, remaining);
      }
    }

    return () => {
      if (activationFrameRef.current) {
        window.cancelAnimationFrame(activationFrameRef.current);
        activationFrameRef.current = null;
      }
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, minimumLoadTimeMs]);

  // A request can start between renders. Include the source state directly so
  // consumers never render an empty result before this hook's effect runs.
  return isLoading || isShowingLoading;
}
