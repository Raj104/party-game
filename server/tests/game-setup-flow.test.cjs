const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
function loadFile(name,mocks) {
 const src=fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',js)(name=>name in mocks?mocks[name]:require(name),mod,mod.exports);
 return mod.exports;
}
function harness(game,stage='finished') {
 const io={};const code='party'; const player={id:'a',socketId:'s1'};
 const room={code,players:[player,{id:'b',socketId:'s2'},{id:'c',socketId:'s3'}],phase:'playing',selectedGame:game, selectedRounds:3,
  gameReady:{a:true,b:true,c:true},lastWordReady:{a:true,b:true,c:true},lastWord:game==='last_word'?{stage}:null,funny:game==='funny_answers'?{stage}:null};
 const handlers={}, rooms=new Map([[code,room]]), broadcasts=[];
 const mockStore={rooms,updateRoom(_io,r){broadcasts.push({phase:r.phase,gameReady:{...r.gameReady}})}};
 const ready=loadFile('games/gameReady.ts',{'../rooms/store':mockStore});
 const engine={stopLastWord(r){r.lastWord=null;}};
 const events=loadFile('sockets/registerGameEvents.ts',{
  '../rooms/store':mockStore,'./registerFunnyEvents':{registerFunnyEvents(){}},'./registerLastWordEvents':{registerLastWordEvents(){}},
  '../games/gameReady':ready,'../games/funnyState':{stopFunnyTimer(){}},'../games/lastWordEngine':engine,
 });
 const socket={id:'s1',data:{roomCode:code,playerId:'a',role:'player'},on(name,fn){handlers[name]=fn}};
 events.registerGameEvents(io,socket);
 function action(name,...args) {let response;handlers[name](...args,r=>response=r);return response;}
 return {room,action,broadcasts};
}
for(const game of ['last_word','funny_answers']) {
 test(`${game} replay returns the SAME room to shared Ready without starting immediately`,()=>{
  const h=harness(game,game==='last_word'?'results':'finished');
  assert.deepEqual(h.action('prepare_game_rematch'),{ok:true});
  assert.equal(h.room.phase,'instructions');
  assert.equal(h.room.selectedGame,game);
  assert.equal(h.room.lastWord,null);assert.equal(h.room.funny,null);
  assert.deepEqual(h.room.gameReady,{});
  assert.deepEqual(h.room.lastWordReady,{});
  assert.equal(h.broadcasts.at(-1).phase,'instructions');
  assert.deepEqual(h.action('game_ready',true),{ok:true});
  assert.equal(h.room.gameReady.a,true);
  assert.equal(h.room.gameReady.b,undefined);
 });
}
test('replay cannot begin during an active game',()=>{
 const h=harness('last_word','turn');
 assert.equal(h.action('prepare_game_rematch').ok,false);
 assert.equal(h.room.phase,'playing');
});
test('non-host cannot initiate a replay',()=>{
 const h=harness('last_word','results');
 h.room.players[0].id='different-host';
 assert.match(h.action('prepare_game_rematch').error,/Only the host/);
 assert.equal(h.room.phase,'playing');
});
