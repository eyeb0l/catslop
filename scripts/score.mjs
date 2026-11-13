// Record a human judgement for a run (see docs/JUDGING.md).
//   npm run score -- <slug> cat=4 feel=3 loop=4 world=3 audio=2 polish=3 performance=5 charm=4 [--notes "one line"] [--by "name"]
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RUNS, RUBRIC, readJson } from './lib.mjs';
import { buildManifest } from './manifest.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--') && !a.includes('='));
const file = slug && join(RUNS, slug, 'run.json');
if (!slug || !existsSync(file)) {
  console.error(`usage: npm run score -- <slug> ${RUBRIC.map((k) => `${k}=0..5`).join(' ')} [--notes "..."] [--by "name"]`);
  process.exit(1);
}
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] ?? '' : undefined; };
const run = readJson(file);
const score = { ...(run.score || {}) };
for (const a of args) {
  const m = a.match(/^([a-z]+)=(\d(?:\.\d)?)$/);
  if (!m) continue;
  if (!RUBRIC.includes(m[1])) { console.error(`unknown category "${m[1]}". Categories: ${RUBRIC.join(', ')}`); process.exit(1); }
  const v = Number(m[2]);
  if (v < 0 || v > 5) { console.error(`${m[1]} must be between 0 and 5`); process.exit(1); }
  score[m[1]] = v;
}
const missing = RUBRIC.filter((k) => typeof score[k] !== 'number');
if (missing.length) { console.error(`still unscored: ${missing.join(', ')}`); process.exit(1); }
if (opt('notes') !== undefined) score.notes = opt('notes');
if (opt('by') !== undefined) score.by = opt('by');
score.date = new Date().toISOString().slice(0, 10);
run.score = score;
writeFileSync(file, JSON.stringify(run, null, 2) + '\n');
buildManifest();
console.log(`${slug}: ${RUBRIC.reduce((s, k) => s + score[k], 0)} / ${RUBRIC.length * 5}`);
