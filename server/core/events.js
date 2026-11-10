// Server-Sent Events hub: routes call broadcast(), browsers subscribe via GET /api/events.
const clients = new Map(); // response -> receives full payloads (managers) or bare pings (employees)

export function broadcast(event, payload) {
  if (!clients.size) return;
  const full = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  const ping = `event: ${event}\ndata: {}\n\n`;
  for (const [response, manager] of clients) {
    try {
      response.write(manager ? full : ping);
    } catch {
      clients.delete(response);
    }
  }
}

export function subscribe(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(
    `event: connected\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`
  );
  clients.set(res, ["manager", "admin"].includes(req.employee?.role));

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
}

export const clientCount = () => clients.size;
