import type { Player } from "../types/party";

type Props = { players: Player[]; variant?: "player" | "tv" };

export function PlayerList({ players, variant = "player" }: Props) {
  if (variant === "tv") {
    return (
      <section className="tv-players">
        <h2>Players ({players.length}/12)</h2>
        <div className="tv-player-grid">
          {players.map((player) => (
            <div className={"tv-player" + (!player.connected ? " offline-player" : "")} key={player.id}>
              <span className="tv-avatar">{player.isHost ? "👑" : "🎮"}</span>
              <span>{player.name}</span>
              {!player.connected && <span className="player-status">Reconnecting...</span>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="room-info">
      <h3>Players ({players.length}/12)</h3>
      <div className="player-list">
        {players.map((player) => (
          <div className={"player" + (!player.connected ? " offline-player" : "")} key={player.id}>
            <span>
              {player.isHost ? "👑 " : "🎮 "}{player.name}
              {!player.connected && " (Offline)"}
            </span>
            {player.isHost && <span className="host-tag">HOST</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
