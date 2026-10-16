import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { FRONTEND_URL, PORT } from "./config";
import { registerRoomEvents } from "./sockets/registerRoomEvents";

// Permit normal localhost and private LAN origins during development so a
// phone scanning the TV's QR code can join. Production accepts only the
// configured FRONTEND_URL (or a comma-separated list of trusted origins).
const configuredOrigins = new Set(FRONTEND_URL.split(",").map(url => url.trim()).filter(Boolean));
function isDevelopmentLanOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.port !== "5173") return false;
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
    const parts = host.split(".").map(Number);
    if (parts.some(part => part > 255)) return false;
    return parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  } catch {
    return false;
  }
}
function allowFrontendOrigin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
  callback(null, !origin || configuredOrigins.has(origin) || isDevelopmentLanOrigin(origin));
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowFrontendOrigin, methods: ["GET", "POST"] },
});
app.use(cors({ origin: allowFrontendOrigin }));
app.get("/", (_req, res) => res.send("Party Game Server is running!"));
io.on("connection", (socket) => registerRoomEvents(io, socket));

httpServer.listen(PORT, () => {
  console.log(`Party Game Server running on http://localhost:${PORT}`);
});
