import { useEffect, useState } from "react";

const DEFAULT_RETAIN_MS = 450;

export function useRetainedSheetValue<T>(
  value: T | null,
  retainMs = DEFAULT_RETAIN_MS,
): T | null {
  const [retainedValue, setRetainedValue] = useState<T | null>(value);

  const [prevValue, setPrevValue] = useState<T | null>(value);

  let currentRetainedValue = retainedValue;

  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== null) {
      setRetainedValue(value);
      currentRetainedValue = value;
    }
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

  return currentRetainedValue;
}
