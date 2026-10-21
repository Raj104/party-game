import { randomInt } from 'node:crypto';
import type { Player } from '../types';
import {
  BOMB_RANGES_SECONDS, HANDOFF_PROTECTION_MS, PASS_EXTENSION_MS, TURN_MS,
  LastWordDictionary, difficultyFor, normalizeWord, matchesPrompt,
} from './lastWordRules';
import type { LastWordAward, LastWordParticipant, LastWordState } from './lastWordTypes';

export type Rng = (max: number) => number; // range 0..max-1
export const secureRandom: Rng = max => randomInt(max);

export function createLastWord(players: Player[], dictionary: LastWordDictionary, now: number,
  random: Rng = secureRandom): LastWordState {
  if (players.length < 3 || players.length > 6) throw new Error('Last Word needs 3–6 players.');
  const participants: LastWordParticipant[] = players.map(p => ({
    id: p.id, name: p.name, character: p.character, healthUnits: 6, points: 0, placement: null,
    stats: {
      validWords: 0, invalidWords: 0, manualPasses: 0, timeouts: 0, bombHits: 0,
      longestWord: null, longestWordMs: null, fastestWordMs: null,
      fastestWordLength: 0, holdMs: 0, survivalMs: null,
    },
  }));
  const game: LastWordState = {
    participants, stage: 'playing', startedAt: now,
    holderId: participants[random(participants.length)].id,
    prompt: '', difficulty: 1, usedWords: new Set(), turnId: 0,
    turnStartedAt: now, turnDeadline: null, bombDeadline: null,
    protectionUntil: null, holdStartedAt: null, pauseRemaining: null,
    winnerId: null, awards: [],
  };
  startCycle(game, dictionary, now, random);
  return game;
}

function living(game: LastWordState) { return game.participants.filter(p => p.healthUnits > 0); }
function holder(game: LastWordState) { return game.participants.find(p => p.id === game.holderId); }
function nextHolder(game: LastWordState, fromId: string): LastWordParticipant | undefined {
  const index = game.participants.findIndex(p => p.id === fromId);
  for (let step = 1; step < game.participants.length; step++) {
    const candidate = game.participants[(index + step) % game.participants.length];
    if (candidate.healthUnits > 0) return candidate;
  }
  return undefined;
}

function holdEnds(game: LastWordState, at: number) {
  const p = holder(game);
  if (p && game.holdStartedAt !== null) p.stats.holdMs += Math.max(0, at - game.holdStartedAt);
  game.holdStartedAt = null;
}

/** Each elimination, not each explosion, awards +1 to every remaining survivor. */
function applyDamage(game: LastWordState, p: LastWordParticipant, halfHearts: number, now: number) {
  p.healthUnits = Math.max(0, p.healthUnits - halfHearts);
  if (p.healthUnits > 0) return;
  p.placement = living(game).length + 1;
  p.stats.survivalMs = Math.max(0, now - game.startedAt);
  game.usedWords.clear();
  for (const survivor of living(game)) survivor.points += 1;
}

function selectPrompt(game: LastWordState, dict: LastWordDictionary, random: Rng) {
  let prompt = dict.select(game.difficulty, game.usedWords, random);
  if (!prompt) {
    // No usable answers anywhere at this difficulty: refresh the current pool.
    game.usedWords.clear();
    prompt = dict.select(game.difficulty, game.usedWords, random);
  }
  if (!prompt) throw new Error('Last Word dictionary has no usable prompts for this difficulty.');
  game.prompt = prompt;
}

function beginTurn(game: LastWordState, dict: LastWordDictionary, at: number, random: Rng) {
  game.difficulty = difficultyFor(game.participants.length, living(game).length);
  selectPrompt(game, dict, random);
  game.turnId++;
  game.turnStartedAt = at;
  game.turnDeadline = at + TURN_MS;
  game.protectionUntil = at + HANDOFF_PROTECTION_MS;
  game.holdStartedAt = at;
}

function startCycle(game: LastWordState, dict: LastWordDictionary, at: number, random: Rng) {
  const [min, max] = BOMB_RANGES_SECONDS[living(game).length] ?? [12, 20];
  game.bombDeadline = at + (min + random(max - min + 1)) * 1000;
  beginTurn(game, dict, at, random);
}

