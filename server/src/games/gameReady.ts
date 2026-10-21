import type { Server } from "socket.io";
import type { GameId, Room } from "../types";
import { updateRoom } from "../rooms/store";

// The shared ready gate belongs to the room, not an individual mini-game.
export const PLAYER_RANGES: Partial<Record<GameId, readonly [number, number]>> = {
  last_word: [3, 6], funny_answers: [3, 10],
};
export function inPlayerRange(room: Room): boolean {
  const range = room.selectedGame && PLAYER_RANGES[room.selectedGame];
  const count = room.selectedGame === "funny_answers" ? room.players.filter(p=>p.socketId !== null).length : room.players.length;
  return Boolean(range && count >= range[0] && count <= range[1]);
}
export function allConnectedReady(room: Room): boolean {
  const ready = room.gameReady ?? room.lastWordReady ?? {};
  return room.players.every(p => p.socketId === null || ready[p.id]);
}
export function resetReady(room: Room) { room.gameReady = {}; room.lastWordReady = {}; }
export function setGameReady(io: Server, room: Room, id: string, value: unknown): string | null {
  if(room.phase !== "instructions" || !room.selectedGame || !PLAYER_RANGES[room.selectedGame]) return "Not on a game Ready screen.";
  if(typeof value !== "boolean") return "Invalid Ready status.";
  (room.gameReady ??= {})[id] = value;
  if(room.selectedGame === "last_word") room.lastWordReady[id] = value;
  updateRoom(io, room);
  return null;
}
