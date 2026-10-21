import type { Server, Socket } from "socket.io";
import { MAX_PLAYERS } from "../config";
import { allowNewRoom, fixedWindowLimiter, MAX_ACTIVE_ROOMS } from "../security";
import {
  createPlayer, generateRoomCode, leaveRoom, nameTaken, publicRoom,
  rooms, updateRoom, refreshRoomIdleTimer, removePlayer, promoteConnectedHost, validateCharacter, validateName,
} from "../rooms/store";
import { syncPause } from "../games/lastWordEngine";
import type { Room } from "../types";
import { normalizeRoomCode } from "../rooms/roomCodes";
import { registerGameEvents } from "./registerGameEvents";

export function registerRoomEvents(io: Server, socket: Socket) {
  console.log("Connected:", socket.id);
  const allowRoomAction = fixedWindowLimiter(30, 60_000);
  const allowCreation = fixedWindowLimiter(4, 60_000);

  socket.on("create_room", (rawName, rawCharacterOrCallback, maybeCallback) => {
    const callback = typeof rawCharacterOrCallback === "function" ? rawCharacterOrCallback : maybeCallback;
    if (typeof callback !== "function") return;
    if (!allowRoomAction() || !allowCreation() || !allowNewRoom()) {
      callback({ ok: false, error: "Too many room requests. Please wait a minute." });
      return;
    }
    if (rooms.size >= MAX_ACTIVE_ROOMS) {
      callback({ ok: false, error: "The server is busy. Please try later." });
      return;
    }
    const character = validateCharacter(typeof rawCharacterOrCallback === "function" ? undefined : rawCharacterOrCallback);
    const name = validateName(rawName);
    if (!name) {
      callback({ ok: false, error: "Enter a nickname (1-20 characters)." });
      return;
    }

    leaveRoom(io, socket);
    const code = generateRoomCode();
    const player = createPlayer(name, socket, character);
    const room: Room = {
      code,
      players: [player],
      displays: new Set(),
      phase: "selection",
      selectedGame: null,
      selectedRounds: 3,
      funny: null,
      lastWord: null,
      gameReady: {},
      lastWordReady: {},
      lastScoreboard: null,
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

  socket.on("join_room", (rawCode, rawName, rawCharacterOrCallback, maybeCallback) => {
    const callback = typeof rawCharacterOrCallback === "function" ? rawCharacterOrCallback : maybeCallback;
    if (typeof callback !== "function") return;
    if (!allowRoomAction()) {
      callback({ ok: false, error: "Too many room requests. Please wait a minute." });
      return;
    }
    const character = validateCharacter(typeof rawCharacterOrCallback === "function" ? undefined : rawCharacterOrCallback);
    const name = validateName(rawName);
    const code = normalizeRoomCode(rawCode) ?? "";
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
    const player = createPlayer(name, socket, character);
    room.players.push(player);
    room.lastWordReady[player.id] = false;
    (room.gameReady ??= {})[player.id] = false;
    promoteConnectedHost(room);
    refreshRoomIdleTimer(io, room);
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
    if (!allowRoomAction()) {
      callback({ ok: false, error: "Too many room requests. Please wait a minute." });
      return;
    }
    const code = normalizeRoomCode(rawCode) ?? "";
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
    player.socketId = socket.id;
    syncPause(io, room);
    promoteConnectedHost(room);
    refreshRoomIdleTimer(io, room);
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
    if (!allowRoomAction()) {
      callback({ ok: false, error: "Too many room requests. Please wait a minute." });
      return;
    }
    const code = normalizeRoomCode(rawCode) ?? "";
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

  socket.on("kick_player", (rawId: unknown, callback: unknown) => {
    if (typeof callback !== "function") return;
    const code = socket.data.roomCode as string | undefined;
    const room = code ? rooms.get(code) : undefined;
    if (!room || socket.data.role !== "player" || room.players[0]?.id !== socket.data.playerId || room.players[0]?.socketId !== socket.id) {
      callback({ ok: false, error: "Only the host can remove players." });
      return;
    }
    if (typeof rawId !== "string" || rawId === socket.data.playerId) {
      callback({ ok: false, error: "Select another player to remove." });
      return;
    }
    const player = room.players.find(entry => entry.id === rawId);
    if (!player) {
      callback({ ok: false, error: "Player not found." });
      return;
    }
    // Invalidate recovery before disconnecting their socket.
    const kickedSocket = player.socketId ? io.sockets.sockets.get(player.socketId) : undefined;
    if (kickedSocket) {
      kickedSocket.emit("room_kicked");
      kickedSocket.leave(room.code);
      delete kickedSocket.data.roomCode;
      delete kickedSocket.data.role;
      delete kickedSocket.data.playerId;
    }
    removePlayer(io, room, player.id);
    // Keep the transport connected so the removed player can join a new room immediately.
    callback({ ok: true });
  });

  // All game actions remain server-authorized host operations.
  registerGameEvents(io, socket);

  socket.on("leave_room", () => leaveRoom(io, socket, false));
  socket.on("disconnect", () => {
    leaveRoom(io, socket, true);
    console.log("Disconnected:", socket.id);
  });
}
