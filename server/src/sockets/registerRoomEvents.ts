import type { Server, Socket } from "socket.io";
import { MAX_PLAYERS } from "../config";
import {
  createPlayer, generateRoomCode, leaveRoom, nameTaken, publicRoom,
  rooms, updateRoom, validateName,
} from "../rooms/store";
import type { Room } from "../types";
import { registerGameEvents } from "./registerGameEvents";

export function registerRoomEvents(io: Server, socket: Socket) {
  console.log("Connected:", socket.id);

  socket.on("create_room", (rawName, callback) => {
    if (typeof callback !== "function") return;
    const name = validateName(rawName);
    if (!name) {
      callback({ ok: false, error: "Enter a nickname (1-20 characters)." });
      return;
    }

    leaveRoom(io, socket);
    const code = generateRoomCode();
    const player = createPlayer(name, socket);
    const room: Room = {
      code,
      players: [player],
      displays: new Set(),
      phase: "lobby",
      selectedGame: null,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "player";
    socket.data.playerId = player.id;
    callback({ ok: true, room: publicRoom(room), token: player.token, playerId: player.id });
    updateRoom(io, room);
    console.log(`${name} created ${code}`);
  });

  socket.on("join_room", (rawCode, rawName, callback) => {
    if (typeof callback !== "function") return;
    const name = validateName(rawName);
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    if (!name) {
      callback({ ok: false, error: "Enter a nickname (1-20 characters)." });
      return;
    }
    const room = rooms.get(code);
    if (!room) {
      callback({ ok: false, error: "Room not found." });
      return;
    }
    if (nameTaken(room, name)) {
      callback({ ok: false, error: "That nickname is already taken in this room." });
      return;
    }
    if (room.players.length >= MAX_PLAYERS) {
      callback({ ok: false, error: "This room is full." });
      return;
    }
    leaveRoom(io, socket);
    const player = createPlayer(name, socket);
    room.players.push(player);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "player";
    socket.data.playerId = player.id;
    callback({ ok: true, room: publicRoom(room), token: player.token, playerId: player.id });
    updateRoom(io, room);
    console.log(`${name} joined ${code}`);
  });

  socket.on("resume_room", (rawCode, rawToken, callback) => {
    if (typeof callback !== "function") return;
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    const token = typeof rawToken === "string" ? rawToken : "";
    const room = rooms.get(code);
    const player = room?.players.find((entry) => entry.token === token);
    if (!room || !player || !token) {
      callback({ ok: false, error: "Your previous session has expired." });
      return;
    }
    if (player.socketId === socket.id) {
      callback({ ok: true, room: publicRoom(room) });
      return;
    }
    leaveRoom(io, socket);
    if (player.socketId) {
      const oldSocket = io.sockets.sockets.get(player.socketId);
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
    callback({ ok: true, room: publicRoom(room) });
    updateRoom(io, room);
    console.log(`${player.name} reconnected to ${code}`);
  });

  socket.on("watch_room", (rawCode, callback) => {
    if (typeof callback !== "function") return;
    const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
    const room = rooms.get(code);
    if (!room) {
      callback({ ok: false, error: "Room not found." });
      return;
    }
    if (socket.data.roomCode === code && socket.data.role === "player") {
      callback({ ok: false, error: "Open the TV in a separate tab." });
      return;
    }
    leaveRoom(io, socket);
    room.displays.add(socket.id);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.role = "display";
    callback({ ok: true, room: publicRoom(room) });
    updateRoom(io, room);
  });

  // All game actions remain server-authorized host operations.
  registerGameEvents(io, socket);

  socket.on("leave_room", () => leaveRoom(io, socket, false));
  socket.on("disconnect", () => {
    leaveRoom(io, socket, true);
    console.log("Disconnected:", socket.id);
  });
}
