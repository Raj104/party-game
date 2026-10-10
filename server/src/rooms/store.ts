import { randomBytes, randomInt, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { RECONNECT_GRACE_MS } from "../config";
import type { Player, Room } from "../types";

export const rooms = new Map<string, Room>();

export function validateName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= 20 ? name : null;
}

export function nameTaken(room: Room, name: string): boolean {
  const normalized = name.toLowerCase();
  return room.players.some((player) => player.name.toLowerCase() === normalized);
}

export function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => String.fromCharCode(65 + randomInt(26))).join("");
  } while (rooms.has(code));
  return code;
}

export function createPlayer(name: string, socket: Socket): Player {
  return {
    id: randomUUID(),
    name,
    token: randomBytes(32).toString("hex"),
    socketId: socket.id,
  };
}

// The server never exposes reconnect tokens in room broadcasts.
export function publicRoom(room: Room) {
  return {
    code: room.code,
    players: room.players.map((player, index) => ({
      id: player.id,
      name: player.name,
      isHost: index === 0,
      connected: player.socketId !== null,
    })),
    displayCount: room.displays.size,
    phase: room.phase,
    selectedGame: room.selectedGame,
  };
}

export function updateRoom(io: Server, room: Room) {
  io.to(room.code).emit("room_updated", publicRoom(room));
}

export function removePlayer(io: Server, room: Room, playerId: string) {
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player) return;
  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);

  room.players = room.players.filter((entry) => entry.id !== playerId);
  if (room.players.length === 0) {
    io.to(room.code).emit("room_closed");
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
    updateRoom(io, room);
  }
}

// Unexpected disconnections reserve a player's position until the grace period expires.
// Intentional "Leave Room" removes that player immediately.
export function leaveRoom(io: Server, socket: Socket, grace = false) {
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
    updateRoom(io, room);
    return;
  }
  if (role !== "player" || !playerId) return;

  const player = room.players.find((entry) => entry.id === playerId);
  // Prevent a replaced socket from removing the new owner's session.
  if (!player || player.socketId !== socket.id) return;

  player.socketId = null;
  if (!grace) {
    removePlayer(io, room, player.id);
    return;
  }

  if (player.reconnectTimer) clearTimeout(player.reconnectTimer);
  player.reconnectTimer = setTimeout(() => {
    if (rooms.get(code) === room && player.socketId === null) {
      removePlayer(io, room, player.id);
      console.log(`${player.name} timed out of room ${code}`);
    }
  }, RECONNECT_GRACE_MS);

  updateRoom(io, room);
  console.log(`${player.name} disconnected from ${code}; spot reserved`);
}
