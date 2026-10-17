// No network sockets: tests the actual TypeScript security helper functions.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../src/security.ts'), 'utf8');
const transpiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}}).outputText;
const mod = { exports: {} };
new Function('module', 'exports', transpiled)(mod, mod.exports);
const { allowedOrigins, isAllowedBrowserOrigin, fixedWindowLimiter } = mod.exports;

test('production refuses to start with missing, invalid or HTTP frontend origins', () => {
  assert.throws(() => allowedOrigins(undefined, true), /must be set/);
  assert.throws(() => allowedOrigins('http://example.com', true), /HTTPS/);
  assert.throws(() => allowedOrigins('https://example.com/party-game/', true), /without paths/);
  assert.throws(() => allowedOrigins('https://example.com/', true), /without paths/);
  assert.deepEqual([...allowedOrigins('https://foo.github.io,https://example.com', true)], [
    'https://foo.github.io', 'https://example.com',
  ]);
});

test('production Socket.IO only accepts explicitly configured browser origins', () => {
  const configured = allowedOrigins('https://foo.github.io', true);
  assert.equal(isAllowedBrowserOrigin('https://foo.github.io', configured, true), true);
  assert.equal(isAllowedBrowserOrigin('https://evil.example', configured, true), false);
  assert.equal(isAllowedBrowserOrigin(undefined, configured, true), false);
  assert.equal(isAllowedBrowserOrigin('null', configured, true), false);
  assert.equal(isAllowedBrowserOrigin('https://foo.github.io.evil.example', configured, true), false);
});

test('development preserves localhost and private LAN access for phones', () => {
  const configured = allowedOrigins(undefined, false);
  for (const origin of ['http://localhost:5173', 'http://192.168.1.15:5173',
    'http://10.1.2.3:5173', 'http://172.16.0.1:5173']) {
    assert.equal(isAllowedBrowserOrigin(origin, configured, false), true, origin);
  }
  for (const origin of ['http://8.8.8.8:5173', 'http://192.168.1.15:8000',
    'https://example.net', 'http://172.32.1.1:5173']) {
    assert.equal(isAllowedBrowserOrigin(origin, configured, false), false, origin);
  }
});

test('fixed-window limits reject bursts and reset without storing visitor identities', () => {
  const take = fixedWindowLimiter(2, 60_000);
  assert.equal(take(100), true);
  assert.equal(take(101), true);
  assert.equal(take(102), false);
  assert.equal(take(60_101), true);
});
