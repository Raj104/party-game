import { GAMES, findGame } from "../data/games";
import type { GameId, Room } from "../types/party";
import { GameCard } from "./GameCard";

type Props = {
  room: Room;
  isHost: boolean;
  connected: boolean;
  busy: boolean;
  onAction: (event: string, gameId?: GameId) => void;
};

export function GamePhasePanel({ room, isHost, connected, busy, onAction }: Props) {
  const selectedGame = findGame(room.selectedGame);
  const disabled = !connected || busy;
  return (
    <section className="game-phase-panel" aria-live="polite">
      {room.phase === "lobby" && (
        <>
          <p className="game-eyebrow">LOBBY</p>
          <h3>Ready for a mini-game?</h3>
          {isHost ? (
            <button className="primary" onClick={() => onAction("open_game_selection")} disabled={disabled}>
              Choose a Game
            </button>
          ) : (
            <p className="muted">Waiting for the host to choose a game...</p>
          )}
        </>
      )}

      {room.phase === "selection" && (
        <>
          <p className="game-eyebrow">GAME SELECTION</p>
          <h3>Pick a mini-game</h3>
          <div className="game-card-grid">
            {GAMES.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                selected={room.selectedGame === game.id}
                disabled={!isHost || disabled}
                onSelect={() => onAction("select_game", game.id)}
              />
            ))}
          </div>
          {isHost ? (
            <div className="game-phase-actions">
              <button className="primary" onClick={() => onAction("show_game_instructions")} disabled={disabled || !room.selectedGame}>
                Show Instructions
              </button>
              <button className="secondary" onClick={() => onAction("return_to_lobby")} disabled={disabled}>
                Back to Lobby
              </button>
            </div>
          ) : (
            <p className="muted">The host is choosing the next game...</p>
          )}
        </>
      )}

      {room.phase === "instructions" && selectedGame && (
        <>
          <p className="game-eyebrow">HOW TO PLAY</p>
          <h3>{selectedGame.emoji} {selectedGame.title}</h3>
          <ol className="game-instructions">
            {selectedGame.instructions.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="muted">The actual gameplay comes in our next milestone.</p>
          {isHost && (
            <div className="game-phase-actions">
              <button className="secondary" onClick={() => onAction("back_to_game_selection")} disabled={disabled}>
                Change Game
              </button>
              <button className="secondary" onClick={() => onAction("return_to_lobby")} disabled={disabled}>
                Back to Lobby
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
