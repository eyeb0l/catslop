// Zero-dependency static server for the gallery and every run.
//   npm run serve            -> http://localhost:4173
//   PORT=5000 npm run serve  -> pick a port (0 = any free port)
// Also importable: `startServer({ port, quiet })` resolves to { server, port, url }.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', // plain, so browsers show it instead of downloading
  '.glsl': 'text/plain; charset=utf-8', '.wgsl': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolvePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  const full = normalize(join(ROOT, p));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  // Never serve dependencies or VCS internals: runs must not rely on them.
  const rel = full.slice(ROOT.length + 1).split(sep)[0];
  if (rel === 'node_modules' || rel === '.git') return null;
  return full;
}

export function startServer({ port = 4173, quiet = false } = {}) {
  const server = createServer((req, res) => {
    let file = resolvePath(req.url || '/');
    if (!file) { res.writeHead(403).end('forbidden'); return; }
    let st;
    try { st = statSync(file); } catch { st = null; }
    if (st && st.isDirectory()) {
      if (!(req.url || '/').split('?')[0].endsWith('/')) {
        res.writeHead(301, { Location: (req.url || '/').split('?')[0] + '/' }).end();
        return;
      }
      file = join(file, 'index.html');
      try { st = statSync(file); } catch { st = null; }
    }
    if (!st || !st.isFile()) {
      if (!quiet) console.log(`404 ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://127.0.0.1:${actual}` });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT ?? process.argv[2] ?? 4173);
  const { url } = await startServer({ port });
  console.log(`catslop gallery: ${url}/`);
  console.log(`a run:           ${url}/runs/<slug>/`);
}
