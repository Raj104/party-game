import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';

const src = resolve(import.meta.dirname, '../client/src');
const entry = join(src, 'styles/index.css');
const content = readFileSync(entry, 'utf8');
const imports = [...content.matchAll(/^@import "([^"]+)";/gm)].map(match => match[1]);
let problems = [];
if (!imports.length) problems.push('The style entry point has no imports.');
for (const file of imports) {
  if (!existsSync(resolve(dirname(entry), file))) problems.push(`Missing stylesheet: ${file}`);
}
for (const old of ['IndieV2.css', 'GameSelection.css', 'App.css', ...[411,412,413,414,415].map(n => `FunnyPolishV${n}.css`)]) {
  if (existsSync(join(src, old))) problems.push(`Old stylesheet still exists: ${old}`);
}
const app = readFileSync(join(src, 'App.tsx'), 'utf8');
if (!app.includes('import "./styles/index.css"')) problems.push('App.tsx must import the style entry point.');
const manual = readFileSync(join(src,'styles/tv/local-display-tuning.css'),'utf8');
if (!manual.includes('120px !important') || !manual.includes('align-self: center !important')) {
  problems.push('User-tuned TV overrides need review.');
}
if (problems.length) {
  problems.forEach(problem => process.stderr.write(`ERROR: ${problem}\n`));
  process.exit(1);
}
console.log(`Style structure OK (${imports.length} stylesheet imports).`);
