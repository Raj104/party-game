export type Player = {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};

export type GameId = "funny_answers" | "drawing_telephone";
export type GamePhase = "lobby" | "selection" | "instructions";

export type GameInfo = {
  id: GameId;
  title: string;
  emoji: string;
  description: string;
  instructions: string[];
};

export type Room = {
  code: string;
  players: Player[];
  displayCount: number;
  phase: GamePhase;
  selectedGame: GameId | null;
};

export type ActionResponse = { ok: true } | { ok: false; error: string };
export type RoomResponse =
  | { ok: true; room: Room }
  | { ok: false; error: string };
export type JoinResponse =
  | { ok: true; room: Room; token: string; playerId: string }
  | { ok: false; error: string };

export type SavedSession = { code: string; token: string; playerId: string };
