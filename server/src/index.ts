
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = "http://localhost:5173";
const PORT = Number(process.env.PORT) || 3001;

const MAX_PLAYERS = 12;
const RECONNECT_GRACE_MS = 180_000;

app.use(cors({ origin: FRONTEND_URL }));

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
  },
});

type Player = {
  id: string;
  name: string;
  token: string;
  socketId: string | null;
  reconnectTimer?: ReturnType<typeof setTimeout>;
};

type Room = {
  code: string;
  players: Player[];
  displays: Set<string>;
};

const rooms = new Map<string, Room>();

// -------------------------------------
// VALIDATION AND ROOM HELPERS
// -------------------------------------

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function validateName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = normalizeName(value);

  if (name.length < 1 || name.length > 20) {
    return null;
  }

  return name;
}

function nameTaken(room: Room, name: string): boolean {
  const normalized = name.toLowerCase();

  return room.players.some(
    (player) => player.name.toLowerCase() === normalized
  );
}

function generateRoomCode(): string {
  let code: string;

  do {
    code = Array.from({ length: 4 }, () =>
      String.fromCharCode(65 + randomInt(26))
    ).join("");
  } while (rooms.has(code));

  return code;
}

function createPlayer(name: string, socket: Socket): Player {
  return {
    id: randomUUID(),
    name,
    token: randomBytes(32).toString("hex"),
    socketId: socket.id,
  };
}

function publicRoom(room: Room) {
  return {
    code: room.code,
    players: room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      isHost: index === 0,
      connected: player.socketId !== null,
    })),
    displayCount: room.displays.size,
  };
}

function updateRoom(room: Room) {
  io.to(room.code).emit("room_updated", publicRoom(room));
}

// -------------------------------------
// PLAYER REMOVAL AND ROOM CLEANUP
// -------------------------------------

function removePlayer(room: Room, playerId: string) {
  const player = room.players.find(
    (entry) => entry.id === playerId
  );

  if (!player) return;

  if (player.reconnectTimer) {
    clearTimeout(player.reconnectTimer);
  }

  room.players = room.players.filter(
    (entry) => entry.id !== playerId
  );

  if (room.players.length === 0) {
    io.to(room.code).emit("room_closed");

    // Remove any TV displays from the closed room.
    for (const displayId of room.displays) {
      const displaySocket = io.sockets.sockets.get(displayId);

      if (displaySocket) {
        displaySocket.leave(room.code);
        delete displaySocket.data.roomCode;
        delete displaySocket.data.role;
        delete displaySocket.data.playerId;
      }
    }

    room.displays.clear();
    rooms.delete(room.code);

    console.log(`Room ${room.code} closed`);
  } else {
    updateRoom(room);
  }
}

// "grace" is true for unexpected disconnections,
// false for a player deliberately leaving.
function leaveRoom(socket: Socket, grace = false) {
  const code = socket.data.roomCode as string | undefined;
  const role = socket.data.role as string | undefined;
  const playerId = socket.data.playerId as string | undefined;

  if (!code) return;

  socket.leave(code);

  delete socket.data.roomCode;
  delete socket.data.role;
  delete socket.data.playerId;

  const room = rooms.get(code);
  if (!room) return;

  if (role === "display") {
    room.displays.delete(socket.id);
    updateRoom(room);
    return;
  }

  if (role !== "player" || !playerId) return;

  const player = room.players.find(
    (entry) => entry.id === playerId
  );

  // Ignore stale sockets that no longer own this player.
  if (!player || player.socketId !== socket.id) {
    return;
  }

  player.socketId = null;

  if (!grace) {
    removePlayer(room, player.id);
    return;
  }

  if (player.reconnectTimer) {
    clearTimeout(player.reconnectTimer);
  }

  // Keep this player in the room temporarily.
  player.reconnectTimer = setTimeout(() => {
    if (
      rooms.get(code) === room &&
      player.socketId === null
    ) {
      removePlayer(room, player.id);
      console.log(`${player.name} timed out of room ${code}`);
    }
  }, RECONNECT_GRACE_MS);

  updateRoom(room);

  console.log(
    `${player.name} disconnected from ${code}; spot reserved`
  );
}

// -------------------------------------
// EXPRESS
// -------------------------------------

app.get("/", (_req, res) => {
  res.send("Party Game Server is running!");
});

