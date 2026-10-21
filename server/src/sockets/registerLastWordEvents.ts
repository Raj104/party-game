import type { Server, Socket } from "socket.io";
import { rooms } from "../rooms/store";
import type { Room } from "../types";
import { startLastWord,setLastWordReady,submitLastWord,skipLastWordAwards,finishLastWord } from "../games/lastWordEngine";

type Callback=(result:{ok:boolean;error?:string})=>void;
function authorized(socket:Socket,callback:unknown,hostOnly:boolean,task:(room:Room,id:string)=>string|null) {
  if(typeof callback!=="function") return;
  const room=rooms.get(socket.data.roomCode as string);
  const id=socket.data.playerId as string | undefined;
  if(!room||socket.data.role!=="player"||!id||room.players.find(p=>p.id===id)?.socketId!==socket.id) return (callback as Callback)({ok:false,error:"Join the room first."});
  if(hostOnly&&room.players[0]?.id!==id) return (callback as Callback)({ok:false,error:"Only the host can do that."});
  const error=task(room,id);
  (callback as Callback)(error?{ok:false,error}:{ok:true});
}
export function registerLastWordEvents(io:Server,socket:Socket) {
  socket.on("last_word_ready",(ready:unknown,callback:unknown)=>authorized(socket,callback,false,(room,id)=>setLastWordReady(io,room,id,ready)));
  socket.on("last_word_start",(callback:unknown)=>authorized(socket,callback,true,room=>startLastWord(io,room)));
  // All replays use prepare_game_rematch -> shared Ready; no instant-start bypass.
  socket.on("last_word_submit",(payload:unknown,callback:unknown)=>authorized(socket,callback,false,(room,id)=>{
    if(!payload||typeof payload!=="object") return "Enter a word.";
    const p=payload as {word?:unknown;turnNumber?:unknown};
    return submitLastWord(io,room,id,p.word,p.turnNumber);
  }));
  socket.on("last_word_skip_awards",(callback:unknown)=>authorized(socket,callback,true,room=>skipLastWordAwards(io,room)));
  socket.on("last_word_finish",(callback:unknown)=>authorized(socket,callback,true,room=>finishLastWord(io,room)));
}
