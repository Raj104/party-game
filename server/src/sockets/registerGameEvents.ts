import type { Server, Socket } from "socket.io";
import { rooms, updateRoom } from "../rooms/store";
import type { GameId, Room } from "../types";
import { registerFunnyEvents } from "./registerFunnyEvents";

// Preview-only games are valid room selections, but cannot be started until their
// own server engine is implemented. Funny Answers is the only playable one.
const GAME_IDS: readonly GameId[] = [
  "funny_answers", "drawing_telephone", "meme_battle", "mafia", "codenames", "dumb_charades",
];
type ActionCallback = (result: { ok: boolean; error?: string }) => void;

// A host is always validated from server-side room membership, not a client flag.
function hostRoom(socket: Socket, callback: ActionCallback): Room | null {
  const code = socket.data.roomCode as string | undefined;
  const playerId = socket.data.playerId as string | undefined;
  const room = code ? rooms.get(code) : undefined;
  const host = room?.players[0];

  if (
    socket.data.role !== "player" || !room || !playerId ||
    !host || host.id !== playerId || host.socketId !== socket.id
  ) {
    callback({ ok: false, error: "Only the host can do that." });
    return null;
  }
  return room;
}

export function registerGameEvents(io: Server, socket: Socket) {
  registerFunnyEvents(io, socket);
  socket.on("open_game_selection", (callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase !== "lobby") {
      callback({ ok: false, error: "Return to the lobby first." });
      return;
    }
    room.phase = "selection";
    room.selectedGame = null;
    room.selectedRounds = 3;
    updateRoom(io, room);
    callback({ ok: true });
  });

  socket.on("select_game", (rawGameId, callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase !== "selection" && room.phase !== "lobby") {
      callback({ ok: false, error: "Games can only be selected before play begins." });
      return;
    }
    if (typeof rawGameId !== "string" || !GAME_IDS.includes(rawGameId as GameId)) {
      callback({ ok: false, error: "Unknown game." });
      return;
    }
    if (room.selectedGame !== rawGameId) room.selectedRounds = 3;
    // Older rooms can enter the browser without the retired lobby step.
    room.phase = "selection";
    room.selectedGame = rawGameId as GameId;
    updateRoom(io, room);
    callback({ ok: true });
  });

  socket.on("set_game_rounds", (rounds: unknown, callback: unknown) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback as ActionCallback);
    if (!room) return;
    if (room.phase !== "selection" || room.selectedGame !== "funny_answers") {
      callback({ ok: false, error: "Choose Funny Answers first." });
      return;
    }
    if (rounds !== 3 && rounds !== 5) {
      callback({ ok: false, error: "Choose 3 or 5 rounds." });
      return;
    }
    room.selectedRounds = rounds;
    updateRoom(io, room);
    callback({ ok: true });
  });

  // Leaving the setup dialog should also remove the TV preview.
  socket.on("clear_game_selection", (callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase !== "selection") {
      callback({ ok: false, error: "Games can only be cleared on the selection screen." });
      return;
    }
    room.selectedGame = null;
    room.selectedRounds = 3;
    updateRoom(io, room);
    callback({ ok: true });
  });

  socket.on("show_game_instructions", (callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase !== "selection" || !room.selectedGame) {
      callback({ ok: false, error: "Select a game first." });
      return;
    }
    room.phase = "instructions";
    updateRoom(io, room);
    callback({ ok: true });
  });

  socket.on("back_to_game_selection", (callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase !== "instructions") {
      callback({ ok: false, error: "Not on the instructions screen." });
      return;
    }
    room.phase = "selection";
    updateRoom(io, room);
    callback({ ok: true });
  });

  socket.on("return_to_lobby", (callback) => {
    if (typeof callback !== "function") return;
    const room = hostRoom(socket, callback);
    if (!room) return;
    if (room.phase === "playing") {
      callback({ ok: false, error: "Finish the current game first." });
      return;
    }
    room.phase = "lobby";
    room.selectedGame = null;
    room.selectedRounds = 3;
    updateRoom(io, room);
    callback({ ok: true });
  });
}
