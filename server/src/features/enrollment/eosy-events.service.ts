import { Response } from "express";

let clients: Response[] = [];

// Send a keep-alive comment every 30 seconds to prevent proxies from dropping idle connections
setInterval(() => {
  const heartbeat = ":\n\n";
  clients.forEach((client) => {
    try {
      client.write(heartbeat);
      if (typeof (client as any).flush === "function") {
        (client as any).flush();
      }
    } catch (e) {
      // Ignore errors if client is disconnected
    }
  });
}, 30000);

export function addEosyClient(res: Response) {
  clients.push(res);
  res.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
}

export function broadcastEosyUpdate(payload: any) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((client) => {
    try {
      client.write(data);
      if (typeof (client as any).flush === "function") {
        (client as any).flush();
      }
    } catch (e) {
      // Ignore errors if client is disconnected
    }
  });
}
