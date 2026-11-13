// Copies the pinned three.js from node_modules into vendor/three so that runs
// are playable from a plain static server with no install and no network.
// Re-run only when deliberately bumping the pinned version in package.json.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three');
const dest = join(root, 'vendor', 'three');
const { version } = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, 'build'), { recursive: true });
for (const f of ['three.module.js', 'three.core.js', 'three.webgpu.js', 'three.webgpu.nodes.js', 'three.tsl.js']) {
  cpSync(join(src, 'build', f), join(dest, 'build', f));
}
cpSync(join(src, 'examples', 'jsm'), join(dest, 'examples', 'jsm'), { recursive: true });
cpSync(join(src, 'LICENSE'), join(dest, 'LICENSE'));
writeFileSync(join(dest, 'VERSION'), version + '\n');
console.log(`vendored three@${version} -> vendor/three`);
