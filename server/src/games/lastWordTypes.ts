import type { CharacterId } from '../types';
import type { LastWordDifficulty } from './lastWordRules';

export type LastWordStats = {
  validWords: number;
  invalidWords: number;
  manualPasses: number;
  timeouts: number;
  bombHits: number;
  longestWord: string | null;
  longestWordMs: number | null;
  fastestWordMs: number | null;
  fastestWordLength: number;
  holdMs: number;
  survivalMs: number | null;
};
export type LastWordParticipant = {
  id: string;
  name: string;
  character: CharacterId;
  healthUnits: number;
  points: number;
  placement: number | null;
  stats: LastWordStats;
};
export type LastWordAward = {
  id: 'longest_word' | 'fastest_word' | 'most_valid_passes' | 'most_holding_time';
  playerId: string;
  points: 1;
};
export type LastWordState = {
  participants: LastWordParticipant[];
  stage: 'playing' | 'paused' | 'finished';
  startedAt: number;
  holderId: string | null;
  prompt: string;
  difficulty: LastWordDifficulty;
  usedWords: Set<string>;
  turnId: number;
  turnStartedAt: number;
  turnDeadline: number | null;
  /** Server-only: never include these deadlines in room broadcasts. */
  bombDeadline: number | null;
  protectionUntil: number | null;
  holdStartedAt: number | null;
  pauseRemaining: { bomb: number; turn: number; protection: number } | null;
  winnerId: string | null;
  awards: LastWordAward[];
  timer?: ReturnType<typeof setTimeout>;
};
