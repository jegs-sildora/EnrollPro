import { useEffect, useState } from "react";

const DEFAULT_RETAIN_MS = 450;

export function useRetainedSheetValue<T>(
  value: T | null,
  retainMs = DEFAULT_RETAIN_MS,
): T | null {
  const [retainedValue, setRetainedValue] = useState<T | null>(value);

  const [prevValue, setPrevValue] = useState<T | null>(value);

  if (value !== null && value !== prevValue) {
    setPrevValue(value);
    setRetainedValue(value);
  }

  useEffect(() => {
    if (value !== null) {
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
