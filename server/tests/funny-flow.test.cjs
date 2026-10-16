// Focused server-engine regression tests. Run with: npm run test:funny
// Uses the TypeScript dev dependency to load source directly; no live sockets needed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const sourceRoot = path.join(__dirname, '..', 'src');

function harness(count = 3) {
  let now = 1000000;
  let nextId = 1;
  const tasks = new Map();
  const clock = {
    get now() { return now; },
    setTimeout(fn, delay) {
      const id = nextId++;
      tasks.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) { tasks.delete(id); },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const next = [...tasks.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        tasks.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = target;
    },
  };
  class FakeDate extends Date { static now() { return now; } }
  const states = [];
  const modules = {};
  function load(relative) {
    if (modules[relative]) return modules[relative];
    const source = fs.readFileSync(path.join(sourceRoot, relative + '.ts'), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    }}).outputText;
    const mod = { exports: {} };
    const localRequire = (name) => {
      if (name === '../rooms/store') return { updateRoom: (_io, room) => {
        states.push({ stage: room.funny?.stage, round: room.funny?.round });
      }};
      if (name.startsWith('.')) {
        const relativePath = path.posix.normalize(path.posix.join(path.posix.dirname(relative), name));
        return load(relativePath);
      }
      return require(name);
    };
    const run = new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'Date', js);
    run(localRequire, mod, mod.exports, clock.setTimeout.bind(clock), clock.clearTimeout.bind(clock), FakeDate);
    modules[relative] = mod.exports;
    return mod.exports;
  }
  const state = load('games/funnyState');
  const engine = load('games/funnyEngine');
  const prompts = load('games/funnyPrompts');
  const room = {
    code: 'test-room', phase: 'selection', selectedGame: 'funny_answers',
    selectedRounds: 3, players: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`, name: `Player ${i + 1}`, character: 'scribble', socketId: `s${i + 1}`,
    })),
    funny: null, lastScoreboard: null,
  };
  const io = {};
  return { room, io, engine, state, prompts, clock, states };
}

function start(h, rounds = 3) {
  h.room.selectedRounds = rounds;
  assert.equal(h.engine.startFunny(h.io, h.room, rounds), null);
  assert.equal(h.room.funny.stage, 'submission');
}
function submit(h, number, value = `answer-${number}`) {
  return h.engine.submitFunnyAnswer(h.io, h.room, `p${number}`, value);
}
function toVoting(h) {
  for (let i = 1; i <= h.room.players.length; i++) {
    assert.equal(submit(h, i), null);
  }
  assert.equal(h.room.funny.stage, 'reveal');
  h.engine.skipFunnyPhase(h.io, h.room);
  assert.equal(h.room.funny.stage, 'review');
  h.clock.advance(5000);
  assert.equal(h.room.funny.stage, 'voting');
}
function castAllVotes(h) {
  const entries = h.room.funny.entries;
  for (const p of h.room.players) {
    const other = entries.find(entry => entry.playerId !== p.id);
    assert.equal(h.engine.submitFunnyVote(h.io, h.room, p.id, other.id), null);
  }
}

test('prompts balance Solo, Duo and Group and rotate participant names', () => {
  const h = harness(5);
  const players = h.room.players;
  for (const rounds of [3, 5]) {
    const list = h.prompts.createFunnyPrompts(players, rounds);
    assert.equal(list.length, rounds);
    const totals = { solo: 0, duo: 0, group: 0 };
    for (const prompt of list) {
      totals[prompt.category]++;
      if (prompt.category === 'solo') {
        assert.equal(prompt.featuredPlayerIds.length, 1);
        assert.match(prompt.text, /Player \d/);
      } else if (prompt.category === 'duo') {
        assert.equal(prompt.featuredPlayerIds.length, 2);
        assert.equal(new Set(prompt.featuredPlayerIds).size, 2);
        assert.equal((prompt.text.match(/Player \d/g) ?? []).length, 2);
      } else {
        assert.equal(prompt.featuredPlayerIds.length, players.length);
        assert.match(prompt.text, /everyone here/);
        assert.doesNotMatch(prompt.text, /Player \d/);
      }
    }
    assert.deepEqual(Object.values(totals).sort(), rounds === 3 ? [1, 1, 1] : [1, 2, 2]);
  }
});

test('last round always displays vote breakdown for 20 seconds before final standings', () => {
  const h = harness(); start(h, 3);
  for (let round = 1; round <= 3; round++) {
    toVoting(h);
    const entries = h.room.funny.entries;
    // Author cannot vote for their own answer.
    assert.match(h.engine.submitFunnyVote(h.io, h.room, entries[0].playerId, entries[0].id), /own answer/);
    castAllVotes(h);
    assert.equal(h.room.funny.stage, 'results');
    assert.equal(h.room.funny.round, round);
    assert.equal(h.room.funny.scores.p1 + h.room.funny.scores.p2 + h.room.funny.scores.p3, round * 3);
    const visible = h.state.publicFunny(h.room);
    assert.ok(visible.answers.every(answer => answer.author && answer.voters && answer.votes >= 0));
    h.clock.advance(19999);
    assert.equal(h.room.funny.stage, 'results');
    h.clock.advance(1);
    assert.equal(h.room.funny.stage, round === 3 ? 'finished' : 'submission');
  }
  assert.equal(h.engine.closeFunnyGame(h.io, h.room), null);
  assert.equal(h.room.phase, 'selection');
  assert.equal(h.room.lastScoreboard.scores.reduce((s, p) => s + p.points, 0), 9);
});

test('host Next from final round results opens standings without adding a round', () => {
  const h = harness(); start(h);
  h.room.funny.round = 3; // Set up final round via state to test host skip.
  toVoting(h);
  castAllVotes(h);
  assert.equal(h.room.funny.stage, 'results');
  const points = Object.values(h.room.funny.scores).reduce((a, b) => a + b, 0);
  assert.equal(h.engine.skipFunnyPhase(h.io, h.room), null);
  assert.equal(h.room.funny.stage, 'finished');
  h.clock.advance(50000);
  assert.equal(h.room.funny.stage, 'finished');
  assert.equal(Object.values(h.room.funny.scores).reduce((a, b) => a + b, 0), points);
});

test('pause and resume preserve remaining time on final-round results', () => {
  const h = harness(); start(h);
  h.room.funny.round = 3;
  toVoting(h); castAllVotes(h);
  h.clock.advance(4000);
  assert.equal(h.engine.controlFunnyTimer(h.io, h.room, 'pause'), null);
  assert.equal(h.room.funny.paused, true);
  h.clock.advance(60000);
  assert.equal(h.room.funny.stage, 'results');
  assert.equal(h.engine.controlFunnyTimer(h.io, h.room, 'resume'), null);
  h.clock.advance(15999);
  assert.equal(h.room.funny.stage, 'results');
  h.clock.advance(1);
  assert.equal(h.room.funny.stage, 'finished');
});

test('a one-answer final round produces results and no fabricated points', () => {
  const h = harness(); start(h);
  h.room.funny.round = 3;
  assert.equal(submit(h, 1), null);
  h.engine.skipFunnyPhase(h.io, h.room); // Close submissions early.
  assert.equal(h.room.funny.stage, 'results');
  assert.equal(h.room.funny.entries.length, 1);
  assert.deepEqual(Object.values(h.room.funny.scores), [0, 0, 0]);
  h.clock.advance(20000);
  assert.equal(h.room.funny.stage, 'finished');
});

test('duplicate votes cannot double score and anonymous voting stays private', () => {
  const h = harness(); start(h); toVoting(h);
  const entries = h.room.funny.entries;
  assert.ok(h.state.publicFunny(h.room).answers.every(entry => entry.author === undefined && entry.voters === undefined));
  for (const p of h.room.players.slice(0, -1)) {
    const other = entries.find(entry => entry.playerId !== p.id);
    assert.equal(h.engine.submitFunnyVote(h.io, h.room, p.id, other.id), null);
    assert.match(h.engine.submitFunnyVote(h.io, h.room, p.id, other.id), /already been submitted/);
  }
  assert.deepEqual(Object.values(h.room.funny.scores), [0, 0, 0]);
  const last = h.room.players.at(-1);
  assert.equal(h.engine.submitFunnyVote(h.io, h.room, last.id, entries.find(entry => entry.playerId !== last.id).id), null);
  assert.equal(Object.values(h.room.funny.scores).reduce((a, b) => a + b, 0), 3);
});

test('reveal gives every card, including the last, a full three-second interval', () => {
  const h = harness(); start(h);
  for (let i = 1; i <= 3; i++) submit(h, i);
  assert.equal(h.room.funny.stage, 'reveal');
  assert.equal(h.room.funny.revealCount, 0);
  for (let count = 1; count <= 3; count++) {
    h.clock.advance(2999);
    assert.equal(h.room.funny.revealCount, count - 1);
    h.clock.advance(1);
    assert.equal(h.room.funny.revealCount, count);
    assert.equal(h.room.funny.stage, 'reveal');
  }
  h.clock.advance(2999);
  assert.equal(h.room.funny.stage, 'reveal');
  h.clock.advance(1);
  assert.equal(h.room.funny.stage, 'review');
  h.clock.advance(5000);
  assert.equal(h.room.funny.stage, 'voting');
});

test('ten players can complete five rounds with all votes counted once', () => {
  const h = harness(10); start(h, 5);
  for (let round = 1; round <= 5; round++) {
    toVoting(h);
    castAllVotes(h);
    assert.equal(h.room.funny.stage, 'results');
    assert.equal(h.room.funny.round, round);
    assert.equal(Object.values(h.room.funny.scores).reduce((a, b) => a + b, 0), round * 10);
    h.engine.nextFunnyRound(h.io, h.room);
  }
  assert.equal(h.room.funny.stage, 'finished');
  assert.equal(h.room.funny.round, 5);
});

test('offline players do not block advance or create phantom votes', () => {
  const h = harness(); start(h);
  submit(h, 1);
  submit(h, 2);
  h.room.players[2].socketId = null;
  h.engine.onFunnyRosterChange(h.io, h.room);
  assert.equal(h.room.funny.stage, 'reveal');
  h.engine.skipFunnyPhase(h.io, h.room);
  h.clock.advance(5000);
  const entries = h.room.funny.entries;
  assert.equal(h.engine.submitFunnyVote(h.io, h.room, 'p1', entries.find(a => a.playerId === 'p2').id), null);
  assert.equal(h.engine.submitFunnyVote(h.io, h.room, 'p2', entries.find(a => a.playerId === 'p1').id), null);
  assert.equal(h.room.funny.stage, 'results');
  assert.equal(Object.values(h.room.funny.scores).reduce((a, b) => a + b, 0), 2);
  assert.equal(Object.keys(h.room.funny.votes).length, 2);
});

test('kicked players are omitted from live and completed scoreboards without changing scores for remaining players', () => {
  const h = harness(4);
  start(h);
  h.room.funny.scores.p1 = 2;
  h.room.funny.scores.p2 = 4;
  h.room.funny.scores.p3 = 1;
  h.room.funny.scores.p4 = 7;
  // Simulate a host removing player four, not a temporary disconnection.
  h.room.players = h.room.players.filter(p => p.id !== 'p4');
  assert.deepEqual(h.state.publicFunny(h.room).scores.map(p => p.id), ['p1', 'p2', 'p3']);
  assert.equal(h.room.funny.scores.p2, 4);
  h.room.funny.stage = 'finished';
  assert.equal(h.engine.closeFunnyGame(h.io, h.room), null);
  assert.deepEqual(h.room.lastScoreboard.scores.map(p => p.id), ['p1', 'p2', 'p3']);
  assert.deepEqual(h.room.lastScoreboard.scores.map(p => p.points), [2, 4, 1]);
});
