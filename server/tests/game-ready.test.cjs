const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/games/gameReady.ts'),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const updates=[];
const module_={exports:{}};
new Function('require','module','exports',js)(name=>{
  if(name==='../rooms/store') return {updateRoom:(_io,room)=>updates.push({...room.gameReady})};
  return require(name);
},module_,module_.exports);
const {inPlayerRange,allConnectedReady,resetReady,setGameReady}=module_.exports;
function room(game,amount){return {phase:'instructions',selectedGame:game,gameReady:{},lastWordReady:{},players:Array.from({length:amount},(_,i)=>({id:'p'+i,socketId:'s'+i}))};}
test('shared Ready gating applies to Last Word and Hot Take',()=>{
 for(const [game,max] of [['last_word',6],['funny_answers',10]]) {
  const r=room(game,3); assert.equal(inPlayerRange(r),true);
  assert.equal(allConnectedReady(r),false);
  for(const player of r.players) assert.equal(setGameReady({},r,player.id,true),null);
  assert.equal(allConnectedReady(r),true);
  assert.equal(inPlayerRange(room(game,2)),false);
  assert.equal(inPlayerRange(room(game,max+1)),false);
 }
});
test('ready states persist across temporary disconnects, but reset for replay',()=>{
 const r=room('last_word',3);
 for(const p of r.players)setGameReady({},r,p.id,true);
 r.players[1].socketId=null;
 assert.equal(allConnectedReady(r),true);
 resetReady(r);
 assert.deepEqual(r.gameReady,{});assert.deepEqual(r.lastWordReady,{});
 assert.equal(allConnectedReady(r),false);
});
test('Hot Take preserves its existing connected-player minimum',()=>{
 const r=room('funny_answers',3);
 r.players[2].socketId=null;
 assert.equal(inPlayerRange(r),false);
});
test('a player cannot mark Ready when their game is not selected',()=>{
 const r=room('last_word',3);r.phase='selection';
 assert.match(setGameReady({},r,'p0',true),/Ready screen/);
 assert.deepEqual(r.gameReady,{});
});
