import type { Request, Response } from "express";
import {
  REALTIME_INVALIDATION_TOPICS,
  type RealtimeInvalidationEvent,
  type RealtimeInvalidationTopic,
} from "@enrollpro/shared";

interface SseClient {
  res: Response;
  heartbeat: ReturnType<typeof setInterval>;
}

const activeClients = new Set<SseClient>();

function writeSseEvent(
  client: SseClient,
  eventName: string,
  payload: unknown,
): void {
  client.res.write(`event: ${eventName}\n`);
  client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function isRealtimeInvalidationTopic(
  value: string,
): value is RealtimeInvalidationTopic {
  return REALTIME_INVALIDATION_TOPICS.includes(
    value as RealtimeInvalidationTopic,
  );
}

/**
 * Middleware to establish an SSE connection
 */
export function streamEvents(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Important for NGINX/reverse proxies
  res.flushHeaders();

  const client: SseClient = {
    res,
    heartbeat: setInterval(() => {
      res.write(":\n\n");
    }, 25_000),
  };

  activeClients.add(client);
  res.write(":\n\n");

  req.on("close", () => {
    clearInterval(client.heartbeat);
    activeClients.delete(client);
  });
}

export function broadcastRealtimeInvalidation(
  event: Omit<RealtimeInvalidationEvent, "type" | "emittedAt"> & {
    emittedAt?: string;
  },
): void {
  if (event.topics.length === 0) {
    return;
  }

  const payload: RealtimeInvalidationEvent = {
    type: "invalidate",
    ...event,
    emittedAt: event.emittedAt ?? new Date().toISOString(),
  };

  for (const client of activeClients) {
    try {
      writeSseEvent(client, "invalidate", payload);
    } catch {
      clearInterval(client.heartbeat);
      activeClients.delete(client);
    }
  }
}

/**
 * Broadcasts an invalidation event to all active clients
 * @param keys The React Query keys that should be invalidated
 */
export function broadcastInvalidation(keys: string[]) {
  const topics = keys.filter(isRealtimeInvalidationTopic);
  broadcastRealtimeInvalidation({ topics });
}
