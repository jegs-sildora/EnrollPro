import { Response } from "express";

let clients: Response[] = [];

interface FlushableResponse extends Response {
  flush?: () => void;
}

function flushIfAvailable(client: Response): void {
  const flush = (client as FlushableResponse).flush;
  if (typeof flush === "function") {
    flush.call(client);
  }
}

// Send a keep-alive comment every 30 seconds to prevent proxies from dropping idle connections
const heartbeatInterval = setInterval(() => {
  const heartbeat = ":\n\n";
  clients.forEach((client) => {
    try {
      client.write(heartbeat);
      flushIfAvailable(client);
    } catch {
      // Ignore errors if client is disconnected
    }
  });
}, 30000);
heartbeatInterval.unref();

export function addEosyClient(res: Response) {
  clients.push(res);
  res.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
}

export function broadcastEosyUpdate(payload: unknown) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => {
    try {
      client.write(data);
      flushIfAvailable(client);
    } catch {
      // Ignore errors if client is disconnected
    }
  });
}
