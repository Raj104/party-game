import type { Room } from "../types/party";
import { findGame } from "../data/games";
import { SharedReadyPanel } from "./SharedReadyPanel";
import "./SharedReadyLobby.css";

// Each game supplies only its heading, player limits, and Start action.
// Everything else—layout, instructions, Ready controls, and copy—is shared.
type ReadyGameId = "funny_answers" | "last_word";
const READY_GAMES: Record<ReadyGameId, { heading: string; minimum: number; maximum: number }> = {
  funny_answers: { heading: "Ready for some hot takes?", minimum: 3, maximum: 10 },
  last_word: { heading: "Get ready for the bomb.", minimum: 3, maximum: 6 },
};

export const READY_LOBBY_MESSAGE = "Read the rules, then tap Ready.";

type Props = {
  room: Room;
  gameId: ReadyGameId;
  playerId: string | null;
  isHost: boolean;
  disabled: boolean;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onBack: () => void;
};

/** Shared Ready lobby for every playable game and rematch. */
export function SharedReadyLobby({ room, gameId, playerId, isHost, disabled, onReady, onStart, onBack }: Props) {
  const config = READY_GAMES[gameId];
  const game = findGame(gameId);
  if (!game) return null;

  return <section className="ready-lobby" aria-label={`${game.title} ready room`}>
    <div className="ready-lobby-topbar">
      <div className="ready-lobby-intro">
        <span className="ready-lobby-eyebrow">UP NEXT · {game.title.toUpperCase()}</span>
        <h2>{config.heading}</h2>
        <p>{READY_LOBBY_MESSAGE}</p>
      </div>
      {isHost && <button className="ready-lobby-back" type="button" disabled={disabled} onClick={onBack}>← All games</button>}
    </div>
    <div className="ready-lobby-columns">
      <div className="ready-lobby-instructions">
        <h3>How to play</h3>
        <ol>{game.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}</ol>
      </div>
      <SharedReadyPanel room={room} playerId={playerId} isHost={isHost} disabled={disabled}
        minimum={config.minimum} maximum={config.maximum} gameTitle={game.title}
        onReady={onReady} onStart={onStart}/>
    </div>
  </section>;
}
