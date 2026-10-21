const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..', '..');
const read = relative => readFileSync(join(root, relative), 'utf8');

test('Last Word and Hot Take use one shared Ready lobby and catalog instructions', () => {
  const source = read('client/src/data/games.ts');
  const shared = read('client/src/components/SharedReadyLobby.tsx');
  for (const [file, id] of [
    ['client/src/games/LastWord/LastWordSetup.tsx', 'last_word'],
    ['client/src/games/FunnyAnswers/FunnyReady.tsx', 'funny_answers'],
  ]) {
    const ready = read(file);
    assert.match(ready, /SharedReadyLobby/);
    assert.match(ready, new RegExp('gameId="' + id + '"'));
    assert.doesNotMatch(ready, /<h2>|<ol>|instructions\.map|lw-setup-buddy/);
  }
  assert.match(shared, /findGame\(gameId\)/);
  assert.match(shared, /game\.instructions\.map\(/);
  assert.match(shared, /<SharedReadyPanel/);
  assert.match(shared, /READY_LOBBY_MESSAGE/);
  assert.match(source, /Friendships are tested\. Laughs are guaranteed\./);
  assert.match(source, /Use the given prompt to make a 4\+ letter English word\./);
});

test('Ready lobby message is concise and disconnected fine print is absent', () => {
  const shared = read('client/src/components/SharedReadyLobby.tsx');
  const panel = read('client/src/components/SharedReadyPanel.tsx');
  assert.match(shared, /Read the rules, then tap Ready\./);
  assert.match(shared, /Get ready for the bomb\./);
  assert.match(shared, /Ready for some hot takes\?/);
  assert.doesNotMatch(panel, /Disconnected participants keep their slots|Connected participants must be Ready/);
  assert.match(panel, /!player\.connected\?"Disconnected"/);
  assert.match(panel, /allReady/);
});

test('instruction changes do not misstate champion or award rules', () => {
  const catalog = read('client/src/data/games.ts');
  const engine = read('server/src/games/lastWordEngine.ts');
  assert.match(catalog, /Earn the highest total score, including bonus points, to become champion\./);
  assert.match(engine, /winner\("Closest Call"/);
  assert.doesNotMatch(engine, /winner\("Most Valid Passes"|winner\("Most Bomb Holding Time"/);
  assert.match(engine, /rule: "Letters in any order"/);
  assert.match(engine, /rule: "Letters must appear together"/);
  assert.match(engine, /rule: "Word must start or end with these letters, in order"/);
});

test('three bonus award captions are defined once and shown during ceremony', () => {
  const game = read('client/src/games/LastWord/LastWordGame.tsx');
  assert.match(game, /"Longest Word": "Someone swallowed a dictionary\."/);
  assert.match(game, /"Fastest Word": "Faster than a bad decision\."/);
  assert.match(game, /"Closest Call": "One heartbeat from disaster\."/);
  assert.match(game, /AWARD_CAPTIONS\[currentAward\.key\]/);
  assert.match(game, /lw-award-caption/);
});


test('Last Word uses one supplemental dictionary file with no removed common-words dependency', () => {
  const engine = read('server/src/games/lastWordEngine.ts');
  assert.match(engine, /lastWordExtraWords\.txt/);
  assert.doesNotMatch(engine, /lastWordCommonWords\.txt|\bcommonWords\b/);
  assert.match(engine, /\.\.\.LAST_WORD_DICTIONARY, \.\.\.extraWords/);
});test("shared Ready lobby owns its layout, panel, and left-aligned heading", () => {
  const lobby = read("client/src/components/SharedReadyLobby.tsx");
  const panel = read("client/src/components/SharedReadyPanel.tsx");
  const sharedCss = read("client/src/components/SharedReadyLobby.css");
  const lastWordCss = read("client/src/games/LastWord/last-word.css");
  assert.match(lobby, /import "\.\/SharedReadyLobby\.css"/);
  assert.match(lobby, /className="ready-lobby"/);
  assert.match(lobby, /className="ready-lobby-intro"/);
  assert.match(panel, /className="ready-lobby-panel"/);
  assert.match(sharedCss, /\.ready-lobby \.ready-lobby-intro h2\s*\{[^}]*text-align:\s*left/);
  assert.match(sharedCss, /\.ready-lobby-columns[^}]*grid-template-columns:/);
  assert.match(sharedCss, /\.ready-lobby-columns > \.ready-lobby-panel[^}]*order:\s*-1/);
  assert.match(sharedCss, /\.ready-lobby-toggle/);
  assert.match(sharedCss, /\.ready-lobby-start/);
  assert.doesNotMatch(lobby + panel, /className=[^\n]*lw-/);
  assert.doesNotMatch(lastWordCss, /\.lw-(?:setup|ready|back|eyebrow|disconnected)(?:\b|[-.{:#])/);
});


test('audio is globally paused without removing sound generation or player preferences', () => {
  const audio = read('client/src/lib/audio.ts');
  const lastWord = read('client/src/games/LastWord/LastWordGame.tsx');
  const room = read('client/src/screens/RoomScreen.tsx');
  assert.match(audio, /export const AUDIO_ENABLED: boolean = false/);
  assert.match(lastWord, /import \{ AUDIO_ENABLED \} from "\.\.\/\.\.\/lib\/audio"/);
  assert.match(lastWord, /if\(!AUDIO_ENABLED\)return/);
  assert.match(lastWord, /window\.AudioContext/);
  assert.match(room, /import \{ AUDIO_ENABLED \} from "\.\.\/lib\/audio"/);
  assert.match(room, /disabled=\{!AUDIO_ENABLED\}/);
  assert.match(room, /aria-pressed=\{AUDIO_ENABLED && soundOn\}/);
  assert.match(room, /localStorage\.setItem\("fff-sound"/);
});