function rankAwards(game: LastWordState): LastWordAward[] {
  const betterPlacement = (a: LastWordParticipant, b: LastWordParticipant) =>
    (a.placement ?? Infinity) - (b.placement ?? Infinity);
  const awards: LastWordAward[] = [];
  const candidates: { id: LastWordAward['id']; eligible: (p: LastWordParticipant) => boolean;
    compare: (a: LastWordParticipant, b: LastWordParticipant) => number }[] = [
    { id: 'longest_word', eligible: p => Boolean(p.stats.longestWord), compare: (a, b) =>
      (b.stats.longestWord?.length ?? 0) - (a.stats.longestWord?.length ?? 0) ||
      (a.stats.longestWordMs ?? Infinity) - (b.stats.longestWordMs ?? Infinity) },
    { id: 'fastest_word', eligible: p => p.stats.fastestWordMs !== null, compare: (a, b) =>
      (a.stats.fastestWordMs ?? Infinity) - (b.stats.fastestWordMs ?? Infinity) ||
      b.stats.fastestWordLength - a.stats.fastestWordLength },
    { id: 'most_valid_passes', eligible: p => p.stats.validWords > 0, compare: (a, b) =>
      b.stats.validWords - a.stats.validWords ||
      (a.stats.manualPasses + a.stats.timeouts) - (b.stats.manualPasses + b.stats.timeouts) },
    { id: 'most_holding_time', eligible: p => p.stats.holdMs > 0, compare: (a, b) =>
      b.stats.holdMs - a.stats.holdMs || a.stats.bombHits - b.stats.bombHits },
  ];
  for (const award of candidates) {
    const sorted = game.participants.filter(award.eligible).sort((a, b) =>
      award.compare(a, b) || betterPlacement(a, b) ||
      game.participants.indexOf(a) - game.participants.indexOf(b));
    if (sorted.length) {
      sorted[0].points += 1;
      awards.push({ id: award.id, playerId: sorted[0].id, points: 1 });
    }
  }
  return awards;
}

function checkVictory(game: LastWordState, at: number): boolean {
  const remaining = living(game);
  if (remaining.length > 1) return false;
  game.stage = 'finished';
  game.winnerId = remaining[0]?.id ?? null;
  if (remaining[0]) {
    remaining[0].placement = 1;
    remaining[0].stats.survivalMs = Math.max(0, at - game.startedAt);
  }
  game.holderId = null;
  game.turnDeadline = null;
  game.bombDeadline = null;
  game.protectionUntil = null;
  game.awards = rankAwards(game);
  return true;
}

function pass(game: LastWordState, dict: LastWordDictionary, at: number, random: Rng, extension: boolean) {
  const outgoing = game.holderId!;
  const following = nextHolder(game, outgoing);
  if (!following) return;
  game.holderId = following.id;
  if (extension) game.bombDeadline = (game.bombDeadline ?? at) + PASS_EXTENSION_MS;
  beginTurn(game, dict, at, random);
}

function resolveTimeout(game: LastWordState, dict: LastWordDictionary, at: number, random: Rng) {
  const p = holder(game)!;
  holdEnds(game, at);
  p.stats.timeouts++;
  applyDamage(game, p, 1, at);
  if (!checkVictory(game, at)) pass(game, dict, at, random, true);
}

function resolveExplosion(game: LastWordState, dict: LastWordDictionary, at: number, random: Rng) {
  const p = holder(game)!;
  holdEnds(game, at);
  p.stats.bombHits++;
  applyDamage(game, p, 2, at);
  if (checkVictory(game, at)) return;
  const following = nextHolder(game, p.id);
  if (!following) return;
  game.holderId = following.id;
  // The +3s extension is never applied to a new explosion cycle.
  startCycle(game, dict, at, random);
}

/** Earliest server event; ties resolve as explosion before turn timeout. */
export function nextLastWordEventAt(game: LastWordState): number | null {
  if (game.stage !== 'playing') return null;
  const explosion = Math.max(game.bombDeadline ?? Infinity, game.protectionUntil ?? -Infinity);
  return Math.min(explosion, game.turnDeadline ?? Infinity);
}

export function advanceLastWord(game: LastWordState, dict: LastWordDictionary, now: number, random: Rng = secureRandom): boolean {
  let changed = false;
  // A stalled event loop may owe multiple timeouts. Resolve in deadline order.
  for (let count = 0; count < 1000 && game.stage === 'playing'; count++) {
    const eventTime = nextLastWordEventAt(game);
    if (eventTime === null || eventTime > now) break;
    changed = true;
    const explosionAt = Math.max(game.bombDeadline ?? Infinity, game.protectionUntil ?? -Infinity);
    if (explosionAt <= (game.turnDeadline ?? Infinity)) resolveExplosion(game, dict, eventTime, random);
    else resolveTimeout(game, dict, eventTime, random);
  }
  return changed;
}

export function submitLastWord(game: LastWordState, dict: LastWordDictionary, playerId: string,
  turnId: unknown, raw: unknown, now: number, random: Rng = secureRandom): string | null {
  advanceLastWord(game, dict, now, random);
  if (game.stage !== 'playing') return 'The match is not active.';
  if (game.holderId !== playerId || game.turnId !== turnId) return 'This is not your current turn.';
  const p = holder(game)!;
  const word = normalizeWord(raw);
  let error: string | null = null;
  if (!word) error = 'Enter an English word of at least 4 letters (letters only).';
  else if (!dict.has(word)) error = 'Not in the approved dictionary.';
  else if (!matchesPrompt(word, game.prompt, game.difficulty)) error = "Doesn't match the letters.";
  else if (game.usedWords.has(word)) error = 'Already used in this word pool.';
  if (error) {
    p.stats.invalidWords++;
    return error;
  }
  const duration = Math.max(0, now - game.turnStartedAt);
  p.stats.validWords++;
  if (p.stats.longestWord === null || word!.length > p.stats.longestWord.length ||
    (word!.length === p.stats.longestWord.length && duration < (p.stats.longestWordMs ?? Infinity))) {
    p.stats.longestWord = word;
    p.stats.longestWordMs = duration;
  }
  if (p.stats.fastestWordMs === null || duration < p.stats.fastestWordMs ||
    (duration === p.stats.fastestWordMs && word!.length > p.stats.fastestWordLength)) {
    p.stats.fastestWordMs = duration;
    p.stats.fastestWordLength = word!.length;
  }
  game.usedWords.add(word!);
  holdEnds(game, now);
  pass(game, dict, now, random, true);
  return null;
}

