import { randomBytes, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { EMPTY_ROOM_IDLE_MS } from "../config";
import { privateFunny, publicFunny, stopFunnyTimer } from "../games/funnyState";
import { onFunnyHostDisconnected, onFunnyRosterChange } from "../games/funnyEngine";
import { stopLastWord, syncPause } from "../games/lastWordEngine";
import type { CharacterId, Player, Room } from "../types";
import { generateFriendlyCode } from "./roomCodes";

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
  return generateFriendlyCode(new Set(rooms.keys()));
}

const characters: readonly CharacterId[] = ["scribble", "bolt", "odd-one", "stripe", "orbit", "blob"];
export function validateCharacter(value: unknown): CharacterId {
  return characters.includes(value as CharacterId) ? value as CharacterId : "scribble";
}

export function createPlayer(name: string, socket: Socket, character: CharacterId = "scribble"): Player {
  return {
    id: randomUUID(),
    name,
    character,
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
      character: player.character,
      isHost: index === 0,
      connected: player.socketId !== null,
    })),
    displayCount: room.displays.size,
    phase: room.phase,
    selectedGame: room.selectedGame,
    selectedRounds: room.selectedRounds,
    serverNow: Date.now(),
    funny: publicFunny(room),
    gameReady: room.gameReady ?? room.lastWordReady ?? {},
    lastWordReady: room.lastWordReady ?? {},
    lastWord: room.lastWord ? {
      participants: room.lastWord.participants.map(({id,name,character,hearts,points,placement})=>({id,name,character,hearts,points,placement})),
      order: room.lastWord.stage === "countdown" ? [] : room.lastWord.order,
      stage: room.lastWord.stage, stageStartedAt: room.lastWord.stageStartedAt, stageDeadline: room.lastWord.stageDeadline,
      turnDeadline: room.lastWord.turnDeadline, turnDurationMs: room.lastWord.turnDurationMs, turnNumber: room.lastWord.turnNumber,
      activePlayerId: room.lastWord.stage === "countdown" || room.lastWord.stage === "pop" ? null : room.lastWord.order[room.lastWord.turnIndex],
      pendingPlayerId: room.lastWord.pendingPlayerId, handoffFromPlayerId: room.lastWord.handoffFromPlayerId,
      prompt: room.lastWord.stage === "turn" ? room.lastWord.prompt : "",
      rule: room.lastWord.rule, levelName: room.lastWord.levelName, level: room.lastWord.level,
      impactPlayerId: room.lastWord.impactPlayerId, impact: room.lastWord.impact,
      awardIndex: room.lastWord.awardIndex, awards: room.lastWord.awards, winnerId: room.lastWord.winnerId,
      paused: room.lastWord.paused, pausedRemaining: room.lastWord.pausedRemaining,
    } : null,
    lastScoreboard: room.lastScoreboard,
  };
}

export function updateRoom(io: Server, room: Room) {
  io.to(room.code).emit("room_updated", publicRoom(room));
  for (const player of room.players) {
    if (player.socketId) {
      io.to(player.socketId).emit("funny_private_updated", privateFunny(room.funny, player.id));
    }
  }
}

/** Preserve unexpected disconnects briefly for reconnect; never retain an abandoned game for hours. */
export function refreshRoomIdleTimer(io: Server, room: Room) {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  room.idleTimer = undefined;
  if (room.players.some(player => player.socketId !== null)) return;
  room.idleTimer = setTimeout(() => {
    if (rooms.get(room.code) !== room || room.players.some(player => player.socketId !== null)) return;
    closeRoom(io, room);
    console.log(`Room ${room.code} closed after prolonged inactivity`);
  }, EMPTY_ROOM_IDLE_MS);
  room.idleTimer.unref?.();
}

function closeRoom(io: Server, room: Room) {
  if (room.idleTimer) clearTimeout(room.idleTimer);
  stopFunnyTimer(room.funny);
  stopLastWord(room);
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
}

/** If the host goes offline, promote a connected player so the game isn't stuck. */
export function promoteConnectedHost(room: Room) {
  if (room.players[0]?.socketId !== null) return;
  const index = room.players.findIndex(p => p.socketId !== null);
  if (index > 0) room.players.unshift(room.players.splice(index, 1)[0]);
}

export function removePlayer(io: Server, room: Room, playerId: string) {
  if (!room.players.some(entry => entry.id === playerId)) return;
  const hostIsLeaving = room.players[0]?.id === playerId;
  room.players = room.players.filter(entry => entry.id !== playerId);
  // The last-game scoreboard belongs to the CURRENT room roster. A player
  // who leaves or is kicked must not linger in the scores when the host picks
  // another game. Unexpected disconnects are handled separately and retain
  // their identities during the reconnect grace period.
  if (room.lastScoreboard) {
    room.lastScoreboard.scores = room.lastScoreboard.scores.filter(score => score.id !== playerId);
  }
  // A deliberate departure by the final online player ends the party immediately,
  // even when disconnected recovery identities remain in room.players.
  if (room.players.length === 0 || room.players.every(player => player.socketId === null)) {
    closeRoom(io, room);
    return;
  }
  if (hostIsLeaving) {
    onFunnyHostDisconnected(io, room);
    promoteConnectedHost(room);
  }
  onFunnyRosterChange(io, room);
  syncPause(io, room);
  refreshRoomIdleTimer(io, room);
  updateRoom(io, room);
}

// Intentional "Leave Room" removes a player. Unexpected disconnects retain
// the identity until a host kicks it, they leave, or the short reconnect window expires.
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

  const player = room.players.find(entry => entry.id === playerId);
  // A socket replaced by another tab must never sign its replacement out.
  if (!player || player.socketId !== socket.id) return;
  player.socketId = null;
  if (!grace) {
    removePlayer(io, room, player.id);
    return;
  }
  if (room.players[0]?.id === playerId) onFunnyHostDisconnected(io, room);
  promoteConnectedHost(room);
  onFunnyRosterChange(io, room);
  syncPause(io, room);
  refreshRoomIdleTimer(io, room);
  updateRoom(io, room);
  console.log(`${player.name} disconnected from ${code}; identity retained`);
}
