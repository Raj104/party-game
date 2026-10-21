import { useEffect, useMemo, useRef, useState, useId, type CSSProperties } from "react";
import type { ActionResponse, LastWordPlayer, LastWordPublic, Room } from "../../types/party";
import { CharacterToken } from "../../components/CharacterToken";
import { BombBuddy } from "./BombBuddy";
import { AUDIO_ENABLED } from "../../lib/audio";
import { bombFlightWaypoints } from "./bombFlightPath";
import "./last-word.css";

type Props={room:Room;playerId:string|null;isHost:boolean;connected:boolean;onAction:(event:string,payload?:unknown,callback?:(result:ActionResponse)=>void)=>void;display?:boolean};
const DRAFTS=new Map<string,string>();
// A single source for the three award captions on phones and shared displays.
const AWARD_CAPTIONS: Record<string,string> = {
  "Longest Word": "Someone swallowed a dictionary.",
  "Fastest Word": "Faster than a bad decision.",
  "Closest Call": "One heartbeat from disaster.",
};
function Hearts({units}: {units:number}) {
  // Each instance gets unique clip IDs so mobile hearts cannot accidentally
  // reference the gradient created for a different player's heart count.
  const uid=useId().replaceAll(":", "");
  const remaining=Math.max(0,Math.min(6,units));
  return <span className="lw-hearts" aria-label={`${remaining/2} hearts remaining`}>
    {[0,1,2].map(i=>{
      const half=Math.max(0,Math.min(2,remaining-i*2));
      const clip=`lw-heart-half-${uid}-${i}`;
      return <svg key={i} viewBox="0 0 24 24" className="lw-heart" aria-hidden="true">
        <defs><clipPath id={clip}><rect x="0" y="0" width="12" height="24"/></clipPath></defs>
        <path fill="#dfd5ca" stroke="#42332f" strokeWidth="1.5" d="M12 21S2 14.8 2 8.3C2 2.7 9 1.7 12 6.3c3-4.6 10-3.6 10 2C22 14.8 12 21 12 21Z"/>
        {half>0&&<path fill="#ef9177" clipPath={half===1?`url(#${clip})`:undefined} d="M12 21S2 14.8 2 8.3C2 2.7 9 1.7 12 6.3c3-4.6 10-3.6 10 2C22 14.8 12 21 12 21Z"/>}
        <path fill="none" stroke="#42332f" strokeWidth="1.5" d="M12 21S2 14.8 2 8.3C2 2.7 9 1.7 12 6.3c3-4.6 10-3.6 10 2C22 14.8 12 21 12 21Z"/>
      </svg>;
    })}
  </span>;
}

