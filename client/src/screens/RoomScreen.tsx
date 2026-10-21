import { GamePhasePanel } from "../components/GamePhasePanel";
import { PlayerList } from "../components/PlayerList";
import { ScoreboardDialog } from "../components/ScoreboardDialog";
import { useEffect, useRef, useState } from "react";
import { LastWordGame } from "../games/LastWord/LastWordGame";
import { LastWordSetup } from "../games/LastWord/LastWordSetup";
import { FunnyGame } from "../games/FunnyAnswers/FunnyGame";
import { FunnyReady } from "../games/FunnyAnswers/FunnyReady";
import type { PartyRoomController } from "../hooks/usePartyRoom";
import type { Player } from "../types/party";
import { AUDIO_ENABLED } from "../lib/audio";

type Props = { party: PartyRoomController & { room: NonNullable<PartyRoomController["room"]> } };

export function RoomScreen({ party }: Props) {
  const { room, connected, gameActionBusy, isHost, copyCode, copyInviteLink, openDisplay, copyDisplayLink, leaveRoom, runGameAction } = party;
  const playing = room.phase === "playing";
  const inGameReady = room.phase === "instructions";
  const scoreboardRef = useRef<HTMLDialogElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const [soundOn,setSoundOn]=useState(()=>{try{return localStorage.getItem("fff-sound")!=="off";}catch{return false;}});
  function toggleSound(){setSoundOn(previous=>{const next=!previous;try{localStorage.setItem("fff-sound",next?"on":"off");}catch{/* Private browsing */}return next;});}

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
              <button type="button" className="secondary" onClick={toggleSound} disabled={!AUDIO_ENABLED} aria-pressed={AUDIO_ENABLED && soundOn} title={!AUDIO_ENABLED ? "Audio is temporarily disabled" : undefined}>{AUDIO_ENABLED ? (soundOn ? "🔊 Sound effects: On" : "🔇 Sound effects: Off") : "🔇 Sound effects: Temporarily off"}</button>
              <button type="button" className="danger" onClick={() => closeSettingsThen(leaveRoom)}>Leave room</button>
            </div>
          </details>
        </div>
      </div>
      <details className="room-roster" key={playing || inGameReady ? "in-game" : "lobby"} open={!playing && !inGameReady}>
        <summary>Players <span className="roster-hint">{playing ? "Tap to see who's here" : "Who's here"}</span></summary>
        <PlayerList players={room.players} currentPlayerId={party.currentPlayerId} isHost={isHost} onKick={kickPlayer} />
      </details>
      <ScoreboardDialog dialogRef={scoreboardRef} room={room} currentPlayerId={party.currentPlayerId} />
      <div className="room-main-content">
        {playing && room.selectedGame === "funny_answers" ? (
          <FunnyGame room={room} privateState={party.funnyPrivate} playerId={party.currentPlayerId}
            isHost={isHost} connected={connected} busy={party.funnyBusy} onAction={party.runFunnyAction} />
        ) : playing && room.selectedGame === "last_word" ? (
          <LastWordGame room={room} playerId={party.currentPlayerId} isHost={isHost} connected={connected} onAction={party.runLastWordAction}/>
        ) : room.phase === "instructions" && room.selectedGame === "funny_answers" ? (
          <FunnyReady room={room} playerId={party.currentPlayerId} isHost={isHost} disabled={!connected || gameActionBusy}
            onAction={(event,payload)=>{
              if(event==="funny_start") party.runFunnyAction(event,payload as number);
              else if(payload!==undefined) party.runLastWordAction(event,payload);
              else runGameAction(event);
            }}/>
        ) : room.phase === "instructions" && room.selectedGame === "last_word" ? (
          <LastWordSetup room={room} isHost={isHost} playerId={party.currentPlayerId}
            disabled={!connected || gameActionBusy} onAction={(event,payload) => {
              if (event === "back_to_game_selection") runGameAction(event);
              else party.runLastWordAction(event,payload);
            }} />
        ) : (
          <GamePhasePanel room={room} isHost={isHost} connected={connected} busy={gameActionBusy}
            onAction={runGameAction} onSetRounds={(rounds) => party.runGameAction("set_game_rounds", rounds)} />
        )}
      </div>
    </section>
  );
}
