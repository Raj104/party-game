import type { Room } from "../../types/party";
import { SharedReadyLobby } from "../../components/SharedReadyLobby";

type Props = { room: Room; playerId: string | null; isHost: boolean; disabled: boolean; onAction: (event: string, payload?: unknown) => void };

export function FunnyReady({ room, playerId, isHost, disabled, onAction }: Props) {
  return <SharedReadyLobby gameId="funny_answers" room={room} playerId={playerId} isHost={isHost} disabled={disabled}
    onReady={ready => onAction("game_ready", ready)}
    onStart={() => onAction("funny_start", room.selectedRounds)}
    onBack={() => onAction("back_to_game_selection")}/>;
}
