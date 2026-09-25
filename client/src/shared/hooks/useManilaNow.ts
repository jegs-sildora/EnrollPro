import { useState, useEffect } from "react";
import { getManilaNow } from "@/shared/lib/utils";

/**
 * Hook that returns the current Manila time and updates on a specified interval.
 * Automatically respects the Time Machine mocked date.
 */
export function useManilaNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(getManilaNow);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getManilaNow());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
