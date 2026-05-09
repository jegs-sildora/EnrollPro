import { useState, useEffect } from 'react';

/**
 * Hook to manage delayed loading states to prevent "flickering" of skeletons.
 * 
 * Only returns 'true' if the loading state persists past the delay threshold.
 * Standard Enterprise Delay: 200ms
 * 
 * Logic:
 * 1. If loading finishes before 200ms (Fast Network) -> returns false (No skeleton).
 * 2. If loading exceeds 200ms (Slow Network) -> returns true (Show skeleton).
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 200) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    if (isLoading) {
      timeout = setTimeout(() => setShowLoading(true), delayMs);
    } else {
      setShowLoading(false);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isLoading, delayMs]);

  return showLoading;
}
