// Headless smoke check for runs. It answers "does this run load, render 3D,
// animate, stay offline and stay quiet in the console?" - nothing about whether
// the game is any good. That part is a human's job (docs/JUDGING.md).
//
//   npm run check -- <slug> [<slug> ...]   check specific runs
//   npm run check -- --all                 check every run
//
// Writes runs/<slug>/check.json and screenshots to runs/<slug>/shots/, then
// refreshes runs/manifest.json. Exits non-zero if any checked run fails.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
import { RUNS, listRunSlugs, readJson, dirSize, briefVersion, NO_POINTER_LOCK } from './lib.mjs';
import { buildManifest } from './manifest.mjs';

const VIEWPORT = { width: 1280, height: 720 };
// Software GL so the check behaves the same on a headless box and a laptop.
const CHROMIUM_ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
];

const args = process.argv.slice(2);
const slugs = args.includes('--all') ? listRunSlugs() : args.filter((a) => !a.startsWith('--'));
if (slugs.length === 0) {
  console.error('usage: npm run check -- <slug> [<slug> ...] | --all');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Decode a screenshot in a scratch page and measure how much is in it. */
async function imageStats(scratch, buffer) {
  return scratch.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/jpeg;base64,' + b64;
    await img.decode();
    const w = 160, h = 90;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    const seen = new Set();
    let sum = 0, sum2 = 0;
    const n = w * h;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l; sum2 += l * l;
      seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    }
    const mean = sum / n;
    return { mean, stddev: Math.sqrt(Math.max(0, sum2 / n - mean * mean)), colours: seen.size };
  }, buffer.toString('base64'));
}

async function checkRun(browser, baseUrl, slug) {
  const dir = join(RUNS, slug);
  const checks = [];
  const add = (id, pass, detail = '') => checks.push({ id, pass: Boolean(pass), detail });
  const consoleErrors = [];
  const failedRequests = [];
  const externalRequests = [];

  const run = readJson(join(dir, 'run.json'));
  const required = ['slug', 'model', 'vendor', 'harness', 'date', 'brief', 'game'];
  const missing = run ? required.filter((k) => run[k] === undefined || run[k] === null || String(JSON.stringify(run[k])).includes('TODO')) : required;
  add('run-json', run && missing.length === 0, missing.length ? `missing or TODO: ${missing.join(', ')}` : '');
  add('notes', existsSync(join(dir, 'NOTES.md')), 'NOTES.md');
  add('entry', existsSync(join(dir, 'index.html')), 'index.html');

  let fps = null;
  if (existsSync(join(dir, 'index.html'))) {
    mkdirSync(join(dir, 'shots'), { recursive: true });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const origin = new URL(baseUrl).origin;
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      externalRequests.push(url);
      return route.abort();
    });
    await context.addInitScript(NO_POINTER_LOCK);
    await context.addInitScript(() => {
      window.__catslopCheck = { frames: 0 };
      const tick = () => { window.__catslopCheck.frames++; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    const page = await context.newPage();
    const scratch = await context.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)); });
    page.on('pageerror', (e) => consoleErrors.push(`uncaught: ${String(e.message || e).slice(0, 500)}`));
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) failedRequests.push(`${r.status()} ${r.url().replace(origin, '')}`);
    });

    await page.bringToFront();
    await page.goto(`${baseUrl}/runs/${slug}/`, { waitUntil: 'load', timeout: 60_000 });
    let canvasOk = false;
    try {
      await page.waitForFunction(() => {
        const cs = [...document.querySelectorAll('canvas')];
        return cs.some((c) => c.width >= 300 && c.height >= 150);
      }, null, { timeout: 30_000 });
      canvasOk = true;
    } catch { /* reported below */ }
    await sleep(4000);
    const title = await page.screenshot({ type: 'jpeg', quality: 82 });
    writeFileSync(join(dir, 'shots', 'title.jpg'), title);

    // Get past the title screen the way the brief promises works.
    await page.keyboard.press('Enter');
    await sleep(600);
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await sleep(2500);

    const f0 = await page.evaluate(() => ({ n: window.__catslopCheck.frames, t: performance.now() }));
    await page.keyboard.down('w');
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(VIEWPORT.width / 2 + i * 12, VIEWPORT.height / 2 + Math.sin(i) * 10);
      await sleep(250);
    }
    await page.keyboard.press('Space');
    await sleep(500);
    const playA = await page.screenshot({ type: 'jpeg', quality: 82 });
    await page.keyboard.down('d');
    await sleep(900);
    const playB = await page.screenshot({ type: 'jpeg', quality: 82 });
    await page.keyboard.up('d');
    await page.keyboard.up('w');
    const f1 = await page.evaluate(() => ({ n: window.__catslopCheck.frames, t: performance.now() }));
    fps = Math.round(((f1.n - f0.n) / ((f1.t - f0.t) / 1000)) * 10) / 10;
    writeFileSync(join(dir, 'shots', 'play.jpg'), playB);

    const context3d = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height);
      for (const c of cs) {
        for (const kind of ['webgl2', 'webgl', 'webgpu']) {
          let ctx = null;
          try { ctx = c.getContext(kind); } catch { /* wrong kind for this canvas */ }
          if (ctx) return kind;
        }
      }
      return null;
    });
    add('canvas-3d', canvasOk && context3d, context3d ? `largest canvas uses ${context3d}` : 'no canvas with a WebGL or WebGPU context');

    const st = await imageStats(scratch, playB);
    add('renders', st.stddev > 6 && st.colours > 40, `gameplay frame: luminance stddev ${st.stddev.toFixed(1)}, ${st.colours} colours`);
    add('animates', !playA.equals(playB), 'two gameplay frames 0.9s apart differ');
    add('offline', externalRequests.length === 0, externalRequests.slice(0, 5).join(' | '));
    add('no-failed-requests', failedRequests.length === 0, failedRequests.slice(0, 5).join(' | '));
    add('no-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
    await context.close();
  }

  const result = {
    slug,
    pass: checks.every((c) => c.pass),
    date: new Date().toISOString(),
    brief: briefVersion(),
    renderer: 'chromium headless, SwiftShader (software GL) - fps is not comparable to a real GPU',
    fps,
    bytes: dirSize(dir),
    checks,
    consoleErrors,
    failedRequests,
    externalRequests,
  };
  writeFileSync(join(dir, 'check.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

const { server, url } = await startServer({ port: 0, quiet: true });
const browser = await chromium.launch({ args: CHROMIUM_ARGS });
let failed = 0;
try {
  for (const slug of slugs) {
    if (!existsSync(join(RUNS, slug))) { console.error(`runs/${slug} does not exist`); failed++; continue; }
    const r = await checkRun(browser, url, slug);
    console.log(`\n${r.pass ? 'PASS' : 'FAIL'}  ${slug}  (${r.fps ?? '-'} fps software GL, ${(r.bytes / 1e6).toFixed(1)} MB)`);
    for (const c of r.checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.id}${c.detail ? `  - ${c.detail}` : ''}`);
    if (!r.pass) failed++;
  }
} finally {
  await browser.close();
  server.close();
}
buildManifest();
process.exit(failed ? 1 : 0);
