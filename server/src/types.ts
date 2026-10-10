export type Player = {
  id: string;
  name: string;
  token: string;
  socketId: string | null;
  reconnectTimer?: ReturnType<typeof setTimeout>;
};

export type GameId = "funny_answers" | "drawing_telephone";
export type GamePhase = "lobby" | "selection" | "instructions";

export type Room = {
  code: string;
  players: Player[];
  displays: Set<string>;
  phase: GamePhase;
  selectedGame: GameId | null;
};
