import type { Server, Socket } from "socket.io";
import { rooms } from "../rooms/store";
import type { Room } from "../types";
import {
  closeFunnyGame, controlFunnyReveal, controlFunnyTimer, nextFunnyRound, skipFunnyPhase, startFunny,
  submitFunnyAnswer, submitFunnyVote,
} from "../games/funnyEngine";

type Callback = (result: { ok: boolean; error?: string }) => void;

function playerRoom(socket: Socket): { room: Room; playerId: string } | null {
  const room = rooms.get(socket.data.roomCode as string);
  const playerId = socket.data.playerId as string | undefined;
  if (!room || socket.data.role !== "player" || !playerId) return null;
  const player = room.players.find((entry) => entry.id === playerId);
  if (!player || player.socketId !== socket.id) return null;
  return { room, playerId };
}

function act(socket: Socket, callback: unknown, hostOnly: boolean, fn: (room: Room, id: string) => string | null) {
  if (typeof callback !== "function") return;
  const member = playerRoom(socket);
  if (!member) return (callback as Callback)({ ok: false, error: "Join the room to play." });
  if (hostOnly && member.room.players[0]?.id !== member.playerId) {
    return (callback as Callback)({ ok: false, error: "Only the host can do that." });
  }
  const error = fn(member.room, member.playerId);
  (callback as Callback)(error ? { ok: false, error } : { ok: true });
}

export function registerFunnyEvents(io: Server, socket: Socket) {
  socket.on("funny_start", (rounds: unknown, callback: unknown) => {
    act(socket, callback, true, (room) => startFunny(io, room, rounds === room.selectedRounds ? rounds as number : -1));
  });
  socket.on("funny_submit_answer", (answer: unknown, callback: unknown) => {
    act(socket, callback, false, (room, id) => submitFunnyAnswer(io, room, id, answer));
  });
  socket.on("funny_reveal_control", (command: unknown, callback: unknown) => {
    act(socket, callback, true, (room) => controlFunnyReveal(io, room, command));
  });
  socket.on("funny_submit_vote", (answerId: unknown, callback: unknown) => {
    act(socket, callback, false, (room, id) => submitFunnyVote(io, room, id, answerId));
  });
  socket.on("funny_timer_control", (command: unknown, callback: unknown) => {
    act(socket, callback, true, (room) => controlFunnyTimer(io, room, command));
  });
  socket.on("funny_skip_phase", (callback: unknown) => {
    act(socket, callback, true, room => skipFunnyPhase(io, room));
  });
  socket.on("funny_next_round", (callback: unknown) => {
    act(socket, callback, true, (room) => nextFunnyRound(io, room));
  });
  socket.on("funny_finish", (callback: unknown) => {
    act(socket, callback, true, (room) => closeFunnyGame(io, room));
  });
}
