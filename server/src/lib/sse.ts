import { Request, Response } from "express";

export interface SseEvent {
  type: string;
  keys: string[];
}

// Keep track of all active SSE connections
const activeClients = new Set<Response>();

/**
 * Middleware to establish an SSE connection
 */
export function streamEvents(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Important for NGINX/reverse proxies
  res.flushHeaders();

  // Add to active clients
  activeClients.add(res);

  // Send an initial heartbeat
  res.write(":\n\n");

  // Remove from active clients on close
  req.on("close", () => {
    activeClients.delete(res);
  });
}

/**
 * Broadcasts an invalidation event to all active clients
 * @param keys The React Query keys that should be invalidated
 */
export function broadcastInvalidation(keys: string[]) {
  const event: SseEvent = { type: "INVALIDATE", keys };
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  
  for (const client of activeClients) {
    // Attempt to write, but if it fails we could remove them, 
    // although req.on("close") usually handles it.
    client.write(payload);
  }
}
