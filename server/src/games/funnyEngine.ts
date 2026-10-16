import { randomInt, randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { updateRoom } from "../rooms/store";
import type { FunnyAnswer, FunnyState, Room } from "../types";
import { eligibleParticipants, stopFunnyTimer } from "./funnyState";
import { createFunnyPrompts } from "./funnyPrompts";

const SUBMISSION_MS = 45_000;
const REVEAL_MS = 3_000;
const READING_MS = 5_000;
const VOTING_MS = 20_000;
const RESULTS_MS = 20_000; // Time to read results before the next round begins.
const MAX_ANSWER_LENGTH = 80;

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function schedule(game: FunnyState, ms: number, next: () => void) {
  stopFunnyTimer(game);
  game.deadline = Date.now() + ms;
  game.timer = setTimeout(() => {
    game.timer = undefined;
    game.deadline = null;
    next();
  }, ms);
}

/** Preserve the host's paused/running preference across phase boundaries. */
function startPhaseTimer(game: FunnyState, ms: number, next: () => void) {
  if (game.paused) {
    stopFunnyTimer(game);
    game.pausedRemainingMs = ms;
  } else {
    schedule(game, ms, next);
  }
}

export function startFunny(io: Server, room: Room, totalRounds: number): string | null {
  if ((room.phase !== "instructions" && room.phase !== "selection") || room.selectedGame !== "funny_answers") return "Select Funny Answers first.";
  if (totalRounds !== 3 && totalRounds !== 5) return "Choose 3 or 5 rounds.";
  const players = room.players.filter((player) => player.socketId !== null);
  if (players.length < 3 || players.length > 10) return "Funny Answers needs 3–10 connected players.";
  if (room.funny) stopFunnyTimer(room.funny);
  const game: FunnyState = {
    participants: players.map((p) => ({ id: p.id, name: p.name, character: p.character })),
    prompts: createFunnyPrompts(players.map((p) => ({ id: p.id, name: p.name, character: p.character })), totalRounds as 3 | 5),
    totalRounds, round: 0, stage: "submission", prompt: "", promptCategory: "solo", deadline: null,
    paused: false, pausedRemainingMs: null, revealCount: 0, submissions: {}, entries: [], votes: {}, scores: {},
  };
  for (const player of players) game.scores[player.id] = 0;
  room.funny = game;
  room.lastScoreboard = null; // New game starts a fresh scoreboard.
  room.phase = "playing";
  beginRound(io, room);
  return null;
}

function beginRound(io: Server, room: Room) {
  const game = room.funny;
  if (!game) return;
  game.round += 1;
  const currentPrompt = game.prompts[game.round - 1];
  game.prompt = currentPrompt.text;
  game.promptCategory = currentPrompt.category;
  game.stage = "submission";
  game.submissions = {};
  game.entries = [];
  game.votes = {};
  game.revealCount = 0;
  startPhaseTimer(game, SUBMISSION_MS, () => closeSubmissions(io, room));
  updateRoom(io, room);
}

export function submitFunnyAnswer(io: Server, room: Room, playerId: string, raw: unknown): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing" || game.stage !== "submission") return "Answer submission has closed.";
  if (game.deadline !== null && Date.now() >= game.deadline) {
    closeSubmissions(io, room);
    return "Answer submission has closed.";
  }
  if (!eligibleParticipants(room).some((p) => p.id === playerId)) return "You aren't playing this game.";
  if (typeof raw !== "string") return "Enter an answer.";
  const answer = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!answer || answer.length > MAX_ANSWER_LENGTH) return `Answers must contain 1–${MAX_ANSWER_LENGTH} characters.`;
  game.submissions[playerId] = answer; // Overwrites earlier submission until the phase closes.
  const online = eligibleParticipants(room);
  const allSubmitted = !game.paused && online.length > 0 && online.every(p => Boolean(game.submissions[p.id]));
  if (allSubmitted) closeSubmissions(io, room);
  else updateRoom(io, room);
  return null;
}

function closeSubmissions(io: Server, room: Room) {
  const game = room.funny;
  if (!game || game.stage !== "submission") return;
  stopFunnyTimer(game);
  const entries: FunnyAnswer[] = Object.entries(game.submissions)
    .map(([playerId, text]) => ({ id: randomUUID(), playerId, text }));
  game.entries = shuffle(entries);
  if (game.entries.length < 2) {
    // No contest: display the submitted answer, if any, but award no points.
    finishVoting(io, room);
    return;
  }
  game.stage = "reveal";
  game.revealCount = 0;
  revealAutomatically(io, room);
}

