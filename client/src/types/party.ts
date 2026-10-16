import type { CharacterId } from "../lib/preferences";

export type Player = {
  character: CharacterId;
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
};

export type GameId =
  | "funny_answers"
  | "drawing_telephone"
  | "meme_battle"
  | "mafia"
  | "codenames"
  | "dumb_charades";
export type GamePhase = "lobby" | "selection" | "instructions" | "playing";
export type FunnyStage = "submission" | "reveal" | "review" | "voting" | "results" | "finished";

export type GameInfo = {
  id: GameId;
  title: string;
  emoji: string;
  glyph: string;
  available: boolean;
  playerRange: string;
  description: string;
  instructions: string[];
};

export type FunnyAnswerPublic = {
  id: string;
  text: string;
  author?: string;
  authorId?: string;
  votes?: number;
  voters?: string[];
  voterIds?: string[];
};
export type FunnyPublic = {
  stage: FunnyStage;
  round: number;
  totalRounds: number;
  prompt: string;
  promptCategory: "solo" | "duo" | "group";
  deadline: number | null;
  paused: boolean;
  pausedRemainingMs: number | null;
  revealCount: number;
  participantIds: string[];
  participants: { id: string; name: string; character: CharacterId }[];
  participantCount: number;
  submittedCount: number;
  eligibleCount: number;
  votedCount: number;
  answers: FunnyAnswerPublic[];
  scores: { id: string; name: string; character: CharacterId; points: number }[];
};
export type FunnyPrivate = {
  round: number;
  answer: string;
  ownAnswerId: string | null;
  votedAnswerId: string | null;
} | null;

export type Room = {
  code: string;
  players: Player[];
  displayCount: number;
  phase: GamePhase;
  selectedGame: GameId | null;
  selectedRounds: 3 | 5;
  serverNow: number;
  funny: FunnyPublic | null;
  lastScoreboard: {
    gameId: GameId;
    scores: { id: string; name: string; character: CharacterId; points: number }[];
  } | null;
};

export type ActionResponse = { ok: true } | { ok: false; error: string };
export type RoomResponse =
  | { ok: true; room: Room }
  | { ok: false; error: string };
export type JoinResponse =
  | { ok: true; room: Room; token: string; playerId: string }
  | { ok: false; error: string };

export type SavedSession = { code: string; token: string; playerId: string };
