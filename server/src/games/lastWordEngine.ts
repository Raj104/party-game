import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "socket.io";
import type { Room, LastWordState, LastWordParticipant, LastWordAward } from "../types";
import { updateRoom } from "../rooms/store";
import { LAST_WORD_DICTIONARY } from "./lastWordDictionary";

export const LAST_WORD_MIN = 3;
export const LAST_WORD_MAX = 6;
const COUNTDOWN_MS = 3_000;
const POP_MS = 550;
const HOP_MS = 650;
const DEATH_MS = 2_300;
const BOOM_MS = 1_400;
const RESPAWN_MS = 700; // New Bomb Buddy appears at roundtable center after BOOM.
const AWARD_MS = 4_800;
const CHAMPION_MS = 6_500;
const PASSES_PER_LEVEL = 5; // Valid passes counted since the last stage advance.
// All prompts are three letters. Each stage increases rule pressure or reduces
// turn time; the repeated Together and Edge stages intentionally share rules.
const STAGES = [
  { name: "Scramble", rule: "Letters in any order", matchLevel: 0, durationMs: 15_000 },
  { name: "In Order", rule: "Letters in this order", matchLevel: 1, durationMs: 15_000 },
  { name: "Together", rule: "Letters must appear together", matchLevel: 2, durationMs: 13_000 },
  { name: "Together", rule: "Letters must appear together", matchLevel: 2, durationMs: 13_000 },
  { name: "Edge of Disaster", rule: "Word must start or end with these letters, in order", matchLevel: 3, durationMs: 12_000 },
  { name: "Edge of Disaster", rule: "Word must start or end with these letters, in order", matchLevel: 3, durationMs: 10_000 },
] as const;
const MAX_LEVEL = STAGES.length - 1;

// Extra words are intentionally edited in a plain text file, one per line.
// Read once on server startup; no external service or network dependency.
const extraWords = readFileSync(join(__dirname, "lastWordExtraWords.txt"), "utf8")
  .split(/\r?\n/)
  .map(line => line.trim().toLowerCase())
  .filter(word => /^[a-z]{4,16}$/.test(word));
const dictionarySet = new Set([...LAST_WORD_DICTIONARY, ...extraWords]);
// Every prompt has exactly three letters. Choose common word beginnings/endings
// to keep prompts recognizable, including at the strictest difficulty.
const edgeFrequency = new Map<string, number>();
// Prompt choices come from the original curated base dictionary. The custom
// bulk list adds accepted answers, without flooding prompts with rare jargon.
for (const word of LAST_WORD_DICTIONARY) {
  const candidates = new Set([word.slice(0, 3), word.slice(-3)]);
  for (const pattern of candidates) {
    if (pattern.length === 3) edgeFrequency.set(pattern, (edgeFrequency.get(pattern) ?? 0) + 1);
  }
}
const PATTERNS = [...edgeFrequency]
  .filter(([, count]) => count >= 20)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 140)
  .map(([pattern]) => pattern.toUpperCase());
const dictionary = [...dictionarySet];
console.log(`[Last Word] Loaded ${dictionary.length} unique words (${extraWords.length} extra-list entries).`);
const indexed = [0, 1, 2, 3].map(level => PATTERNS.map(pattern => ({ pattern, answers: dictionary.filter(word => matches(word, pattern, level)) })));

