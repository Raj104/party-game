export type CharacterId = "scribble" | "bolt" | "odd-one" | "stripe" | "orbit" | "blob";

export type Player = {
  id: string;
  name: string;
  character: CharacterId;
  token: string;
  socketId: string | null;
};

export type GameId =
  | "last_word"
  | "funny_answers"
  | "drawing_telephone"
  | "meme_battle"
  | "mafia"
  | "codenames"
  | "dumb_charades";
export type GamePhase = "lobby" | "selection" | "instructions" | "playing";
export type FunnyStage = "submission" | "reveal" | "review" | "voting" | "results" | "finished";

export type FunnyAnswer = { id: string; playerId: string; text: string };
export type FunnyParticipant = { id: string; name: string; character: CharacterId };
export type FunnyPromptCategory = "solo" | "duo" | "group";
export type FunnyPrompt = { category: FunnyPromptCategory; text: string; featuredPlayerIds: string[] };

export type FunnyState = {
  participants: FunnyParticipant[];
  prompts: FunnyPrompt[];
  totalRounds: number;
  round: number;
  stage: FunnyStage;
  prompt: string;
  promptCategory: FunnyPromptCategory;
  deadline: number | null;
  paused: boolean;
  /** Milliseconds left when the host pauses the current phase. */
  pausedRemainingMs: number | null;
  revealCount: number;
  submissions: Record<string, string>;
  entries: FunnyAnswer[];
  votes: Record<string, string>; // voter player ID -> answer ID
  scores: Record<string, number>;
  timer?: ReturnType<typeof setTimeout>;
};

export type LastWordParticipant = {
  id: string; name: string; character: CharacterId; hearts: number; points: number;
  placement: number | null; validPasses: number; timeouts: number;
  explosions: number; holdMs: number; longestWord: string; longestWordMs: number;
  fastestWord: string; fastestWordMs: number; closestCallWord: string; closestCallRemainingMs: number;
};
export type LastWordAward = { key: string; playerId: string; stat: string };
export type LastWordStage = "countdown" | "pop" | "handoff" | "turn" | "impact" | "rearrange" | "respawn" | "finalPoint" | "level" | "champion" | "awards" | "results";
export type LastWordState = {
  participants: LastWordParticipant[]; order: string[]; turnIndex: number; turnNumber: number;
  stage: LastWordStage; stageStartedAt: number; stageDeadline: number | null;
  turnDeadline: number | null; turnDurationMs: number;
  prompt: string; rule: string; levelName: string; level: number; usedWords: string[]; promptHistory: string[]; validStreak: number;
  pendingPlayerId: string | null; handoffFromPlayerId: string | null; impactPlayerId: string | null;
  impact: "eliminated" | "explosion" | null;
  awardIndex: number; awards: LastWordAward[]; winnerId: string | null;
  paused: boolean; pausedRemaining: number;
  timer?: ReturnType<typeof setTimeout>;
};

export type Room = {
  code: string;
  players: Player[];
  displays: Set<string>;
  /** Cleans up a room if every player remains offline for hours. */
  idleTimer?: ReturnType<typeof setTimeout>;
  phase: GamePhase;
  selectedGame: GameId | null;
  selectedRounds: 3 | 5;
  funny: FunnyState | null;
  lastWord: LastWordState | null;
  gameReady: Record<string, boolean>;
  lastWordReady: Record<string, boolean>;
  /** Snapshot of the last completed game, retained until the next game starts. */
  lastScoreboard: {
    gameId: GameId;
    scores: { id: string; name: string; character: CharacterId; points: number }[];
  } | null;
};
