// Run with: node --test tests/room-lifecycle.test.cjs
// Exercises the real TypeScript room store without opening network sockets.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../src/rooms/store.ts'), 'utf8');
const configSource = fs.readFileSync(path.join(__dirname,'../src/config.ts'), 'utf8');
const transpile = code => ts.transpileModule(code, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const cfg = {exports:{}};
new Function('module','exports','process',transpile(configSource))(cfg,cfg.exports,{env:{}});

function setup() {
  const state = { now:0, timers:new Map(), next:1, events:[], stops:0 };
  const set = (fn, ms) => { const id=state.next++; state.timers.set(id,{fn,at:state.now+ms}); return id; };
  const clear = (id) => state.timers.delete(id);
  const mockRequire = id => {
    if(id==='../config') return cfg.exports;
    if(id==='../games/funnyState') return {privateFunny:()=>null, publicFunny:()=>null, stopFunnyTimer:()=>{state.stops++}};
    if(id==='../games/funnyEngine') return {onFunnyHostDisconnected:()=>{}, onFunnyRosterChange:()=>{}};
    if(id==='./roomCodes') return {generateFriendlyCode:()=> 'happy-otter'};
    return require(id);
  };
  const mod = {exports:{}};
  new Function('require','module','exports','setTimeout','clearTimeout',transpile(source))(mockRequire,mod,mod.exports,set,clear);
  const store=mod.exports;
  const io={to:code=>({emit:(event,...args)=>state.events.push({code,event,args})}), sockets:{sockets:new Map()}};
  const room={code:'happy-otter',players:[
    {id:'a',name:'Alice',socketId:'s1',token:'t1'},
    {id:'b',name:'Bob',socketId:null,token:'t2'},
  ],displays:new Set(['tv1']),funny:{round:1,stage:'results'},lastScoreboard:{gameId:'funny_answers',scores:[]},phase:'playing'};
  const display={left:[], data:{roomCode:room.code,role:'display'},leave:code=>display.left.push(code)};
  io.sockets.sockets.set('tv1',display);
  store.rooms.set(room.code,room);
  return {state,store,io,room,display, advance(ms) {state.now+=ms;for(const [id,t] of [...state.timers]) if(t.at<=state.now){state.timers.delete(id);t.fn()}}};
}

test('last intentional Leave room closes a party despite disconnected ghosts; TV notified and game timer cancelled',()=>{
  const h=setup();
  const socket={id:'s1',data:{role:'player',roomCode:h.room.code,playerId:'a'},leave:()=>{}};
  h.store.leaveRoom(h.io,socket,false);
  assert.equal(h.store.rooms.has(h.room.code),false);
  assert.equal(h.state.stops,1);
  assert.equal(h.room.displays.size,0);
  assert.equal(h.display.data.roomCode,undefined);
  assert.ok(h.state.events.some(e=>e.event==='room_closed'));
});

test('an accidental disconnect remains recoverable for exactly the short grace window',()=>{
  const h=setup();
  const socket={id:'s1',data:{role:'player',roomCode:h.room.code,playerId:'a'},leave:()=>{}};
  h.store.leaveRoom(h.io,socket,true);
  assert.equal(h.store.rooms.has(h.room.code),true);
  assert.equal(h.room.players[0].socketId,null);
  assert.equal(h.state.events.some(e=>e.event==='room_closed'),false);
  h.advance(cfg.exports.EMPTY_ROOM_IDLE_MS-1);
  assert.equal(h.store.rooms.has(h.room.code),true);
  h.advance(1);
  assert.equal(h.store.rooms.has(h.room.code),false);
  assert.equal(h.state.stops,1);
  assert.ok(h.state.events.some(e=>e.event==='room_closed'));
});

test('resuming before grace cancels pending deletion',()=>{
  const h=setup();
  h.store.leaveRoom(h.io,{id:'s1',data:{role:'player',roomCode:h.room.code,playerId:'a'},leave:()=>{}},true);
  h.room.players[0].socketId='s2';
  h.store.refreshRoomIdleTimer(h.io,h.room);
  h.advance(cfg.exports.EMPTY_ROOM_IDLE_MS+100);
  assert.equal(h.store.rooms.has(h.room.code),true);
  h.store.rooms.delete(h.room.code);
});

test('the room remains while another connected player is still present',()=>{
  const h=setup();
  h.room.players[1].socketId='s2';
  h.store.leaveRoom(h.io,{id:'s1',data:{role:'player',roomCode:h.room.code,playerId:'a'},leave:()=>{}},false);
  assert.equal(h.store.rooms.has(h.room.code),true);
  assert.deepEqual(h.room.players.map(p=>p.id),['b']);
  assert.ok(!h.state.events.some(e=>e.event==='room_closed'));
  h.store.rooms.delete(h.room.code);
});

test('leaving or kicking a player removes them from the saved scoreboard, not the other players',()=>{
  const h=setup();
  h.room.players[1].socketId='s2';
  h.room.lastScoreboard.scores=[
    {id:'a',name:'Alice',points:4,character:'blob'},
    {id:'b',name:'Bob',points:8,character:'bolt'},
  ];
  h.store.removePlayer(h.io,h.room,'b');
  assert.deepEqual(h.room.players.map(p=>p.id),['a']);
  assert.deepEqual(h.room.lastScoreboard.scores.map(p=>p.id),['a']);
  const lastBroadcast = h.state.events.filter(e=>e.event==='room_updated').at(-1);
  assert.deepEqual(lastBroadcast.args[0].lastScoreboard.scores.map(p=>p.id),['a']);
  h.store.rooms.delete(h.room.code);
});