// -------------------------------------
// SOCKET.IO
// -------------------------------------

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // CREATE ROOM
  socket.on("create_room", (rawName, callback) => {
    if (typeof callback !== "function") return;

    const name = validateName(rawName);

    if (!name) {
      callback({
        ok: false,
        error: "Enter a nickname (1-20 characters).",
      });
      return;
    }

    leaveRoom(socket);

    const code = generateRoomCode();
    const player = createPlayer(name, socket);

    const room: Room = {
      code,
      players: [player],
      displays: new Set(),
    };

    rooms.set(code, room);

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "player";
    socket.data.playerId = player.id;

    callback({
      ok: true,
      room: publicRoom(room),
      token: player.token,
      playerId: player.id,
    });

    updateRoom(room);

    console.log(`${name} created ${code}`);
  });

  // JOIN ROOM
  socket.on("join_room", (rawCode, rawName, callback) => {
    if (typeof callback !== "function") return;

    const name = validateName(rawName);

    const code =
      typeof rawCode === "string"
        ? rawCode.trim().toUpperCase()
        : "";

    if (!name) {
      callback({
        ok: false,
        error: "Enter a nickname (1-20 characters).",
      });
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      callback({
        ok: false,
        error: "Room not found.",
      });
      return;
    }

    // Check uniqueness before changing any room membership.
    if (nameTaken(room, name)) {
      callback({
        ok: false,
        error: "That nickname is already taken in this room.",
      });
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      callback({
        ok: false,
        error: "This room is full.",
      });
      return;
    }

    leaveRoom(socket);

    const player = createPlayer(name, socket);

    room.players.push(player);

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "player";
    socket.data.playerId = player.id;

    callback({
      ok: true,
      room: publicRoom(room),
      token: player.token,
      playerId: player.id,
    });

    updateRoom(room);

    console.log(`${name} joined ${code}`);
  });

  // RECONNECT TO EXISTING PLAYER SESSION
  socket.on("resume_room", (rawCode, rawToken, callback) => {
    if (typeof callback !== "function") return;

    const code =
      typeof rawCode === "string"
        ? rawCode.trim().toUpperCase()
        : "";

    const token =
      typeof rawToken === "string" ? rawToken : "";

    const room = rooms.get(code);

    const player = room?.players.find(
      (entry) => entry.token === token
    );

    if (!room || !player || !token) {
      callback({
        ok: false,
        error: "Your previous session has expired.",
      });
      return;
    }

    // This exact socket may already own the session.
    if (player.socketId === socket.id) {
      callback({ ok: true, room: publicRoom(room) });
      return;
    }

    leaveRoom(socket);

    // If an older socket still exists, replace it.
    // This prevents the same player controlling two tabs.
    if (player.socketId) {
      const oldSocket = io.sockets.sockets.get(
        player.socketId
      );

      if (oldSocket) {
        oldSocket.emit("session_replaced");
        oldSocket.leave(code);

        delete oldSocket.data.roomCode;
        delete oldSocket.data.role;
        delete oldSocket.data.playerId;

        oldSocket.disconnect(true);
      }
    }

    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = undefined;
    }

    player.socketId = socket.id;

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "player";
    socket.data.playerId = player.id;

    callback({
      ok: true,
      room: publicRoom(room),
    });

    updateRoom(room);

    console.log(`${player.name} reconnected to ${code}`);
  });

  // JOIN AS TV DISPLAY
  socket.on("watch_room", (rawCode, callback) => {
    if (typeof callback !== "function") return;

    const code =
      typeof rawCode === "string"
        ? rawCode.trim().toUpperCase()
        : "";

    const room = rooms.get(code);

    if (!room) {
      callback({
        ok: false,
        error: "Room not found.",
      });
      return;
    }

    if (
      socket.data.roomCode === code &&
      socket.data.role === "player"
    ) {
      callback({
        ok: false,
        error: "Open the TV in a separate tab.",
      });
      return;
    }

    leaveRoom(socket);

    room.displays.add(socket.id);

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "display";

    callback({
      ok: true,
      room: publicRoom(room),
    });

    updateRoom(room);
  });

  // INTENTIONAL LEAVE
  socket.on("leave_room", () => {
    leaveRoom(socket, false);
  });

  // UNEXPECTED DISCONNECT
  socket.on("disconnect", () => {
    leaveRoom(socket, true);
    console.log("Disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `Party Game Server running on http://localhost:${PORT}`
  );
});
