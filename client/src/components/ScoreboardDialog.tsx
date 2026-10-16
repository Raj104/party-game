import type { RefObject } from "react";
import { findGame } from "../data/games";
import type { Room } from "../types/party";
import { PlayerIdentity } from "./PlayerIdentity";

type Props = {
  room: Room;
  currentPlayerId: string | null;
  dialogRef: RefObject<HTMLDialogElement | null>;
};

/** Room-wide, server-authoritative scores for the current (or last finished) game. */
export function ScoreboardDialog({ room, currentPlayerId, dialogRef }: Props) {
  const active = room.phase === "playing" && room.funny !== null;
  const gameId = active ? room.selectedGame : room.lastScoreboard?.gameId ?? null;
  const source = active ? room.funny?.scores : room.lastScoreboard?.scores;
  const scores = [...(source ?? [])].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const title = gameId ? findGame(gameId)?.title ?? "Game" : "No game yet";

  return (
    <dialog
      ref={dialogRef}
      className="room-scoreboard-dialog"
      aria-labelledby="room-scoreboard-title"
      onClick={(event) => {
        // Native <dialog> dispatches backdrop clicks at the dialog itself.
        // Do not close on clicks inside the visible scoreboard rectangle.
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom;
        if (outside) event.currentTarget.close();
      }}
    >
      <div className="scoreboard-dialog-header">
        <div>
          <p className="scoreboard-eyebrow">SCOREBOARD</p>
          <h2 id="room-scoreboard-title">{title}</h2>
          <p className="scoreboard-status">{active ? "Live scores · this game only" : scores.length ? "Last completed game" : "Scores will appear when a game begins."}</p>
        </div>
        <button type="button" className="scoreboard-close" onClick={() => dialogRef.current?.close()} aria-label="Close scoreboard">✕</button>
      </div>
      {scores.length > 0 ? (
        <ol className="scoreboard-rows">
          {scores.map((player) => {
            // Players tied on points share the same placement.
            const rank = 1 + scores.filter(other => other.points > player.points).length;
            return <li key={player.id} className={`scoreboard-row${player.id === currentPlayerId ? " scoreboard-row--self" : ""}`}>
              <span className="scoreboard-rank">{rank}.</span>
              <PlayerIdentity name={player.name} character={player.character} you={player.id === currentPlayerId} />
              <strong>{player.points} <small>pts</small></strong>
            </li>;
          })}
        </ol>
      ) : <p className="scoreboard-empty">Nothing on the scoreboard yet. Suspiciously peaceful.</p>}
      <p className="scoreboard-hint">Scores reset when the next game starts.</p>
    </dialog>
  );
}
