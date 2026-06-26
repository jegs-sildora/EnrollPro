import { useEffect, useState } from "react";

const DEFAULT_RETAIN_MS = 450;

export function useRetainedSheetValue<T>(
  value: T | null,
  retainMs = DEFAULT_RETAIN_MS,
): T | null {
  const [retainedValue, setRetainedValue] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setRetainedValue(value);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRetainedValue(null);
    }, retainMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [retainMs, value]);

  return retainedValue;
}
