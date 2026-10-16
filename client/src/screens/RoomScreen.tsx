import { GamePhasePanel } from "../components/GamePhasePanel";
import { PlayerList } from "../components/PlayerList";
import { ScoreboardDialog } from "../components/ScoreboardDialog";
import { useEffect, useRef } from "react";
import { FunnyGame } from "../games/FunnyAnswers/FunnyGame";
import type { PartyRoomController } from "../hooks/usePartyRoom";
import type { Player } from "../types/party";

type Props = { party: PartyRoomController & { room: NonNullable<PartyRoomController["room"]> } };

export function RoomScreen({ party }: Props) {
  const { room, connected, gameActionBusy, isHost, copyCode, copyInviteLink, openDisplay, copyDisplayLink, leaveRoom, runGameAction } = party;
  const playing = room.phase === "playing";
  const scoreboardRef = useRef<HTMLDialogElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const menu = settingsRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && settingsRef.current?.open) {
        settingsRef.current.open = false;
        settingsRef.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function openScoreboard() {
    if (settingsRef.current) settingsRef.current.open = false;
    scoreboardRef.current?.showModal();
  }

  function closeSettingsThen(action: () => void) {
    if (settingsRef.current) settingsRef.current.open = false;
    action();
  }
  function kickPlayer(player: Player) {
    if (window.confirm(`Remove ${player.name} from this room? Their spot and recovery token will be invalidated.`)) {
      runGameAction("kick_player", player.id);
    }
  }
  return (
    <section className={`panel room-view${playing ? " room-view--playing" : ""}`}>
      <div className="room-topbar">
        <div className="room-topbar-identity">
          <strong className="room-code-compact">{room.code}</strong>
          <button type="button" className="room-icon-button" onClick={copyCode} title="Copy room code" aria-label="Copy room code">⧉</button>
        </div>
        <div className="room-topbar-actions">
          <span className="room-player-count">{room.players.length} / 12 players</span>
          <button type="button" className="room-scoreboard-trigger" onClick={openScoreboard}
            title="Current game scoreboard" aria-label="Open scoreboard">🏆 <span>Scores</span></button>
          <details className="room-settings" ref={settingsRef}>
            <summary aria-label="Room settings" title="Room settings">⚙ <span>Settings</span></summary>
            <div className="room-settings-menu">
              <button type="button" className="secondary" onClick={() => closeSettingsThen(copyInviteLink)}>↗ Copy invite link</button>
              <button type="button" className="secondary" onClick={() => closeSettingsThen(copyCode)}>⧉ Copy room code</button>
              {isHost && <>
                <button type="button" className="secondary" onClick={() => closeSettingsThen(openDisplay)}>▣ Open shared display</button>
                <button type="button" className="secondary" onClick={() => closeSettingsThen(copyDisplayLink)}>⧉ Copy display link</button>
              </>}
              {room.displayCount > 0 && <p className="room-settings-note">{room.displayCount} shared display{room.displayCount === 1 ? "" : "s"} connected</p>}
              <button type="button" className="danger" onClick={() => closeSettingsThen(leaveRoom)}>Leave room</button>
            </div>
          </details>
        </div>
      </div>
      <details className="room-roster" key={playing ? "in-game" : "lobby"} open={!playing}>
        <summary>Players <span className="roster-hint">{playing ? "Tap to see who's here" : "Who's here"}</span></summary>
        <PlayerList players={room.players} currentPlayerId={party.currentPlayerId} isHost={isHost} onKick={kickPlayer} />
      </details>
      <ScoreboardDialog dialogRef={scoreboardRef} room={room} currentPlayerId={party.currentPlayerId} />
      <div className="room-main-content">
        {playing && room.selectedGame === "funny_answers" ? (
          <FunnyGame room={room} privateState={party.funnyPrivate} playerId={party.currentPlayerId}
            isHost={isHost} connected={connected} busy={party.funnyBusy} onAction={party.runFunnyAction} />
        ) : (
          <GamePhasePanel room={room} isHost={isHost} connected={connected} busy={gameActionBusy}
            onAction={runGameAction} onSetRounds={(rounds) => party.runGameAction("set_game_rounds", rounds)} onStartFunny={(rounds) => party.runFunnyAction("funny_start", rounds)} />
        )}
      </div>
    </section>
  );
}
