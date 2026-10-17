import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { FRONTEND_URL, PORT } from "./config";
import { registerRoomEvents } from "./sockets/registerRoomEvents";
import {
  allowedOrigins, allowNewConnection, isAllowedBrowserOrigin,
  MAX_CONNECTED_CLIENTS, MAX_SOCKET_MESSAGE_BYTES,
} from "./security";

const production = process.env.NODE_ENV === "production";
// Fail closed in production if the permitted website was not configured.
const configuredOrigins = allowedOrigins(production ? process.env.FRONTEND_URL : FRONTEND_URL, production);
const acceptsOrigin = (origin: string | undefined) =>
  isAllowedBrowserOrigin(origin, configuredOrigins, production);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, acceptsOrigin(origin)),
    methods: ["GET", "POST"],
  },
  // CORS does not stop non-browser Socket.IO clients. Check the handshake too.
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    const accepted = acceptsOrigin(origin) &&
      io.of("/").sockets.size < MAX_CONNECTED_CLIENTS &&
      allowNewConnection();
    callback(null, accepted);
  },
  maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
});
app.use(cors({ origin: (origin, callback) => callback(null, acceptsOrigin(origin)) }));
app.get("/", (_req, res) => res.send("Party Game Server is running!"));
app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok" });
});
io.on("connection", (socket) => registerRoomEvents(io, socket));

// Preserve LAN access for local multiplayer QA; production is tunnel-only.
const listenHost = production ? "127.0.0.1" : "0.0.0.0";
httpServer.listen(PORT, listenHost, () => {
  console.log(`Party Game Server running on http://${listenHost}:${PORT}`);
});
