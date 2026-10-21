import type { Room } from "../../types/party";
import { SharedReadyLobby } from "../../components/SharedReadyLobby";

type Props = { room: Room; isHost: boolean; playerId: string | null; disabled: boolean; onAction: (event: string, payload?: boolean) => void };

export function LastWordSetup({ room, isHost, playerId, disabled, onAction }: Props) {
  return <SharedReadyLobby gameId="last_word" room={room} playerId={playerId} isHost={isHost} disabled={disabled}
    onReady={ready => onAction("game_ready", ready)}
    onStart={() => onAction("last_word_start")}
    onBack={() => onAction("back_to_game_selection")}/>;
}
