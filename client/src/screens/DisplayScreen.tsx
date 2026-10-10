import { PlayerList } from "../components/PlayerList";
import { findGame } from "../data/games";
import { returnFromDisplay } from "../lib/session";
import type { Room } from "../types/party";

type Props = { room: Room | null; connected: boolean; error: string };

export function DisplayScreen({ room, connected, error }: Props) {
  const selectedGame = room ? findGame(room.selectedGame) : undefined;
  return (
    <main className="tv-screen">
      <header className="tv-header">
        <h1>FFF | Fun with Friends &amp; Family</h1>
        <span className="tv-badge">SHARED DISPLAY</span>
      </header>
      {room ? (
        <div className="tv-content">
          <p className="tv-label">JOIN THE PARTY!</p>
          <h2 className="tv-code">{room.code}</h2>
          <p className="tv-instructions">
            Open the Game website on your phone and enter the room code!
          </p>
          {room.phase === "selection" && (
            <section className="game-phase-panel" aria-live="polite">
              <p className="game-eyebrow">GAME SELECTION</p>
              <h2>Choosing a mini-game</h2>
              {selectedGame ? (
                <p className="game-big-choice">{selectedGame.emoji} {selectedGame.title}</p>
              ) : (
                <p>Waiting for the host to pick a game...</p>
              )}
            </section>
          )}
          {room.phase === "instructions" && selectedGame && (
            <section className="game-phase-panel" aria-live="polite">
              <p className="game-eyebrow">HOW TO PLAY</p>
              <h2>{selectedGame.emoji} {selectedGame.title}</h2>
              <ol className="game-instructions">
                {selectedGame.instructions.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <p className="muted">Gameplay is coming in the next milestone.</p>
            </section>
          )}
          <PlayerList players={room.players} variant="tv" />
          <div className="tv-waiting">
            <span className="pulse-dot" />
            {room.phase === "lobby"
              ? "Waiting for the game to start..."
              : room.phase === "selection"
                ? "Host is selecting a game..."
                : "Get ready to play!"}
          </div>
        </div>
      ) : (
        <div className="tv-content">
          <h2>{connected ? "Room Unavailable" : "Connecting..."}</h2>
          <p className="tv-instructions">{error || "Connecting to the multiplayer server..."}</p>
          <button className="secondary" onClick={returnFromDisplay}>Return to Home</button>
        </div>
      )}
      <footer className="tv-footer">FFF • Shared Screen Mode</footer>
    </main>
  );
}