export function skipLastWord(game: LastWordState, dict: LastWordDictionary, playerId: string,
  turnId: unknown, now: number, random: Rng = secureRandom): string | null {
  advanceLastWord(game, dict, now, random);
  if (game.stage !== 'playing') return 'The match is not active.';
  if (game.holderId !== playerId || game.turnId !== turnId) return 'This is not your current turn.';
  const p = holder(game)!;
  holdEnds(game, now);
  p.stats.manualPasses++;
  applyDamage(game, p, 1, now);
  if (!checkVictory(game, now)) pass(game, dict, now, random, true);
  return null;
}

export function setLastWordConnectivity(game: LastWordState, connectedIds: ReadonlySet<string>, now: number,
  dict: LastWordDictionary, random: Rng = secureRandom) {
  if (game.stage === 'playing') {
    // Resolve already-due actions before the room becomes fully offline.
    advanceLastWord(game, dict, now, random);
    if (game.stage !== 'playing' || living(game).some(p => connectedIds.has(p.id))) return;
    holdEnds(game, now);
    game.pauseRemaining = {
      bomb: Math.max(0, (game.bombDeadline ?? now) - now),
      turn: Math.max(0, (game.turnDeadline ?? now) - now),
      protection: Math.max(0, (game.protectionUntil ?? now) - now),
    };
    game.stage = 'paused';
    game.bombDeadline = game.turnDeadline = game.protectionUntil = null;
  } else if (game.stage === 'paused' && living(game).some(p => connectedIds.has(p.id))) {
    const remaining = game.pauseRemaining!;
    game.bombDeadline = now + remaining.bomb;
    game.turnDeadline = now + remaining.turn;
    game.protectionUntil = now + remaining.protection;
    game.turnStartedAt = now - (TURN_MS - remaining.turn);
    game.holdStartedAt = now;
    game.pauseRemaining = null;
    game.stage = 'playing';
  }
}

/** Explicit departures count as elimination; connection loss alone does not. */
export function removeLastWordParticipant(game: LastWordState, dict: LastWordDictionary,
  playerId: string, now: number, random: Rng = secureRandom) {
  advanceLastWord(game, dict, now, random);
  if (game.stage === 'finished') return;
  const p = game.participants.find(p => p.id === playerId);
  if (!p || p.healthUnits === 0) return;
  const wasHolder = game.holderId === playerId;
  if (wasHolder && game.stage === 'playing') holdEnds(game, now);
  applyDamage(game, p, p.healthUnits, now);
  if (checkVictory(game, now)) return;
  if (wasHolder) {
    const following = nextHolder(game, p.id)!;
    game.holderId = following.id;
    // An explicit leave transfers ownership but does not increase bomb lifetime.
    if (game.stage === 'paused') {
      game.turnId++;
      game.turnDeadline = null;
      game.pauseRemaining!.turn = TURN_MS;
      game.pauseRemaining!.protection = HANDOFF_PROTECTION_MS;
      game.turnStartedAt = now;
      game.difficulty = difficultyFor(game.participants.length, living(game).length);
      selectPrompt(game, dict, random);
    } else beginTurn(game, dict, now, random);
  }
}

/** Public payload deliberately excludes bombDeadline and protectionUntil. */
export function publicLastWord(game: LastWordState | null) {
  if (!game) return null;
  return {
    stage: game.stage, startedAt: game.startedAt, holderId: game.holderId,
    prompt: game.prompt.toUpperCase(), difficulty: game.difficulty,
    turnId: game.turnId,
    turnDeadline: game.turnDeadline, // only the 10-second turn countdown is visible
    turnRemainingMs: game.stage === 'paused' ? game.pauseRemaining?.turn ?? 0 : null,
    turnDurationMs: TURN_MS,
    participants: game.participants.map(p => ({
      id: p.id, name: p.name, character: p.character,
      healthUnits: p.healthUnits, placement: p.placement, points: p.points,
    })),
    winnerId: game.winnerId,
    awards: game.stage === 'finished' ? game.awards : [],
    results: game.stage === 'finished' ? game.participants.map(p => ({
      id: p.id, placement: p.placement, points: p.points, ...p.stats,
    })) : null,
  };
}