function revealAutomatically(io: Server, room: Room) {
  const game = room.funny;
  if (!game || game.stage !== "reveal") return;
  startPhaseTimer(game, REVEAL_MS, () => revealNext(io, room));
  updateRoom(io, room);
}

function revealNext(io: Server, room: Room) {
  const game = room.funny;
  if (!game || game.stage !== "reveal") return;
  stopFunnyTimer(game);

  // After the FINAL answer has been on top of the pile for a full reveal
  // interval, spread the cards and begin the separate reading period.
  if (game.revealCount >= game.entries.length) {
    game.stage = "review";
    startPhaseTimer(game, READING_MS, () => beginVoting(io, room));
    updateRoom(io, room);
    return;
  }

  game.revealCount += 1;
  // Keep the last card visible as its own reveal, just like every earlier card.
  // The next tick spreads the deck; a paused host can advance it manually.
  if (game.paused) {
    game.pausedRemainingMs = REVEAL_MS;
    updateRoom(io, room);
  } else {
    revealAutomatically(io, room);
  }
}

/** Legacy reveal commands are retained for existing clients. */
export function controlFunnyReveal(io: Server, room: Room, command: unknown): string | null {
  const game = room.funny;
  if (!game || game.stage !== "reveal") return "Reveal controls are only available during the reveal.";
  if (command === "next") {
    revealNext(io, room);
    return null;
  }
  return controlFunnyTimer(io, room, command);
}

/** All phases share one server-owned pause / resume / skip control. */
export function controlFunnyTimer(io: Server, room: Room, command: unknown): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing") return "No Funny Answers game is running.";
  if (game.stage === "finished") return "The game has finished.";
  if (command === "skip") {
    // Skip the current phase while retaining the host's timer preference.
    return skipFunnyPhase(io, room);
  }
  if (command === "next" && game.stage === "reveal") {
    revealNext(io, room);
    return null;
  }
  if (command === "pause") {
    if (game.paused) return null;
    // Capture remaining time BEFORE stopFunnyTimer clears the deadline.
    const remaining = Math.max(1, (game.deadline ?? Date.now()) - Date.now());
    stopFunnyTimer(game);
    game.pausedRemainingMs = remaining;
    game.paused = true;
    updateRoom(io, room);
    return null;
  }
  if (command === "resume") {
    if (!game.paused) return null;
    resumeFunnyTimer(io, room);
    return null;
  }
  return "Unknown timer control.";
}

function resumeFunnyTimer(io: Server, room: Room) {
  const game = room.funny;
  if (!game?.paused) return;
  const remaining = game.pausedRemainingMs ?? 1;
  game.paused = false;
  game.pausedRemainingMs = null;
  if (game.stage === "submission") {
    const online = eligibleParticipants(room);
    if (online.length > 0 && online.every(p => Boolean(game.submissions[p.id]))) return closeSubmissions(io, room);
    schedule(game, remaining, () => closeSubmissions(io, room));
  } else if (game.stage === "reveal") {
    schedule(game, remaining, () => revealNext(io, room));
  } else if (game.stage === "review") {
    schedule(game, remaining, () => beginVoting(io, room));
  } else if (game.stage === "voting") {
    const online = eligibleParticipants(room);
    if (online.length > 0 && online.every(p => Boolean(game.votes[p.id]))) return finishVoting(io, room);
    schedule(game, remaining, () => finishVoting(io, room));
  } else if (game.stage === "results") {
    schedule(game, remaining, () => advanceAfterResults(io, room));
  }
  updateRoom(io, room);
}

function beginVoting(io: Server, room: Room) {
  const game = room.funny;
  if (!game || game.stage !== "review") return;
  game.stage = "voting";
  startPhaseTimer(game, VOTING_MS, () => finishVoting(io, room));
  updateRoom(io, room);
}

