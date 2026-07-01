import { useState, useEffect, useRef } from 'react';

const SSE_URL = '/api/eosy/stream';
const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

export interface EosyEventPayload {
  type: string;
  sectionId?: number;
}

export function useEosyStream(onEvent?: (payload: EosyEventPayload) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const optionsRef = useRef(onEvent);
  optionsRef.current = onEvent;

  const abortRef = useRef<AbortController | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let timerId: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (cancelled) return;

      eventSource = new EventSource(SSE_URL, { withCredentials: true });

      eventSource.onopen = () => {
        setIsConnected(true);
        backoffRef.current = INITIAL_BACKOFF_MS;
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as EosyEventPayload;
          optionsRef.current?.(payload);
        } catch (e) {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();
        
        // Reconnect with exponential backoff
        const currentBackoff = backoffRef.current;
        backoffRef.current = Math.min(currentBackoff * 1.5, MAX_BACKOFF_MS);
        timerId = setTimeout(connect, currentBackoff);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return { isConnected };
}
