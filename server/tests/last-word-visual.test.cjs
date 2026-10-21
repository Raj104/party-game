const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const game = readFileSync(path.join(__dirname, '../../client/src/games/LastWord/LastWordGame.tsx'), 'utf8');
const styles = readFileSync(path.join(__dirname, '../../client/src/games/LastWord/last-word.css'), 'utf8');
const token = readFileSync(path.join(__dirname, '../../client/src/components/CharacterToken.tsx'), 'utf8');

const v505 = styles.slice(styles.indexOf('/* v5.0.5'));

test('active roundtable token has an offset high-contrast progress ring', () => {
  assert.match(game, /lw-seat-ring--\$\{timerUrgency\}/);
  assert.match(game, /turnRemainingMs\/game.turnDurationMs/);
  assert.match(v505, /\.lw-seat-ring\s*\{[^}]*inset:\s*-12px/s);
  assert.match(v505, /\.lw-seat-ring::after\s*\{[^}]*inset:\s*5px/s);
  assert.match(v505, /\.lw-seat-ring--warning/);
  assert.match(v505, /\.lw-seat-ring--danger/);
});

test('roundtable is compact on desktop, TV, and mobile while maintaining flight seat geometry', () => {
  assert.match(v505, /\.lw-table\s*\{[^}]*width:\s*min\(100%,\s*840px\)/s);
  assert.match(v505, /\.tv-screen--playing \.lw-table\s*\{[^}]*width:\s*min\(72vw,\s*840px\)/s);
  assert.match(v505, /@media \(max-width: 480px\)/);
  assert.match(game, /50\+43\*Math\.cos\(angle\)/);
  assert.match(game, /50\+39\*Math\.sin\(angle\)/);
});

test('original artwork stays unchanged and circular styling is scoped to Last Word', () => {
  assert.match(v505, /\.lw-seat-token > \.character-token/);
  assert.match(v505, /\.lw-award-token > \.character-token/);
  assert.match(v505, /border-radius:\s*50%/);
  assert.match(token, /character === "scribble"/);
  assert.match(token, /character === "bolt"/);
  assert.doesNotMatch(v505, /(?:^|\n)\.character-token\s*\{/);
});

test('award ceremony has separate light and dark stage backgrounds with no bomb or token ring', () => {
  assert.match(v505, /:root\[data-theme="light"\] \.lw-award/);
  assert.match(v505, /:root\[data-theme="dark"\] \.lw-award/);
  assert.match(v505, /\.lw-award-token::before, \.lw-winner-token::before\s*\{\s*content:\s*none/);
  const awardScreen = game.split('if(stage==="awards"')[1].split('if(stage==="results")')[0];
  assert.match(awardScreen, /<CharacterToken character=\{awardWinner\.character\}/);
  assert.doesNotMatch(awardScreen, /<BombBuddy|lw-seat-ring/);
});

test('active tokens bob without glow; award token has a separate subtle idle animation', () => {
  assert.match(v505, /\.lw-table--turn \.lw-seat--active \.lw-seat-token > \.character-token/);
  assert.match(v505, /@keyframes lw-token-alive/);
  assert.match(v505, /@keyframes lw-ceremony-token-alive/);
  assert.match(v505, /\.lw-seat--active \.lw-seat-token\s*\{\s*background:\s*transparent;\s*box-shadow:\s*none;/);
});
