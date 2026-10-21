import type { Room } from "../types/party";
import { CharacterToken } from "./CharacterToken";

type Props = {
  room: Room; playerId: string|null; isHost: boolean; disabled: boolean;
  minimum: number; maximum: number; gameTitle: string;
  onReady: (ready:boolean)=>void; onStart: ()=>void;
};
/** Reusable pre-match gate for all games and replays. */
export function SharedReadyPanel({room,playerId,isHost,disabled,minimum,maximum,gameTitle,onReady,onStart}: Props) {
  const online=room.players.filter(player=>player.connected);
  const readyMap=room.gameReady ?? room.lastWordReady ?? {};
  const readyCount=online.filter(player=>readyMap[player.id]).length;
  const count=room.selectedGame==="funny_answers"?online.length:room.players.length;
  const valid=count>=minimum&&count<=maximum;
  const allReady=online.every(player=>readyMap[player.id]);
  const ready=Boolean(playerId&&readyMap[playerId]);
  return <section className="ready-lobby-panel" aria-label={`${gameTitle} player readiness`}>
    <div className="ready-lobby-heading"><h3>Who's ready?</h3><span>{readyCount}/{online.length} connected ready</span></div>
    <div className="ready-lobby-list">{room.players.map(player=><div key={player.id} className={`ready-lobby-player ${!player.connected?"ready-lobby-disconnected":""}`}>
      <CharacterToken character={player.character}/><span>{player.name}{player.id===playerId?" (you)":""}</span>
      <strong>{!player.connected?"Disconnected":readyMap[player.id]?"Ready":"Waiting"}</strong>
    </div>)}</div>
    {!valid&&<p className="ready-lobby-warning" role="status">{gameTitle} needs {minimum}–{maximum} players. There are {count} in this room.</p>}
    {playerId&&<button type="button" className={`ready-lobby-toggle${ready?" ready-lobby-toggle--ready":""}`} disabled={disabled} onClick={()=>onReady(!ready)}>{ready?"Not Ready":"I'm Ready!"}</button>}
    {isHost?<button type="button" className="ready-lobby-start" disabled={disabled||!valid||!allReady} onClick={onStart}>Start {gameTitle} →</button> :
      <p className="ready-lobby-wait">{valid&&allReady?"Waiting for the host to start…":"Waiting for everyone to be ready…"}</p>}
  </section>;
}
