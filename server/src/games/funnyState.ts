import type { FunnyState, Room } from "../types";

export function eligibleParticipants(room: Room) {
  const game = room.funny;
  return game ? game.participants.filter(participant => room.players.some(player => player.id === participant.id && player.socketId !== null)) : [];
}

export function publicFunny(room: Room) {
  const game = room.funny;
  if (!game) return null;
  const identitiesVisible = game.stage === "results" || game.stage === "finished";
  const visibleEntries = game.stage === "submission" ? []
    : game.stage === "reveal" ? game.entries.slice(0, game.revealCount)
    : game.entries;
  const publicEntries = visibleEntries.map((entry) => {
    const result: {
      id: string; text: string; author?: string; authorId?: string; votes?: number; voters?: string[]; voterIds?: string[];
    } = { id: entry.id, text: entry.text };
    if (identitiesVisible) {
      result.authorId = entry.playerId;
      result.author = game.participants.find((player) => player.id === entry.playerId)?.name ?? "Former player";
      const voterIds = Object.entries(game.votes).filter(([, answerId]) => answerId === entry.id).map(([id]) => id);
      result.votes = voterIds.length;
      result.voterIds = voterIds;
      result.voters = voterIds.map((id) => game.participants.find((player) => player.id === id)?.name ?? "Former player");
    }
    return result;
  });
  return {
    stage: game.stage,
    round: game.round,
    totalRounds: game.totalRounds,
    prompt: game.prompt,
    promptCategory: game.promptCategory,
    deadline: game.deadline,
    paused: game.paused,
    pausedRemainingMs: game.pausedRemainingMs,
    revealCount: game.revealCount,
    participantIds: game.participants.map((p) => p.id),
    participants: game.participants.map((p) => ({ id: p.id, name: p.name, character: p.character })),
    participantCount: game.participants.length,
    submittedCount: game.stage === "submission"
      ? eligibleParticipants(room).filter(p => Boolean(game.submissions[p.id])).length
      : Object.keys(game.submissions).length,
    eligibleCount: eligibleParticipants(room).length,
    votedCount: eligibleParticipants(room).filter((p) => Boolean(game.votes[p.id])).length,
    answers: publicEntries,
    // These totals change only when results are finalized; live votes remain secret.
    // Removed/kicked participants no longer appear in live or final scores.
    // Disconnected participants remain until explicitly removed (reconnect safety).
    scores: game.participants.filter(p => room.players.some(player => player.id === p.id))
      .map(p => ({ id: p.id, name: p.name, character: p.character, points: game.scores[p.id] ?? 0 })),
  };
}

export function privateFunny(game: FunnyState | null, playerId: string) {
  if (!game || !game.participants.some((p) => p.id === playerId)) return null;
  return {
    round: game.round,
    answer: game.submissions[playerId] ?? "",
    ownAnswerId: game.entries.find((answer) => answer.playerId === playerId)?.id ?? null,
    votedAnswerId: game.votes[playerId] ?? null,
  };
}

export function stopFunnyTimer(game: FunnyState | null) {
  if (!game) return;
  if (game.timer) clearTimeout(game.timer);
  game.timer = undefined;
  game.deadline = null;
  game.pausedRemainingMs = null;
}
