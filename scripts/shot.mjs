// Take screenshots of a run in headless Chromium (software GL), for looking at
// your own work while you build it.
//
//   npm run shot -- <slug> [options]
//     --query "a=1&b=2"     query string appended to the run URL
//     --size 1280x720       viewport
//     --wait 4000           ms to wait after load before doing anything
//     --enter               press Enter and click the centre (leave the title screen)
//     --keys "w:1500,Space:80,d:600"   hold each key for that many ms, in order
//     --eval "js"           evaluate in the page after the keys
//     --after 500           ms to wait after keys/eval before the screenshot
//     --out path.png        where to save (default: runs/<slug>/shots/shot.png)
//     --script file.mjs     instead of keys/eval: default-export async (page, shot) => {}
//                           where shot(name) saves <out dir>/<name>.png
// Console errors and failed requests are printed, so a clean run prints nothing.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from './serve.mjs';
import { RUNS, NO_POINTER_LOCK } from './lib.mjs';

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('--'));
const opt = (name, fallback = '') => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] ?? '' : fallback;
};
if (!slug) { console.error('usage: npm run shot -- <slug> [--enter] [--keys "w:1500"] [--out file.png] (see scripts/shot.mjs)'); process.exit(1); }

const [w, h] = opt('size', '1280x720').split('x').map(Number);
const out = resolve(opt('out', join(RUNS, slug, 'shots', 'shot.png')));
mkdirSync(dirname(out), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { server, url } = await startServer({ port: 0, quiet: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
});
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.addInitScript(NO_POINTER_LOCK);
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log(`[uncaught] ${e.stack || e.message || e}`));
  page.on('response', (r) => { if (r.status() >= 400) console.log(`[${r.status()}] ${r.url()}`); });
  const q = opt('query');
  await page.goto(`${url}/runs/${slug}/${q ? `?${q}` : ''}`, { waitUntil: 'load' });
  await sleep(Number(opt('wait', '4000')));
  const shot = async (name) => {
    const file = join(dirname(out), `${name}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  };
  if (opt('script')) {
    const mod = await import(pathToFileURL(resolve(opt('script'))).href);
    await mod.default(page, shot, { sleep, width: w, height: h });
  } else {
    if (argv.includes('--enter')) {
      await page.keyboard.press('Enter');
      await sleep(400);
      await page.mouse.click(w / 2, h / 2);
      await sleep(1500);
    }
    for (const part of opt('keys').split(',').filter(Boolean)) {
      const [key, ms] = part.split(':');
      await page.keyboard.down(key);
      await sleep(Number(ms || 100));
      await page.keyboard.up(key);
    }
    if (opt('eval')) console.log('eval ->', JSON.stringify(await page.evaluate(opt('eval'))));
    await sleep(Number(opt('after', '500')));
    await page.screenshot({ path: out });
    console.log(out);
  }
} finally {
  await browser.close();
  server.close();
}
