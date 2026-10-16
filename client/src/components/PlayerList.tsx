import { PlayerIdentity } from "./PlayerIdentity";
import type { Player } from "../types/party";

type Props = { players: Player[]; variant?: "player" | "tv"; currentPlayerId?: string | null; isHost?: boolean; onKick?: (player: Player) => void };

export function PlayerList({ players, variant = "player", currentPlayerId = null, isHost = false, onKick }: Props) {
  return (
    <div className={variant === "tv" ? "tv-player-grid" : "player-list"}>
      {players.map(player => (
        <div key={player.id} className={`${variant === "tv" ? "tv-player" : "player"}${player.connected ? "" : " offline-player"}${variant === "player" && player.id === currentPlayerId ? " player--self" : ""}`}>
          <PlayerIdentity name={player.name} character={player.character} host={player.isHost} offline={!player.connected} you={variant === "player" && player.id === currentPlayerId} />
          {variant === "player" && isHost && !player.isHost && onKick && (
            <button type="button" className="room-kick-player" title={`Remove ${player.name} from room`}
              aria-label={`Remove ${player.name} from room`} onClick={() => onKick(player)}>Remove</button>
          )}
        </div>
      ))}
    </div>
  );
}
