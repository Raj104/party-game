import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { FRONTEND_URL, PORT } from "./config";
import { registerRoomEvents } from "./sockets/registerRoomEvents";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
});
app.use(cors({ origin: FRONTEND_URL }));
app.get("/", (_req, res) => res.send("Party Game Server is running!"));
io.on("connection", (socket) => registerRoomEvents(io, socket));

httpServer.listen(PORT, () => {
  console.log(`Party Game Server running on http://localhost:${PORT}`);
});