function matches(word: string, pattern: string, level: number) {
  pattern=pattern.toLowerCase();
  if (level === 0) {
    let available = word;
    for (const char of pattern) {
      const index = available.indexOf(char);
      if (index < 0) return false;
      available = available.slice(0, index) + available.slice(index + 1);
    }
    return true;
  }
  if (level === 1) { let pos = 0; for (const char of word) if (char === pattern[pos]) pos++; return pos === pattern.length; }
  if (level === 2) return word.includes(pattern);
  return word.startsWith(pattern) || word.endsWith(pattern);
}
function shuffle<T>(input: T[]): T[] {
  const output = [...input];
  for (let i=output.length-1;i>0;i--) { const j=randomInt(i+1); [output[i],output[j]]=[output[j],output[i]]; }
  return output;
}
function alive(game: LastWordState) { return game.participants.filter(p=>p.hearts>0); }
function connected(room: Room, id: string) { return Boolean(room.players.find(p=>p.id===id)?.socketId); }
function remaining(game: LastWordState) { return game.participants.filter(p=>p.hearts>0).length; }
function advanceDifficulty(game: LastWordState) {
  if (game.level >= MAX_LEVEL) return false;
  game.level++;
  game.levelName = STAGES[game.level].name;
  game.rule = STAGES[game.level].rule;
  game.validStreak = 0;
  return true;
}
function emit(io: Server, room: Room) { updateRoom(io,room); }
function stop(game: LastWordState) {
  if (game.timer) clearTimeout(game.timer);
  game.timer=undefined;
}
function stage(io: Server, room: Room, phase: LastWordState["stage"], ms: number, next: () => void) {
  const game=room.lastWord;
  if (!game) return;
  stop(game);
  game.stage=phase;
  game.stageStartedAt=Date.now();
  game.stageDeadline=ms>0 ? Date.now()+ms : null;
  if (ms>0) game.timer=setTimeout(() => {game.timer=undefined; if(room.lastWord===game && game.stage===phase) next();},ms);
  emit(io,room);
}
function choosePrompt(game: LastWordState) {
  // Preserve a history independent of the used-word pool, so repeating a
  // challenge is much rarer than repeating an answer.
  const candidates = indexed[STAGES[game.level].matchLevel];
  // Only examine words already USED this match, not the entire 100k-word
  // dictionary on each turn. Answer lists are cached once at startup.
  const matchLevel=STAGES[game.level].matchLevel;
  const eligible = candidates.filter(item => item.answers.length >= 10 &&
    item.answers.length - game.usedWords.filter(word => matches(word,item.pattern,matchLevel)).length >= 10);
  let available = eligible.filter(item => !game.promptHistory.includes(item.pattern));
  if (!available.length && eligible.length) {
    game.promptHistory = [];
    available = eligible;
  }
  if (!available.length) {
    // Only clear the used-word pool if all eligible prompts have run out.
    game.usedWords = [];
    available = candidates.filter(item => item.answers.length >= 10);
    game.promptHistory = [];
  }
  if (!available.length) throw new Error(`No usable three-letter prompts for level ${game.level}`);
  const choice = available[randomInt(available.length)];
  game.prompt = choice.pattern;
  game.promptHistory.push(choice.pattern);
  game.rule = STAGES[game.level].rule;
  game.levelName = STAGES[game.level].name;
}
function activePlayer(game:LastWordState) {return game.order[game.turnIndex] ?? null;}
function startTurn(io: Server, room:Room) {
  const game=room.lastWord;
  if (!game) return;
  if (remaining(game)<=1) return finish(io,room);
  const next=activePlayer(game);
  if (!next || !game.participants.some(p=>p.id===next&&p.hearts>0)) return advance(io,room);
  choosePrompt(game);
  game.turnNumber++;
  game.turnDurationMs=STAGES[game.level].durationMs;
  game.turnDeadline=Date.now()+game.turnDurationMs;
  game.pendingPlayerId=null;
  game.impact=null;
  game.impactPlayerId=null;
  stage(io,room,"turn",game.turnDurationMs,()=>applyTimeout(io,room,next));
  syncPause(io,room);
}
function advance(io: Server, room:Room, fromCenter=false) {
  const game=room.lastWord;
  if (!game) return;
  if (remaining(game)<=1) return finish(io,room);
  const previous=game.turnIndex;
  game.handoffFromPlayerId=fromCenter?null:activePlayer(game);
  for(let n=0;n<game.order.length;n++) {
    game.turnIndex=(game.turnIndex+1)%game.order.length;
    if(game.participants.some(p=>p.id===activePlayer(game)&&p.hearts>0)) break;
  }
  if(game.turnIndex===previous && remaining(game)>1) return;
  game.pendingPlayerId=activePlayer(game);
  game.prompt="";
  game.turnDeadline=null;
  stage(io,room,"handoff",HOP_MS,()=>startTurn(io,room));
}
function surviveOrEliminate(game:LastWordState, playerId:string, halfHearts:number) {
  const player=game.participants.find(p=>p.id===playerId);
  if(!player||player.hearts<=0) return false;
  player.hearts=Math.max(0,player.hearts-halfHearts);
  if(player.hearts>0) return false;
  player.placement=remaining(game)+1;
  game.usedWords=[];
  for(const survivor of alive(game)) {survivor.points++;}
  return true;
}
function afterImpact(io:Server, room:Room, eliminated:boolean) {
  const game=room.lastWord;
  if(!game) return;
  if(remaining(game)<=1) { stage(io,room,"finalPoint",750,()=>finish(io,room)); return; }
  // Explosion ends the old bomb's life. A NEW bomb materializes at the
  // table center before hopping to the next survivor. Valid passes never
  // use this path: their bomb travels directly token-to-token.
  const respawn=()=>stage(io,room,"respawn",RESPAWN_MS,()=>advance(io,room,true));
  if(eliminated) {
    const changed=advanceDifficulty(game);
    stage(io,room,"rearrange",750,()=>{
      if(changed) stage(io,room,"level",1_800,respawn);
      else respawn();
    });
  } else respawn();
}
function applyTimeout(io:Server, room:Room, playerId:string) {
  const game=room.lastWord;
  if (!game || game.stage!=="turn" || activePlayer(game)!==playerId) return;
  const player=game.participants.find(p=>p.id===playerId);
  if (!player) return;
  player.timeouts++;
  player.explosions++;
  player.holdMs+=Math.max(0,game.turnDurationMs-Math.max(0,(game.turnDeadline??Date.now())-Date.now()));
  const eliminated=surviveOrEliminate(game,playerId,2);
  game.impactPlayerId=playerId;
  game.impact=eliminated?"eliminated":"explosion";
  game.turnDeadline=null;
  // Each player's bomb explodes on timeout; no hidden explosion clock.
  stage(io,room,"impact",eliminated?DEATH_MS:BOOM_MS,()=>afterImpact(io,room,eliminated));
}
function orderedAwards(game:LastWordState):LastWordAward[] {
  const roster=game.participants;
  const rank=(a:LastWordParticipant,b:LastWordParticipant)=> (a.placement??99)-(b.placement??99);
  function winner(key:LastWordAward["key"], sort:(a:LastWordParticipant,b:LastWordParticipant)=>number,stat:(p:LastWordParticipant)=>string):LastWordAward {
    const p=[...roster].sort((a,b)=>sort(a,b)||rank(a,b)||a.id.localeCompare(b.id))[0];
    return {key,playerId:p.id,stat:stat(p)};
  }
  return [
    winner("Longest Word",(a,b)=>b.longestWord.length-a.longestWord.length||a.longestWordMs-b.longestWordMs,p=>`${p.longestWord||"—"} · ${p.longestWord.length} letters`),
    winner("Fastest Word",(a,b)=>a.fastestWordMs-b.fastestWordMs||b.fastestWord.length-a.fastestWord.length,p=>p.fastestWord?`${(p.fastestWordMs/1000).toFixed(2)}s · ${p.fastestWord}`:"No valid words"),
    winner("Closest Call",(a,b)=>a.closestCallRemainingMs-b.closestCallRemainingMs||b.closestCallWord.length-a.closestCallWord.length,
      p=>p.closestCallWord?`${(p.closestCallRemainingMs/1000).toFixed(2)}s left · ${p.closestCallWord}`:"No valid words"),
  ];
}
function finish(io:Server,room:Room) {
  const game=room.lastWord;
  if(!game||game.stage==="champion"||game.stage==="awards"||game.stage==="results") return;
  const winner=alive(game)[0];
  if(!winner) return;
  winner.placement=1;
  game.awards=orderedAwards(game);
  for(const award of game.awards) {
    const p=game.participants.find(p=>p.id===award.playerId);
    if(p)p.points++;
  }
  // Final champion = highest TOTAL points (survival + three bonus awards).
  // Ties favor better survival placement, then more valid submissions.
  const scored = [...game.participants].sort((a, b) =>
    b.points - a.points || (a.placement ?? 99) - (b.placement ?? 99) ||
    b.validPasses - a.validPasses || a.id.localeCompare(b.id));
  game.winnerId=scored[0].id;
  game.turnDeadline=null;
  game.prompt="";
  // Reveal the three awards first, then show the final total-points champion.
  showAward(io,room,0);
}
function showAward(io:Server,room:Room,index:number) {
  const game=room.lastWord;
  if(!game) return;
  game.awardIndex=index;
  if(index>=game.awards.length) { stage(io,room,"champion",CHAMPION_MS,()=>stage(io,room,"results",0,()=>{})); return; }
  stage(io,room,"awards",AWARD_MS,()=>showAward(io,room,index+1));
}
export function startLastWord(io:Server,room:Room, rematch=false):string|null {
  if(rematch ? !(room.lastWord?.stage==="results") : !(room.phase==="instructions"&&room.selectedGame==="last_word")) return "Last Word is not ready to start.";
  const included=room.players;
  if(included.length<LAST_WORD_MIN||included.length>LAST_WORD_MAX) return "Last Word needs 3–6 players in the room.";
  if(!rematch && room.players.some(p=>p.socketId!==null&&!(room.gameReady ?? room.lastWordReady)[p.id])) return "All connected players must be Ready.";
  const order=[...shuffle(included.filter(p=>p.socketId!==null)),...shuffle(included.filter(p=>p.socketId===null))].map(p=>p.id);
  const participants:LastWordParticipant[]=included.map(p=>({id:p.id,name:p.name,character:p.character,hearts:6,points:0,placement:null,validPasses:0,timeouts:0,explosions:0,holdMs:0,longestWord:"",longestWordMs:Infinity,fastestWord:"",fastestWordMs:Infinity,closestCallWord:"",closestCallRemainingMs:Infinity}));
  if(room.lastWord) stop(room.lastWord);
  room.lastWord={participants,order,turnIndex:0,turnNumber:0,stage:"countdown",stageStartedAt:Date.now(),stageDeadline:null,turnDeadline:null,prompt:"",rule: STAGES[0].rule,levelName:STAGES[0].name,level:0,turnDurationMs:STAGES[0].durationMs,usedWords:[],promptHistory:[],validStreak:0,pendingPlayerId:null,handoffFromPlayerId:null,impactPlayerId:null,impact:null,awardIndex:0,awards:[],winnerId:null,paused:false,pausedRemaining:0};
  room.phase="playing";
  room.selectedGame="last_word";
  room.lastScoreboard=null;
  stage(io,room,"countdown",COUNTDOWN_MS,()=>{
    const game=room.lastWord;
    if(!game) return;
    game.order=[...game.order.filter(id=>connected(room,id)),...game.order.filter(id=>!connected(room,id))];
    game.turnIndex=0;
    stage(io,room,"pop",POP_MS,()=>{game.pendingPlayerId=activePlayer(game);stage(io,room,"handoff",HOP_MS,()=>{
      startTurn(io,room);
    });});
  });
  return null;
}
export function setLastWordReady(io:Server,room:Room,id:string,ready:unknown):string|null {
  if(room.phase!=="instructions"||room.selectedGame!=="last_word") return "Not on Last Word instructions.";
  if(typeof ready!=="boolean") return "Invalid Ready status.";
  room.lastWordReady[id]=ready;
  (room.gameReady ??= {})[id]=ready;
  emit(io,room);
  return null;
}
export function submitLastWord(io:Server,room:Room,id:string,value:unknown,turnNumber:unknown):string|null {
  const game=room.lastWord;
  if(!game||room.phase!=="playing"||game.stage!=="turn"||activePlayer(game)!==id||game.paused) return "It's not your turn.";
  if(turnNumber!==game.turnNumber) return "That submission belongs to an earlier turn.";
  const receivedAt=Date.now();
  if(!game.turnDeadline||receivedAt>=game.turnDeadline) return "Your time is up.";
  if(typeof value!=="string") return "Enter a word.";
  const word=value.trim().toLowerCase();
  if(word.length<4||word.length>16||!/^[a-z]+$/.test(word)) return "Use an English word with 4–16 letters.";
  if(game.usedWords.includes(word)) return "Already used this match.";
  if(!dictionarySet.has(word)) return "Not in the word list.";
  if(!matches(word,game.prompt,STAGES[game.level].matchLevel)) return "Doesn't match the prompt.";
  game.usedWords.push(word);
  const p=game.participants.find(p=>p.id===id)!;
  p.validPasses++;
  if (game.level < MAX_LEVEL) game.validStreak++;
  const leveled = game.validStreak >= PASSES_PER_LEVEL && advanceDifficulty(game);
  const ms=receivedAt-(game.turnDeadline-game.turnDurationMs);
  p.holdMs+=ms;
  if(word.length>p.longestWord.length || word.length===p.longestWord.length&&ms<p.longestWordMs) {p.longestWord=word;p.longestWordMs=ms;}
  if(ms<p.fastestWordMs||ms===p.fastestWordMs&&word.length>p.fastestWord.length) {p.fastestWord=word;p.fastestWordMs=ms;}
  const timeLeftMs=Math.max(0,(game.turnDeadline??receivedAt)-receivedAt);
  if(timeLeftMs<p.closestCallRemainingMs || timeLeftMs===p.closestCallRemainingMs&&word.length>p.closestCallWord.length) {
    p.closestCallWord=word;p.closestCallRemainingMs=timeLeftMs;
  }
  if (leveled) {
    game.prompt="";
    stage(io,room,"level",1_800,()=>advance(io,room));
  } else advance(io,room);
  return null;
}
export function skipLastWordAwards(io:Server,room:Room):string|null {
  if(!room.lastWord||!(room.lastWord.stage==="awards"||room.lastWord.stage==="champion")) return "No awards to skip.";
  stage(io,room,"results",0,()=>{});
  return null;
}
export function finishLastWord(io:Server,room:Room):string|null {
  const game=room.lastWord;
  if(!game||game.stage!=="results") return "Finish the match first.";
  stop(game);
  room.lastScoreboard={gameId:"last_word",scores:game.participants.map(p=>({id:p.id,name:p.name,character:p.character,points:p.points}))};
  room.lastWord=null;
  room.lastWordReady={};
  room.gameReady={};
  room.phase="selection";
  room.selectedGame=null;
  emit(io,room);
  return null;
}
export function stopLastWord(room:Room) {if(room.lastWord) stop(room.lastWord);room.lastWord=null;}
export function syncPause(io:Server,room:Room) {
  const game=room.lastWord;
  if(!game||game.stage!=="turn") return;
  const online=alive(game).some(p=>connected(room,p.id));
  if(!online&&!game.paused) {
    game.paused=true;
    game.pausedRemaining=Math.max(0,(game.turnDeadline??Date.now())-Date.now());
    stop(game);
    emit(io,room);
  } else if(online&&game.paused) {
    game.paused=false;
    game.turnDeadline=Date.now()+game.pausedRemaining;
    game.timer=setTimeout(()=>applyTimeout(io,room,activePlayer(game)),game.pausedRemaining);
    emit(io,room);
  }
}