export function submitFunnyVote(io: Server, room: Room, playerId: string, answerId: unknown): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing" || game.stage !== "voting") return "Voting has closed.";
  if (game.deadline !== null && Date.now() >= game.deadline) {
    finishVoting(io, room);
    return "Voting has closed.";
  }
  if (!eligibleParticipants(room).some((p) => p.id === playerId)) return "You aren't playing this game.";
  if (game.votes[playerId]) return "Your vote has already been submitted.";
  const answer = game.entries.find((entry) => entry.id === answerId);
  if (!answer) return "Choose a valid answer.";
  if (answer.playerId === playerId) return "You cannot vote for your own answer.";
  game.votes[playerId] = answer.id;
  const online = eligibleParticipants(room);
  const allVoted = !game.paused && online.length > 0 && online.every(p => Boolean(game.votes[p.id]));
  if (allVoted) finishVoting(io, room);
  else updateRoom(io, room);
  return null;
}

function finishVoting(io: Server, room: Room) {
  const game = room.funny;
  if (!game || (game.stage !== "voting" && game.stage !== "submission")) return;
  stopFunnyTimer(game);
  if (game.stage === "voting") {
    for (const answerId of Object.values(game.votes)) {
      const entry = game.entries.find((candidate) => candidate.id === answerId);
      if (entry) game.scores[entry.playerId] = (game.scores[entry.playerId] ?? 0) + 1;
    }
  }
  // Every round, including the last (and rounds with no contest), shows its
  // voter/author breakdown before moving on. Scores are awarded only once.
  game.stage = "results";
  startPhaseTimer(game, RESULTS_MS, () => advanceAfterResults(io, room));
  updateRoom(io, room);
}

function advanceAfterResults(io: Server, room: Room) {
  const game = room.funny;
  if (!game || game.stage !== "results") return;
  stopFunnyTimer(game);
  if (game.round < game.totalRounds) {
    beginRound(io, room);
  } else {
    game.stage = "finished";
    game.paused = false;
    game.pausedRemainingMs = null;
    // Final standings remain until the host returns to game selection.
    updateRoom(io, room);
  }
}

/** Host-only early advance for the currently timed/reveal phase. */
export function skipFunnyPhase(io: Server, room: Room): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing") return "No Funny Answers game is running.";
  switch (game.stage) {
    case "submission":
      closeSubmissions(io, room);
      return null;
    case "reveal":
      stopFunnyTimer(game);
      game.revealCount = game.entries.length;
      game.stage = "review";
      startPhaseTimer(game, READING_MS, () => beginVoting(io, room));
      updateRoom(io, room);
      return null;
    case "review":
      stopFunnyTimer(game);
      beginVoting(io, room);
      return null;
    case "voting":
      finishVoting(io, room);
      return null;
    case "results":
      advanceAfterResults(io, room);
      return null;
    default:
      return "There is no active phase to skip.";
  }
}

export function nextFunnyRound(io: Server, room: Room): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing" || game.stage !== "results") return "The current round isn't finished.";
  advanceAfterResults(io, room);
  return null;
}

export function closeFunnyGame(io: Server, room: Room): string | null {
  const game = room.funny;
  if (!game || room.phase !== "playing" || game.stage !== "finished") return "Finish the game first.";
  stopFunnyTimer(game);
  // Keep the just-finished scoreboard visible while choosing the next game.
  room.lastScoreboard = {
    gameId: "funny_answers",
    scores: game.participants.filter(player => room.players.some(current => current.id === player.id))
      .map(player => ({
        id: player.id, name: player.name, character: player.character,
        points: game.scores[player.id] ?? 0,
      })),
  };
  room.funny = null;
  room.selectedGame = null;
  room.phase = "selection";
  updateRoom(io, room);
  return null;
}

export function onFunnyRosterChange(io: Server, room: Room) {
  const game = room.funny;
  if (!game) return;
  const online = eligibleParticipants(room);
  if (!game.paused && game.stage === "submission" && online.length > 0 && online.every(p => Boolean(game.submissions[p.id]))) {
    closeSubmissions(io, room);
  } else if (!game.paused && game.stage === "voting" && online.length > 0 && online.every(p => Boolean(game.votes[p.id]))) {
    finishVoting(io, room);
  }
}

// A paused phase must never be stuck when its host disconnects.
export function onFunnyHostDisconnected(io: Server, room: Room) {
  if (room.funny?.paused) resumeFunnyTimer(io, room);
}
