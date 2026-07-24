import type { Request, Response } from "express";
import {
  type RealtimeInvalidationEvent,
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
