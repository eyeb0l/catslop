// Shared helpers for the catslop scripts.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RUNS = join(ROOT, 'runs');

/** The brief's version is the first `v<number>` in its top heading. */
export function briefVersion() {
  const head = readFileSync(join(ROOT, 'BRIEF.md'), 'utf8').split('\n', 1)[0];
  const m = head.match(/\bv(\d+)\b/);
  if (!m) throw new Error('BRIEF.md heading must contain a version like "v1"');
  return Number(m[1]);
}

export const SLUG_RE = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;

export function listRunSlugs() {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(RUNS, d.name, 'run.json')))
    .map((d) => d.name)
    .sort();
}

export function readJson(file, fallback = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function dirSize(dir) {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += dirSize(p);
    else if (e.isFile()) total += statSync(p).size;
  }
  return total;
}

export const RUBRIC = ['cat', 'feel', 'loop', 'world', 'audio', 'polish', 'performance', 'charm'];

// Headless Chromium grants pointer lock and then throttles the page to under
// one frame a second, so automation refuses the lock the way a browser may.
export const NO_POINTER_LOCK = () => {
  Element.prototype.requestPointerLock = function requestPointerLock() {
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockerror')));
    return Promise.reject(new DOMException('Pointer lock is not available in automated runs.', 'NotSupportedError'));
  };
};