function useNow(serverNow:number) {
  const [now,setNow]=useState(Date.now());
  const offsetRef=useRef(0);
  useEffect(()=>{offsetRef.current=serverNow-Date.now();},[serverNow]);
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()+offsetRef.current),75);return ()=>clearInterval(t);},[]);
  return now;
}
function Clock({game,now}:{game:LastWordPublic;now:number}) {
  const left=game.paused?((game.pausedRemaining??game.turnDurationMs)/1000):Math.max(0,((game.turnDeadline??now)-now)/1000);
  const remaining=game.stage==="turn"?left:0;
  return <div className={`lw-clock ${remaining<=4?"lw-clock--danger":remaining<=8?"lw-clock--warning":""}`} style={{"--clock-fill":`${Math.min(100,(remaining/(game.turnDurationMs/1000))*100)}%`} as CSSProperties} aria-label={`${Math.ceil(remaining)} seconds remaining`}><span>{game.paused?"Ⅱ":game.stage==="turn"?Math.ceil(remaining):"—"}</span></div>;
}
function Roundtable({game,room,now,compact=false}:{game:LastWordPublic;room:Room;now:number;compact?:boolean}) {
  const survivors=game.order.map(id=>game.participants.find(p=>p.id===id)).filter((p):p is LastWordPlayer=>Boolean(p&&(p.hearts>0||(game.stage==="impact"&&game.impactPlayerId===p.id))));
  const holder=game.stage==="handoff"?game.pendingPlayerId:game.activePlayerId;
  const moodForTurn=():"calm"|"nervous"|"angry"=>{
    if(game.stage!=="turn")return "calm";
    const elapsed=Math.max(0,Math.min(1,(game.turnDurationMs-Math.max(0,(game.turnDeadline??now)-now))/game.turnDurationMs));
    // Mostly progressive urgency, with occasional harmless early/late fake-outs.
    if(game.turnNumber%5===0&&elapsed<.15)return "angry";
    if(game.turnNumber%4===0&&elapsed>.65&&elapsed<.72)return "calm";
    return elapsed<.45?"calm":elapsed<.78?"nervous":"angry";
  };
  const flightPoints=bombFlightWaypoints(survivors.map(p=>p.id),game.handoffFromPlayerId,game.pendingPlayerId);
  const flightStyle=Object.fromEntries(flightPoints.flatMap((point,i)=>[
    [`--fly-x${i}`,`${point.x.toFixed(3)}%`],
    [`--fly-y${i}`,`${point.y.toFixed(3)}%`],
  ])) as CSSProperties;
  if(compact) return <div className="lw-strip"><strong>Bomb Buddy: {game.participants.find(p=>p.id===holder)?.name??"Passing…"}</strong><span>Next: {survivors[(survivors.findIndex(p=>p.id===holder)+1)%Math.max(1,survivors.length)]?.name??"—"}</span><span>{survivors.length} alive</span></div>;
  return <div className={`lw-table lw-table--${game.stage}`} aria-label="Surviving players roundtable">
    <div className="lw-table-surface"><div className="lw-center">{game.stage==="turn"?<><strong className="lw-letters">{game.prompt}</strong><small>{game.levelName}: {game.rule}</small></>:<small>{game.stage==="handoff"?"PASSING THE BOMB":game.stage==="level"?"LEVEL UP!":game.stage==="impact"?"EXPLOSION":game.stage==="respawn"?"NEW BOMB":"LAST WORD"}</small>}{game.stage==="respawn"&&<span className="lw-bomb-respawn"><BombBuddy/></span>}</div></div>
    {game.stage==="handoff"&&game.pendingPlayerId&&<span className="lw-bomb-flight" style={flightStyle}><BombBuddy/></span>}
    {survivors.map((p,i)=>{
      const angle=(2*Math.PI*i/survivors.length)-Math.PI/2;
      const connected=room.players.find(r=>r.id===p.id)?.connected??false;
      const active=holder===p.id;
      const outside= Math.cos(angle) < -0.1 ? "lw-seat--bomb-left" : "lw-seat--bomb-right";
      const turnRemainingMs=game.paused
        ? (game.pausedRemaining??game.turnDurationMs)
        : Math.max(0,(game.turnDeadline??now)-now);
      const timerUrgency=turnRemainingMs<=3000?"danger":turnRemainingMs<=6500?"warning":"calm";
      return <div key={p.id} className={`lw-seat lw-seat--${p.character} ${active?"lw-seat--active":""} ${active?outside:""} ${!connected?"lw-seat--offline":""} ${game.stage==="impact"&&game.impactPlayerId===p.id?"lw-seat--impact":""}`} style={{"--seat-x":`${50+43*Math.cos(angle)}%`,"--seat-y":`${50+39*Math.sin(angle)}%`} as CSSProperties}>
        <div className="lw-seat-token">{game.stage==="impact"&&game.impact==="eliminated"&&game.impactPlayerId===p.id ? <span className="lw-token-split"><span className="lw-split-half lw-split-left"><CharacterToken character={p.character} size="large"/></span><span className="lw-split-half lw-split-right"><CharacterToken character={p.character} size="large"/></span><span className="lw-smoke"/></span> : <CharacterToken character={p.character} size="large"/>}{active&&game.stage==="turn"&&<span className={`lw-seat-ring lw-seat-ring--${timerUrgency}`} style={{"--clock-fill":`${Math.max(0,Math.min(100,turnRemainingMs/game.turnDurationMs*100))}%`} as CSSProperties} aria-hidden="true"/>}{active&&game.stage==="turn"&&<span className="lw-seat-bomb"><BombBuddy urgent={moodForTurn()}/></span>}{game.stage==="impact"&&game.impactPlayerId===p.id&&<span className="lw-impact-burst" aria-hidden="true"><strong>BOOM!</strong><span className="lw-impact-cloud"/></span>}</div>
        <strong>{p.name}</strong><Hearts units={p.hearts}/>{!connected&&<span className="lw-status-dot" title="Disconnected"/>}
        {(game.stage==="rearrange"||game.stage==="finalPoint")&&game.impact==="eliminated"&&<span className="lw-survival-point">+1</span>}
      </div>;
    })}
  </div>;
}
function Standings({game}:{game:LastWordPublic}) {
  const sorted=[...game.participants].sort((a,b)=>
    b.points-a.points||(a.placement??99)-(b.placement??99)||a.name.localeCompare(b.name));
  return <ol className="lw-standings">{sorted.map((p,i)=><li key={p.id} className={p.id===game.winnerId?"lw-standing--champion":""}>
    <span className="lw-standing-rank">{i+1}</span>
    <span className="lw-standing-character"><CharacterToken character={p.character}/></span>
    <strong>{p.name}{p.id===game.winnerId&&<span className="lw-standing-label">CHAMPION</span>}</strong>
    <span className="lw-points">{p.points} pts</span>
  </li>)}</ol>;
}
function useSounds(stage:LastWordPublic["stage"]) {
  const previous=useRef(stage);
  useEffect(()=>{
    if(previous.current===stage)return;
    previous.current=stage;
    if(!AUDIO_ENABLED)return; // Temporarily silence playback without removing sound generation.
    if(!["handoff","impact","champion"].includes(stage))return;
    // Native audio stays off unless an existing app-level preference explicitly enables it.
    // User gesture requirements are handled by the browser; failure is harmless.
    let enabled=false;
    try { enabled=localStorage.getItem("fff-sound")!=="off"; } catch {enabled=false;}
    if(!enabled)return;
    try {
      const AudioContextCtor=window.AudioContext;
      if(!AudioContextCtor)return;
      const ctx=new AudioContextCtor();
      if(ctx.state==="suspended") {void ctx.close();return;}
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.type=stage==="impact"?"sawtooth":"sine";
      osc.frequency.setValueAtTime(stage==="impact"?110:stage==="champion"?620:350,ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(stage==="impact"?45:stage==="champion"?900:510,ctx.currentTime+0.16);
      gain.gain.setValueAtTime(0.025,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.19);
      osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.19);
      osc.onended=()=>{void ctx.close();};
    } catch {/* Sound is never necessary to play. */}
  },[stage]);
}
export function LastWordGame({room,playerId,isHost,connected,onAction,display=false}:Props) {
  const game=room.lastWord;
  const now=useNow(room.serverNow);
  const turnNumber=game?.turnNumber??0;
  const key=`${room.code}:${playerId??""}:${turnNumber}`;
  const [draft,setDraft]=useState(()=>DRAFTS.get(key)??"");
  const [editing,setEditing]=useState(false);
  const [pending,setPending]=useState(false);
  const pendingRef=useRef(false);
  const [pendingSince,setPendingSince]=useState(0);
  const [inputError,setInputError]=useState("");
  const inputRef=useRef<HTMLInputElement>(null);
  const latestTurn=useRef(turnNumber);
  useEffect(()=>{
    if(latestTurn.current!==turnNumber) {
      DRAFTS.delete(`${room.code}:${playerId??""}:${latestTurn.current}`);
      latestTurn.current=turnNumber;
      setDraft(DRAFTS.get(`${room.code}:${playerId??""}:${turnNumber}`)??"");
      setInputError("");setEditing(false);setPending(false);pendingRef.current=false;
    }
  },[turnNumber,room.code,playerId]);
  const priorConnection=useRef(connected);
  useEffect(()=>{
    if(connected&&!priorConnection.current) {
      // The new room snapshot is authoritative; an old socket ACK may never arrive.
      pendingRef.current=false;
      setPending(false);
    }
    priorConnection.current=connected;
  },[connected]);
  const stage=game?.stage??"countdown";
  useSounds(stage);
  const self=game?.participants.find(p=>p.id===playerId);
  const active=Boolean(self&&self.hearts>0&&game?.activePlayerId===playerId&&stage==="turn");
  const spectating=display||!self||self.hearts===0;
  const nextUp=game?.pendingPlayerId===playerId&&stage==="handoff";
  const currentInvalid=Boolean(inputError);
  const canUse=connected&&!pending&&active&&!game?.paused;
  const myTurn=active&&!spectating;
  const isStale=game?.turnDeadline!==null&&game!==null&&now>=game.turnDeadline;
  const validatingText=pending&&(now-pendingSince>2000?"Waiting for server…":"Checking…");
  const gameId=game?.winnerId;
  const winner=game?.participants.find(p=>p.id===gameId);
  const currentAward=game?.awards[game.awardIndex];
  const awardWinner=game?.participants.find(p=>p.id===currentAward?.playerId);
  const playerCharacter=self?.character??"scribble";
  const activeKey=game?.activePlayerId??"";
  const promptInfo=useMemo(()=>game?.prompt??"",[game?.prompt]);
  if(!game)return <p>Loading Last Word…</p>;
  const validRematchCount=room.players.length;
  const canRematch=validRematchCount>=3&&validRematchCount<=6;
  function changeDraft(value:string) {setDraft(value);DRAFTS.set(key,value);setInputError("");}
  function submit() {
    if(!canUse||!draft.trim()||isStale||pendingRef.current)return;
    pendingRef.current=true;
    setPending(true);setPendingSince(Date.now());setInputError("");
    onAction("last_word_submit",{word:draft,turnNumber},result=>{
      pendingRef.current=false;
      setPending(false);
      if(!result.ok) {setInputError(result.error??"Try another word.");inputRef.current?.focus();}
      else {DRAFTS.delete(key);setDraft("");}
    });
  }
  function endTyping(){if(document.activeElement===inputRef.current)return;setEditing(false);}
  if(stage==="countdown") return <section className="lw-screen lw-countdown"><div className="lw-kicker">GET READY</div><h1>{Math.max(1,Math.ceil(((game.stageDeadline??now)-now)/1000))}</h1><p>Last Word is starting!</p><small>Everyone enters together · turn order stays secret</small></section>;
  if(stage==="champion"&&winner) return <section className="lw-screen lw-winner" aria-live="polite">
    <div className="lw-ceremony-stars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="lw-ceremony-kicker">THE FINAL RESULTS ARE IN</div>
    <div className="lw-winner-title">LAST WORD CHAMPION</div>
    <div className="lw-winner-token"><CharacterToken character={winner.character} size="large"/></div>
    <h1>{winner.name}</h1><p className="lw-winner-score">{winner.points} total points</p>
    <p>Tied on points? Better survival placement wins.</p>
    <div className="lw-ceremony-timer lw-ceremony-timer--champion" aria-hidden="true"><span/></div>
    {isHost&&!display&&<button className="secondary lw-skip-ceremony" onClick={()=>onAction("last_word_skip_awards")}>Skip to Results</button>}
  </section>;
  if(stage==="awards"&&currentAward&&awardWinner) return <section className="lw-screen lw-award" key={game.awardIndex} aria-live="polite">
    <div className="lw-ceremony-stars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
    <div className="lw-ceremony-kicker">BONUS AWARD {game.awardIndex+1} OF {game.awards.length}</div>
    <h1>{currentAward.key}</h1>
    <div className="lw-award-token"><CharacterToken character={awardWinner.character} size="large"/></div>
    <h2>{awardWinner.name}</h2><p className="lw-award-caption">{AWARD_CAPTIONS[currentAward.key]}</p><p className="lw-award-stat">{currentAward.stat}</p>
    <strong className="lw-award-points">+1 POINT</strong>
    <div className="lw-ceremony-timer lw-ceremony-timer--award" aria-hidden="true"><span/></div>
    {isHost&&!display&&<button className="secondary lw-skip-ceremony" onClick={()=>onAction("last_word_skip_awards")}>Skip to Results</button>}
  </section>;
  if(stage==="results")return <section className="lw-screen lw-results"><div className="lw-kicker">MATCH RESULTS</div><h2>Last Word Champion</h2><div className="lw-winner-inline">{winner&&<CharacterToken character={winner.character} size="large"/>}<strong>{winner?.name}</strong><span className="lw-champion-score">{winner?.points} pts</span></div><Standings game={game}/>{isHost&&!display?<div className="lw-actions"><button className="lw-go" disabled={!connected||!canRematch} onClick={()=>onAction("prepare_game_rematch")}>Play Last Word Again</button>{!canRematch&&<p className="lw-warning">Last Word needs 3–6 connected players for a rematch. Choose another game.</p>}<button className="secondary" onClick={()=>onAction("last_word_finish")}>Choose Another Game →</button></div>:<p className="lw-note">Waiting for host to choose what's next…</p>}</section>;
  return <section className={`lw-screen lw-gameplay ${myTurn?"lw-my-turn":""} ${editing?"lw-editing":""} ${spectating?"lw-spectator":""}`} data-character={playerCharacter}>
    {!connected&&!display&&<div className="lw-connection" role="status">⌁ Reconnecting… Controls temporarily disabled.</div>}
    {stage==="level"&&<div className="lw-level-flash" aria-live="polite">LEVEL UP! <strong>Stage {game.level+1} · {game.levelName}</strong></div>}
    {stage==="impact"&&<span className="visually-hidden" role="status">BOOM! Bomb exploded.</span>}
    {nextUp&&<div className="lw-next-up" aria-live="polite">Your turn next!</div>}
    <header className="lw-game-heading"><div><span className="lw-kicker">LAST WORD</span><h2>{myTurn?"Your Turn!":spectating?"Spectating":game.stage==="handoff"?"Pass it on!":"Roundtable"}</h2></div>{myTurn&&<Clock game={game} now={now}/>}</header>
    {myTurn?<>
      <div className="lw-big-table"><Roundtable game={game} room={room} now={now}/></div>
      <div className="lw-small-strip"><Roundtable game={game} room={room} now={now} compact/></div>
      <div className="lw-entry"><span className="lw-kicker">STAGE {game.level+1} · {game.levelName.toUpperCase()}</span><div className="lw-prompt">{promptInfo}</div><p>{game.rule}</p><div className="lw-entry-hearts"><Hearts units={self?.hearts??0}/></div>
        <form onSubmit={event=>{event.preventDefault();submit();}} autoComplete="off"><label htmlFor="lw-input">Your word</label><input ref={inputRef} id="lw-input" type="text" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Tap to type your word…" value={draft} maxLength={16} disabled={!canUse||Boolean(isStale)} onFocus={()=>setEditing(true)} onBlur={()=>window.setTimeout(endTyping,50)} onChange={event=>changeDraft(event.target.value)} className={currentInvalid?"lw-input-error":""}/>{inputError&&<span className="lw-validation-error" role="alert">{inputError}</span>}{validatingText&&<span className="lw-checking" role="status">{validatingText}</span>}
          <div className="lw-actions"><button className="lw-go" type="submit" disabled={!canUse||!draft.trim()||Boolean(isStale)}>Submit →</button></div>
        </form>
      </div>
    </>:<><Roundtable game={game} room={room} now={now}/><div className="lw-watch"><span>{spectating?"Live spectator mode":game.stage==="handoff"?"Bomb Buddy is hopping…":game.stage==="pop"?"Take your places!":game.stage==="impact"?"What a blast!":game.stage==="respawn"?"New Bomb Buddy incoming…":"Watch the bomb!"}</span><div className="lw-player-strip">{game.participants.filter(p=>p.hearts>0).length} survivors · {game.participants.find(p=>p.id===activeKey)?.name??"Next player"}</div></div></>}
    {game.paused&&<div className="lw-pause">Game paused while all survivors are offline.</div>}
  </section>;
}
