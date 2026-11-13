// Rebuilds runs/manifest.json, which the gallery (index.html) reads.
// Run after adding a run, checking one, or scoring one.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { RUNS, listRunSlugs, readJson, RUBRIC, briefVersion } from './lib.mjs';

export function buildManifest() {
  const runs = [];
  for (const slug of listRunSlugs()) {
    const dir = join(RUNS, slug);
    const run = readJson(join(dir, 'run.json'));
    if (!run) { console.warn(`skipping runs/${slug}: run.json is not valid JSON`); continue; }
    const check = readJson(join(dir, 'check.json'));
    const cover = ['cover.jpg', 'cover.png', 'shots/play.jpg', 'shots/title.jpg']
      .find((f) => existsSync(join(dir, f))) || null;
    let total = null;
    if (run.score && typeof run.score === 'object') {
      const vals = RUBRIC.map((k) => run.score[k]).filter((v) => typeof v === 'number');
      if (vals.length === RUBRIC.length) total = vals.reduce((a, b) => a + b, 0);
    }
    runs.push({
      ...run,
      slug,
      playable: existsSync(join(dir, 'index.html')),
      cover,
      scoreTotal: total,
      scoreMax: RUBRIC.length * 5,
      check: check ? { pass: check.pass, date: check.date, failed: check.checks.filter((c) => !c.pass).map((c) => c.id), fps: check.fps ?? null, bytes: check.bytes ?? null } : null,
    });
  }
  runs.sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.slug.localeCompare(b.slug));
  const manifest = { brief: briefVersion(), rubric: RUBRIC, runs };
  writeFileSync(join(RUNS, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && process.argv[1].endsWith('manifest.mjs')) {
  const m = buildManifest();
  console.log(`runs/manifest.json: ${m.runs.length} run(s)`);
}
