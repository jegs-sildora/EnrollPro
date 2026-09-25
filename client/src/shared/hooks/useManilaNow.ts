import { useCallback, useEffect, useState } from "react";
import { getManilaNow, getMockedSystemDate } from "@/shared/lib/utils";
import { useSettingsStore } from "@/store/settings.slice";

/**
 * Hook that returns the current Manila time and updates on a specified interval.
 * Automatically respects the Time Machine mocked date.
 */
export function useManilaNow(intervalMs = 1000): Date {
  const currentSystemDate = useSettingsStore((state) => state.currentSystemDate);
  const currentSystemDateReceivedAt = useSettingsStore(
    (state) => state.currentSystemDateReceivedAt,
  );

  const resolveCurrentDate = useCallback((): Date => {
    const localMock = getMockedSystemDate();
    if (localMock) return localMock;

    if (currentSystemDate && currentSystemDateReceivedAt) {
      const serverDate = new Date(currentSystemDate);
      if (!Number.isNaN(serverDate.getTime())) {
        const elapsedMilliseconds = Math.max(
          0,
          Date.now() - currentSystemDateReceivedAt,
        );
        return new Date(serverDate.getTime() + elapsedMilliseconds);
      }
    }

    return getManilaNow();
  }, [currentSystemDate, currentSystemDateReceivedAt]);

  const [now, setNow] = useState(resolveCurrentDate);

  useEffect(() => {
    setNow(resolveCurrentDate());
    const timer = setInterval(() => {
      setNow(resolveCurrentDate());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, resolveCurrentDate]);

  return now;
}
