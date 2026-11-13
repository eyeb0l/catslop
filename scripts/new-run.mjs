// Scaffolds a run directory for one model's attempt.
//   npm run new-run -- <slug> [--model "Display Name"] [--vendor "Lab"] [--harness "Tool"]
// The slug is the model id (lowercase, digits, dots, dashes), plus a suffix
// such as "-2" when the same model attempts the brief again.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RUNS, SLUG_RE, briefVersion } from './lib.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] ?? '' : '';
};

if (!slug || !SLUG_RE.test(slug)) {
  console.error('usage: npm run new-run -- <slug> [--model "Name"] [--vendor "Lab"] [--harness "Tool"]');
  console.error('slug: lowercase letters, digits, dots and dashes, e.g. claude-fable-5-2 or gpt-6-astra-2');
  process.exit(1);
}
const dir = join(RUNS, slug);
if (existsSync(dir)) {
  console.error(`runs/${slug} already exists. Pick another slug (append -2, -3, ...) for a new attempt.`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });
const run = {
  slug,
  model: opt('model') || 'TODO: display name of the model, e.g. "Claude Fable 5.2"',
  modelId: opt('model-id') || slug,
  vendor: opt('vendor') || 'TODO: lab that made the model',
  harness: opt('harness') || 'TODO: tool the model ran in, e.g. "Claude Code", "Codex CLI"',
  date: new Date().toISOString().slice(0, 10),
  brief: briefVersion(),
  game: {
    title: 'TODO: the name of your game',
    tagline: 'TODO: one sentence that sells it',
    controls: 'TODO: one line, e.g. "WASD move, mouse look, Space pounce"',
  },
  session: {
    humanInterventions: 0,
    notes: 'TODO: anything a reader should know about how this run was produced (or delete this text)',
  },
  score: null,
};
writeFileSync(join(dir, 'run.json'), JSON.stringify(run, null, 2) + '\n');
writeFileSync(join(dir, 'NOTES.md'), `# ${slug}

<!-- Written by the model at the end of its run. Keep it short and honest. -->

## What I built

## How to play

## What I'm proudest of

## What's missing or broken

## How I verified it
`);
console.log(`created runs/${slug}/ (run.json, NOTES.md)`);
console.log(`entry point to create: runs/${slug}/index.html`);
