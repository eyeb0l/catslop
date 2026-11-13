// Things on surfaces, waiting to find out whether gravity still works.
// Each item is a small rigid body with a circular footprint: it slides,
// falls off edges, tumbles, bounces, rolls and (if fragile) shatters.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const G = 9.8;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

// ---------- shared materials ----------
const MAT = {
  std: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }),
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85 }),
  glass: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

function colorize(g, color) {
  const geo = g.index ? g.toNonIndexed() : g;
  for (const n of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(n)) geo.deleteAttribute(n);
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** parts: [geometry, colour, materialKey]; geometry is already positioned with y=0 at the item's bottom. */
function assemble(parts, h) {
  const group = new THREE.Group();
  const byMat = {};
  for (const [g, c, m = 'std'] of parts) {
    g.translate(0, -h / 2, 0); // item origin is its centre
    (byMat[m] ||= []).push(colorize(g, c));
  }
  for (const [m, geos] of Object.entries(byMat)) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), MAT[m]);
    mesh.castShadow = m !== 'glass' && m !== 'glow';
    mesh.receiveShadow = m !== 'glow';
    if (m === 'glass') mesh.renderOrder = 2;
    group.add(mesh);
  }
  return group;
}

const cyl = (r0, r1, h, y = 0, seg = 18, x = 0, z = 0) => new THREE.CylinderGeometry(r1, r0, h, seg).translate(x, y + h / 2, z);
const sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)).scale(sx, sy, sz).translate(x, y, z);
const bx = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const rbx = (w, h, d, r, x = 0, y = 0, z = 0) => new RoundedBoxGeometry(w, h, d, 2, r).translate(x, y + h / 2, z);
const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
const torus = (r, t, x, y, z, rotY = 0, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, 12, arc).rotateY(rotY).translate(x, y, z);

const MUG_COLS = ['#c8664b', '#3f8079', '#e3a64a', '#efe1c6', '#2f3e57', '#d98b8b'];

// ---------- item types ----------
// r: footprint radius, h: height, mat: sound family, value: science points
// flat: stays flat when it falls; roll: rolls along the floor; fragile: impact speed that breaks it
export const TYPES = {
  mug: { name: 'Mug', r: 0.05, h: 0.095, mat: 'ceramic', value: 100, fragile: 3.3, shard: null,
    build(c = pick(MUG_COLS)) { this.shard = c; return [[cyl(0.045, 0.045, 0.095), c], [cyl(0.039, 0.039, 0.003, 0.08), '#4a2a18'], [torus(0.025, 0.007, 0.05, 0.05, 0, 0).rotateY(0), c]]; } },
  glass: { name: 'Glass of water', r: 0.036, h: 0.11, mat: 'glass', value: 150, fragile: 2.3, shard: '#cfe8ef', spill: 'water',
    build() { return [[cyl(0.032, 0.036, 0.11), '#e6f4f7', 'glass'], [cyl(0.028, 0.031, 0.075, 0.004), '#9fd2e6', 'glass']]; } },
  wineglass: { name: 'Wine glass', r: 0.04, h: 0.18, mat: 'glass', value: 200, fragile: 2.0, shard: '#e7d8e6',
    build() { return [[lathe([[0, 0], [0.035, 0], [0.035, 0.004], [0.004, 0.01], [0.004, 0.09], [0.03, 0.11], [0.04, 0.15], [0.038, 0.18]]), '#efe6f0', 'glass'], [lathe([[0, 0.1], [0.028, 0.115], [0.034, 0.14], [0, 0.14]]), '#7c1f3a', 'glass']]; } },
  plate: { name: 'Plate', r: 0.12, h: 0.022, mat: 'ceramic', value: 120, fragile: 3.0, flat: true, shard: '#f4efe6',
    build() { return [[lathe([[0, 0], [0.08, 0], [0.12, 0.018], [0.122, 0.022], [0.0, 0.008]], 28), '#f4efe6'], [cyl(0.118, 0.118, 0.002, 0.016, 28), '#3f8079']]; } },
  vase: { name: 'Vase of tulips', r: 0.06, h: 0.34, mat: 'ceramic', value: 250, fragile: 2.8, shard: '#3f8079', spill: 'water',
    build() {
      const p = [[lathe([[0, 0], [0.05, 0], [0.06, 0.06], [0.045, 0.16], [0.03, 0.19], [0.036, 0.2]]), '#3f8079']];
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3, x = Math.cos(a) * 0.02, z = Math.sin(a) * 0.02, hh = rnd(0.1, 0.15);
        p.push([cyl(0.003, 0.003, hh, 0.18, 4, x, z), '#4f7d3a']);
        p.push([sph(0.016, x * 1.5, 0.19 + hh, z * 1.5, 0.9, 1.3, 0.9, 8), pick(['#e8546b', '#f0a33c', '#f4d35e', '#e86a9a'])]);
      }
      return p;
    } },
  fancyvase: { name: 'The Fancy Vase', r: 0.1, h: 0.42, mat: 'ceramic', value: 700, fragile: 2.0, shard: '#2f5d9a',
    build() {
      return [[lathe([[0, 0], [0.07, 0], [0.1, 0.12], [0.095, 0.24], [0.05, 0.34], [0.042, 0.38], [0.06, 0.42], [0.055, 0.42]], 28), '#f4f0e6'],
        [lathe([[0.1, 0.13], [0.1, 0.17], [0.1, 0.17]], 28), '#2f5d9a'], [cyl(0.097, 0.1, 0.035, 0.13, 28), '#2f5d9a'], [cyl(0.088, 0.093, 0.025, 0.26, 28), '#2f5d9a'],
        [cyl(0.061, 0.061, 0.012, 0.408, 28), '#d6a73c', 'metal']];
    } },
  plant: { name: 'Potted plant', r: 0.075, h: 0.24, mat: 'soil', value: 150, spill: 'soil', shard: '#6b4a2f',
    build() {
      const p = [[cyl(0.05, 0.068, 0.11), '#c9744f'], [cyl(0.06, 0.06, 0.004, 0.1), '#5a3b25']];
      for (let i = 0; i < 6; i++) { const a = i * 1.05; p.push([sph(0.05, Math.cos(a) * 0.04, 0.17 + (i % 2) * 0.03, Math.sin(a) * 0.04, 1, 0.35, 0.6, 8).rotateY(-a), i % 2 ? '#5f8f4e' : '#43703c']); }
      return p;
    } },
  cactus: { name: 'Tiny cactus', r: 0.045, h: 0.15, mat: 'soil', value: 120, spill: 'soil', shard: '#6b4a2f',
    build() { return [[cyl(0.032, 0.042, 0.06), '#e8b48f'], [sph(0.028, 0, 0.1, 0, 1, 1.6, 1, 10), '#4f8a52'], [sph(0.012, 0.028, 0.11, 0, 1.6, 0.8, 0.8, 6), '#4f8a52'], [sph(0.008, 0, 0.148, 0, 1, 1, 1, 6), '#e86a9a']]; } },
  book: { name: 'Book', r: 0.09, h: 0.035, mat: 'paper', value: 60, flat: true,
    build() { const c = pick(['#c8664b', '#3f8079', '#2f3e57', '#7a4c63', '#e3a64a']); return [[bx(0.19, 0.035, 0.13), c], [bx(0.175, 0.027, 0.124, 0.006, 0.004, 0), '#f6f1e4']]; } },
  remote: { name: 'TV remote', r: 0.08, h: 0.022, mat: 'plastic', value: 60, flat: true,
    build() { return [[rbx(0.05, 0.022, 0.17, 0.008), '#2d2b31'], [sph(0.008, 0, 0.022, 0.055, 1, 0.4, 1, 8), '#c8464b'], [bx(0.03, 0.004, 0.06, 0, 0.02, -0.02), '#55535b']]; } },
  phone: { name: 'Phone', r: 0.075, h: 0.012, mat: 'plastic', value: 150, flat: true,
    build() { return [[rbx(0.075, 0.012, 0.15, 0.005), '#26252b'], [bx(0.066, 0.002, 0.135, 0, 0.011, 0), '#5c8fb8', 'glow']]; } },
  candle: { name: 'Candle', r: 0.03, h: 0.15, mat: 'wood', value: 80,
    build() { return [[cyl(0.028, 0.028, 0.12), '#f3e8d0'], [cyl(0.03, 0.034, 0.012), '#d6a73c', 'metal'], [cyl(0.002, 0.002, 0.012, 0.12, 4), '#222'], [sph(0.008, 0, 0.14, 0, 1, 1.8, 1, 8), '#ffcf6a', 'glow']]; } },
  bottle: { name: 'Bottle', r: 0.035, h: 0.27, mat: 'glass', value: 180, fragile: 2.2, shard: '#5d9a6a',
    build() { return [[lathe([[0, 0], [0.035, 0], [0.035, 0.17], [0.013, 0.215], [0.012, 0.26], [0.014, 0.27], [0, 0.27]]), '#5d9a6a', 'glass'], [cyl(0.0355, 0.0355, 0.06, 0.06), '#f2e6c8']]; } },
  jar: { name: 'Jar', r: 0.055, h: 0.15, mat: 'ceramic', value: 100, fragile: 3.0, shard: '#e9dcc0',
    build() { const c = pick(['#e9dcc0', '#c8664b', '#8fae8f']); this.shard = c; return [[cyl(0.052, 0.052, 0.13), c], [cyl(0.054, 0.054, 0.02, 0.13), '#70503a'], [sph(0.012, 0, 0.155, 0, 1, 0.7, 1, 8), '#70503a']]; } },
  toaster: { name: 'Toaster', r: 0.11, h: 0.17, mat: 'metal', value: 150, mass: 3,
    build() { return [[rbx(0.24, 0.17, 0.14, 0.035), '#e3d9c6', 'metal'], [bx(0.16, 0.003, 0.025, 0, 0.17, 0.03), '#222'], [bx(0.16, 0.003, 0.025, 0, 0.17, -0.03), '#222'], [bx(0.02, 0.03, 0.02, 0.1, 0.1, 0.075), '#2d2b31']]; } },
  kettle: { name: 'Kettle', r: 0.085, h: 0.21, mat: 'metal', value: 150, mass: 2,
    build() { return [[lathe([[0, 0], [0.085, 0], [0.088, 0.04], [0.075, 0.14], [0.03, 0.17], [0, 0.17]], 24), '#c8664b'], [torus(0.06, 0.009, 0, 0.17, 0, 0, Math.PI).rotateY(0), '#2d2b31'], [cyl(0.015, 0.008, 0.08, 0, 8).rotateZ(-0.9).translate(0.11, 0.06, 0), '#c8664b']]; } },
  fish: { name: "Tonight's dinner", r: 0.14, h: 0.06, mat: 'fish', value: 350, flat: true,
    build() {
      return [[lathe([[0, 0], [0.1, 0], [0.14, 0.015], [0.142, 0.02], [0, 0.008]], 28), '#f4efe6'],
        [sph(0.05, 0, 0.035, 0, 2.0, 0.55, 0.8, 14), '#b9c6cf', 'metal'], [new THREE.ConeGeometry(0.04, 0.06, 4).scale(1, 1, 0.3).rotateZ(Math.PI / 2).translate(-0.12, 0.035, 0), '#9aa8b3', 'metal'],
        [sph(0.008, 0.075, 0.045, 0.02, 1, 1, 1, 6), '#111'], [sph(0.012, 0.03, 0.03, 0.05, 1, 0.5, 1, 6), '#f2c14e']];
    } },
  egg: { name: 'Egg', r: 0.026, h: 0.058, mat: 'egg', value: 150, fragile: 1.6, roll: true, spill: 'egg', shard: '#f3ead8',
    build() { return [[sph(0.026, 0, 0.029, 0, 1, 1.15, 1, 12), '#f6eddc']]; } },
  apple: { name: 'Apple', r: 0.04, h: 0.08, mat: 'fruit', value: 40, roll: true,
    build() { return [[sph(0.04, 0, 0.04, 0, 1, 0.92, 1, 12), pick(['#c8343b', '#d64a3a', '#8bb346'])], [cyl(0.003, 0.002, 0.02, 0.07, 4), '#5a3b25'], [sph(0.01, 0.008, 0.085, 0, 1.6, 0.3, 0.8, 6), '#4f8a52']]; } },
  shaker: { name: 'Salt shaker', r: 0.022, h: 0.08, mat: 'ceramic', value: 60, fragile: 3.0, shard: '#f4efe6',
    build() { const c = pick(['#f4efe6', '#2d2b31']); this.shard = c; return [[cyl(0.02, 0.022, 0.065), c], [sph(0.02, 0, 0.065, 0, 1, 0.7, 1, 10), '#cfd2d4', 'metal']]; } },
  trophy: { name: 'Bowling trophy (2nd place)', r: 0.075, h: 0.32, mat: 'metal', value: 300, mass: 2,
    build() { return [[bx(0.14, 0.06, 0.1), '#3a2a22'], [cyl(0.012, 0.012, 0.08, 0.06, 8), '#d6a73c', 'metal'], [lathe([[0, 0.14], [0.02, 0.14], [0.065, 0.2], [0.07, 0.28], [0.06, 0.28]], 20), '#d6a73c', 'metal'], [torus(0.03, 0.006, 0.07, 0.23, 0, 0, Math.PI).rotateY(0), '#d6a73c', 'metal']]; } },
  snowglobe: { name: 'Snow globe', r: 0.06, h: 0.14, mat: 'glass', value: 350, fragile: 2.2, shard: '#dfeff4', spill: 'water',
    build() { return [[cyl(0.06, 0.05, 0.04), '#70503a'], [bx(0.03, 0.03, 0.03, 0, 0.04, 0), '#c8664b'], [new THREE.ConeGeometry(0.024, 0.02, 4).rotateY(Math.PI / 4).translate(0, 0.08, 0), '#2f3e57'], [sph(0.055, 0, 0.09, 0, 1, 1, 1, 16), '#e9f6fa', 'glass']]; } },
  figurine: { name: 'Porcelain cat (a traitor)', r: 0.045, h: 0.13, mat: 'ceramic', value: 250, fragile: 2.6, shard: '#f4f0e8',
    build() {
      return [[sph(0.035, 0, 0.04, 0, 1, 1.15, 1, 12), '#f4f0e8'], [sph(0.026, 0, 0.095, 0.01, 1.1, 1, 1, 12), '#f4f0e8'],
        [new THREE.ConeGeometry(0.01, 0.022, 3).translate(-0.014, 0.122, 0.008), '#f4f0e8'], [new THREE.ConeGeometry(0.01, 0.022, 3).translate(0.014, 0.122, 0.008), '#f4f0e8'],
        [sph(0.005, -0.01, 0.1, 0.034, 1, 1, 1, 6), '#2f5d9a'], [sph(0.005, 0.01, 0.1, 0.034, 1, 1, 1, 6), '#2f5d9a'], [sph(0.02, 0.0, 0.03, -0.035, 1, 0.6, 1.3, 8), '#f4f0e8']];
    } },
  frame: { name: 'Photo of the Tall One', r: 0.08, h: 0.2, mat: 'wood', value: 120, shard: '#70503a',
    build() { return [[bx(0.16, 0.2, 0.02).rotateX(-0.15), '#70503a'], [bx(0.13, 0.16, 0.003, 0, 0.02, 0.012).rotateX(-0.15), '#e7c9a6'], [sph(0.025, 0, 0.12, 0.02, 1, 1.1, 0.2, 8).rotateX(-0.15), '#7a4c63'], [bx(0.02, 0.1, 0.06, 0, 0, -0.04), '#70503a']]; } },
  speaker: { name: 'Smart speaker', r: 0.06, h: 0.18, mat: 'plastic', value: 100,
    build() { return [[cyl(0.055, 0.058, 0.18, 0, 20), '#55535b'], [cyl(0.05, 0.05, 0.003, 0.18, 20), '#2d2b31'], [torus(0.035, 0.003, 0, 0.183, 0).rotateX(Math.PI / 2), '#6fc3d9', 'glow']]; } },
  cereal: { name: 'Cereal box', r: 0.1, h: 0.29, mat: 'paper', value: 120,
    build() { return [[bx(0.2, 0.29, 0.07), '#e3a64a'], [bx(0.202, 0.07, 0.072, 0, 0.16, 0), '#c8664b'], [sph(0.04, 0, 0.1, 0.036, 1, 1, 0.1, 10), '#f6efe0']]; } },
  bread: { name: 'Loaf of bread', r: 0.12, h: 0.1, mat: 'wood', value: 100,
    build() { return [[rbx(0.24, 0.09, 0.11, 0.04), '#d6a065'], [sph(0.05, 0, 0.08, 0, 2.3, 0.5, 1.05, 12), '#c48a4c']]; } },
  treatjar: { name: 'THE TREAT JAR', r: 0.07, h: 0.17, mat: 'plastic', value: 500, spill: 'treats', shard: '#8a5a33',
    build() { return [[cyl(0.065, 0.065, 0.14, 0, 20), '#d8eef0', 'glass'], [cyl(0.055, 0.055, 0.1, 0.01, 16), '#8a5a33'], [cyl(0.07, 0.07, 0.03, 0.14, 20), '#c8343b'], [sph(0.015, 0, 0.175, 0, 1, 0.6, 1, 8), '#c8343b']]; } },
  teapot: { name: "Grandma's teapot", r: 0.09, h: 0.17, mat: 'ceramic', value: 300, fragile: 2.6, shard: '#f1e8d6',
    build() { return [[sph(0.075, 0, 0.07, 0, 1, 0.9, 1, 16), '#f1e8d6'], [cyl(0.02, 0.008, 0.08, 0, 8).rotateZ(-0.8).translate(0.085, 0.06, 0), '#f1e8d6'], [torus(0.04, 0.008, -0.075, 0.08, 0).rotateY(0), '#f1e8d6'], [sph(0.035, 0, 0.13, 0, 1, 0.5, 1, 10), '#3f8079'], [sph(0.01, 0, 0.155, 0, 1, 1, 1, 6), '#3f8079'], [cyl(0.076, 0.076, 0.012, 0.07, 18), '#3f8079']]; } },
  basket: { name: 'Wicker basket', r: 0.12, h: 0.12, mat: 'wood', value: 80,
    build() { const p = [[cyl(0.1, 0.12, 0.12, 0, 16), '#c49a5c']]; for (let i = 0; i < 4; i++) p.push([cyl(0.1 + i * 0.006, 0.1 + i * 0.006 + 0.004, 0.012, 0.02 + i * 0.03, 16), '#a87e45']); return p; } },
  pencilcup: { name: 'Pencil cup', r: 0.04, h: 0.17, mat: 'metal', value: 90,
    build() { const p = [[cyl(0.038, 0.038, 0.1), '#3f8079']]; ['#e3a64a', '#c8664b', '#2f3e57', '#8fae8f'].forEach((c, i) => { const a = i * 1.6; p.push([cyl(0.004, 0.004, 0.16, 0, 6, Math.cos(a) * 0.018, Math.sin(a) * 0.018).rotateX(0.08 * (i - 1.5)), c]); }); return p; } },
  stapler: { name: 'Stapler', r: 0.075, h: 0.05, mat: 'metal', value: 60, flat: true,
    build() { return [[rbx(0.04, 0.03, 0.15, 0.01), '#2d2b31'], [rbx(0.036, 0.02, 0.15, 0.008, 0, 0.03, 0), '#c8343b']]; } },
  magazine: { name: 'Magazine', r: 0.13, h: 0.012, mat: 'paper', value: 50, flat: true,
    build() { return [[bx(0.21, 0.012, 0.28), '#f6efe0'], [bx(0.19, 0.002, 0.15, 0, 0.012, -0.03), pick(['#3f8079', '#c8664b', '#7a4c63'])]]; } },
  keybowl: { name: 'Bowl of keys', r: 0.08, h: 0.05, mat: 'ceramic', value: 120, fragile: 3.0, shard: '#e3a64a',
    build() { return [[lathe([[0, 0], [0.045, 0], [0.08, 0.045], [0.075, 0.048], [0, 0.01]], 20), '#e3a64a'], [torus(0.015, 0.003, 0.01, 0.02, 0).rotateX(1.2), '#cfd2d4', 'metal'], [bx(0.008, 0.003, 0.04, -0.01, 0.02, 0.01).rotateY(0.6), '#cfd2d4', 'metal']]; } },
  yarn: { name: 'Ball of yarn', r: 0.065, h: 0.13, mat: 'paper', value: 0, roll: true, toy: true,
    build() { const p = [[sph(0.065, 0, 0.065, 0, 1, 1, 1, 14), '#d9545b']]; for (let i = 0; i < 4; i++) p.push([torus(0.064, 0.004, 0, 0.065, 0).rotateX(i * 0.8).rotateZ(i * 0.5).translate(0, 0, 0), '#b8424a']); return p; } },
};

// Where everything starts: [type, x, surfaceY, z, rotY]
const LAYOUT = [
  // the summit: bookcase top
  ['fancyvase', -6.05, 2.15, -4.8], ['trophy', -6.6, 2.15, -4.8], ['plant', -5.6, 2.15, -4.78],
  // floating shelves
  ['plant', -6.86, 1.35, -2.2], ['book', -6.86, 1.35, -2.55, 1.57],
  ['snowglobe', -6.86, 1.8, -3.4], ['figurine', -6.86, 1.8, -3.75, 1.57],
  // sideboard
  ['vase', -6.75, 0.8, -3.4], ['frame', -6.85, 0.8, -2.9, 1.57], ['candle', -6.62, 0.8, -2.45],
  // TV stand
  ['speaker', -4.8, 0.5, -4.74], ['cactus', -3.25, 0.5, -4.72], ['remote', -3.6, 0.5, -4.66, 1.4],
  // coffee table
  ['mug', -4.2, 0.42, -0.85], ['glass', -3.6, 0.42, -1.12], ['remote', -3.9, 0.42, -0.78, 0.3], ['magazine', -4.17, 0.42, -1.1, 0.2], ['phone', -3.52, 0.42, -0.76, -0.4], ['cactus', -3.88, 0.42, -1.16],
  // side table
  ['mug', -2.3, 0.55, 1.12], ['book', -2.24, 0.55, 1.34, 0.4], ['candle', -2.42, 0.55, 1.38],
  // dining table
  ['plate', 0.45, 0.75, 0.56], ['plate', 1.25, 0.75, 1.0], ['glass', 0.64, 0.75, 0.43], ['wineglass', 1.06, 0.75, 1.13],
  ['vase', 0.86, 0.75, 0.78], ['shaker', 1.0, 0.75, 0.58], ['shaker', 1.06, 0.75, 0.6], ['candle', 0.58, 0.75, 0.98], ['candle', 1.32, 0.75, 0.52],
  // kitchen island
  ['fish', 4.3, 0.92, -1.9, 0.3], ['egg', 3.8, 0.92, -1.6], ['egg', 3.86, 0.92, -1.63], ['egg', 3.83, 0.92, -1.55],
  ['apple', 4.8, 0.92, -2.2], ['apple', 4.72, 0.92, -2.15], ['apple', 4.83, 0.92, -2.11],
  ['wineglass', 4.75, 0.92, -1.6], ['mug', 3.8, 0.92, -2.2], ['shaker', 4.05, 0.92, -2.25], ['book', 4.5, 0.92, -2.27, 0.2],
  // counters
  ['kettle', 6.68, 0.93, -0.25], ['toaster', 6.7, 0.92, -3.0, 1.57], ['jar', 6.86, 0.92, -3.8], ['jar', 6.86, 0.92, -3.66], ['jar', 6.86, 0.92, -3.52],
  ['mug', 6.55, 0.92, -1.5], ['bottle', 6.6, 0.92, -2.2], ['plant', 6.8, 0.92, 0.5],
  ['mug', 3.6, 0.92, -4.6], ['mug', 3.78, 0.92, -4.75], ['jar', 5.3, 0.92, -4.7], ['bottle', 5.6, 0.92, -4.75],
  ['cactus', 4.0, 1.2, -4.93], ['cactus', 5.0, 1.2, -4.93],
  // high places
  ['teapot', 6.82, 2.25, -3.05], ['basket', 6.82, 2.25, -3.65],
  ['cereal', 6.75, 1.85, 1.22, 1.57], ['bread', 6.55, 1.85, 1.55, 1.57], ['treatjar', 6.85, 1.85, 1.55],
  // desk
  ['pencilcup', -6.8, 0.75, 4.8], ['mug', -5.85, 0.75, 4.42], ['cactus', -5.8, 0.75, 4.8], ['stapler', -6.75, 0.75, 4.45],
  // windowsills
  ['plant', -2.3, 0.65, -4.85], ['bottle', -1.1, 0.65, -4.86], ['cactus', 0.1, 0.65, -4.86], ['frame', 1.3, 0.65, -4.84, 0],
  // shoe rack
  ['keybowl', 5.75, 0.42, 4.8],
  // toys
  ['yarn', -0.6, 0, 2.0],
];

export class Items {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.debris = new Debris(scene, world);
    this.decals = new Decals(scene);
    this.onLand = null;   // (item, impact, dropped, broke)
    this.onSound = null;  // (material, speed, pos, shatter)
    for (const [type, x, y, z, ry = rnd(-0.6, 0.6)] of LAYOUT) this._spawn(type, x, y, z, ry);
  }

  _spawn(type, x, y, z, ry) {
    const def = TYPES[type];
    const local = Object.create(def);
    const group = assemble(def.build.call(local), def.h);
    group.quaternion.setFromAxisAngle(UP, ry);
    this.scene.add(group);
    const it = {
      type, def, mesh: group, shard: local.shard || def.shard || '#cccccc',
      home: new THREE.Vector3(x, y + def.h / 2, z), homeRot: ry,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), ang: new THREE.Vector3(),
      hh: def.h / 2, lying: false, awake: false, grounded: true, broken: false, scored: false,
      startY: y, maxY: y, rest: 0, mass: def.mass || 1, rollAngle: 0, restQ: new THREE.Quaternion(), lastHit: -10,
    };
    this.list.push(it);
    this._reset(it);
    return it;
  }

  _reset(it) {
    it.pos.copy(it.home);
    it.vel.set(0, 0, 0);
    it.ang.set(0, 0, 0);
    it.hh = it.def.h / 2;
    it.lying = false; it.awake = false; it.grounded = true; it.broken = false; it.scored = false;
    it.startY = it.home.y - it.def.h / 2; it.maxY = it.startY; it.rest = 0; it.rollAngle = 0;
    it.mesh.visible = true;
    it.mesh.quaternion.setFromAxisAngle(UP, it.homeRot);
    it.restQ.copy(it.mesh.quaternion);
    it.mesh.position.copy(it.pos);
  }

  reset() {
    for (const it of this.list) this._reset(it);
    this.debris.clear();
    this.decals.clear();
  }

  /** Add a velocity to an item and wake it up. */
  push(it, vx, vy, vz, spin = 0) {
    if (it.broken) return;
    const k = 1 / it.mass;
    it.vel.x += vx * k; it.vel.y += vy * k; it.vel.z += vz * k;
    if (spin) it.ang.set(rnd(-1, 1), rnd(-0.5, 0.5), rnd(-1, 1)).normalize().multiplyScalar(spin * k);
    it.awake = true;
    it.rest = 0;
  }

  update(dt, time) {
    const W = this.world;
    for (const it of this.list) {
      if (!it.awake || it.broken) continue;
      const d = it.def;
      it.vel.y -= G * dt;
      const prevBottom = it.pos.y - it.hh;
      it.pos.addScaledVector(it.vel, dt);
      const bottom = it.pos.y - it.hh;
      const top = it.pos.y + it.hh;
      // sideways contacts with furniture and walls
      for (const c of W.colliders) {
        if (c.y1 <= bottom + 0.03 || c.y0 >= top) continue;
        const cx = Math.max(c.x0, Math.min(it.pos.x, c.x1));
        const cz = Math.max(c.z0, Math.min(it.pos.z, c.z1));
        const dx = it.pos.x - cx, dz = it.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= d.r * d.r) continue;
        if (d2 < 1e-10) {
          // inside a box: pop up on top of it if we are near its top, else push out sideways
          if (c.y1 - bottom < 0.12) { it.pos.y = c.y1 + it.hh; continue; }
          const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
          if (Math.abs(it.pos.x - mx) / (c.x1 - c.x0) > Math.abs(it.pos.z - mz) / (c.z1 - c.z0)) it.pos.x = it.pos.x > mx ? c.x1 + d.r : c.x0 - d.r;
          else it.pos.z = it.pos.z > mz ? c.z1 + d.r : c.z0 - d.r;
          continue;
        }
        const dd = Math.sqrt(d2);
        const nx = dx / dd, nz = dz / dd;
        it.pos.x += nx * (d.r - dd);
        it.pos.z += nz * (d.r - dd);
        const vn = it.vel.x * nx + it.vel.z * nz;
        if (vn < 0) {
          it.vel.x -= 1.5 * vn * nx;
          it.vel.z -= 1.5 * vn * nz;
          if (-vn > 1.2 && time - it.lastHit > 0.15) { it.lastHit = time; this.onSound?.(d.mat, -vn * 0.6, it.pos, false); }
        }
      }
      // item vs item
      for (const o of this.list) {
        if (o === it || o.broken) continue;
        const dx = o.pos.x - it.pos.x, dz = o.pos.z - it.pos.z;
        const rr = d.r + o.def.r;
        if (dx * dx + dz * dz >= rr * rr) continue;
        if (Math.abs(o.pos.y - it.pos.y) > o.hh + it.hh) continue;
        const dd = Math.sqrt(dx * dx + dz * dz) || 1e-4;
        const nx = dx / dd, nz = dz / dd;
        const pen = rr - dd;
        it.pos.x -= nx * pen * 0.5; it.pos.z -= nz * pen * 0.5;
        o.pos.x += nx * pen * 0.5; o.pos.z += nz * pen * 0.5;
        const rel = (it.vel.x - o.vel.x) * nx + (it.vel.z - o.vel.z) * nz;
        if (rel > 0) {
          const imp = rel * 0.6;
          it.vel.x -= nx * imp; it.vel.z -= nz * imp;
          this.push(o, nx * imp * it.mass, 0, nz * imp * it.mass);
          if (rel > 0.8 && time - it.lastHit > 0.15) { it.lastHit = time; this.onSound?.(d.mat, rel, it.pos, false); }
        }
      }
      // support underneath
      const nb = it.pos.y - it.hh;
      const ground = W.groundAt(it.pos.x, it.pos.z, Math.max(nb, prevBottom) + 0.06, 0);
      if (nb <= ground) {
        const impact = -it.vel.y;
        it.pos.y = ground + it.hh;
        const dropped = it.maxY - ground;
        if (!it.grounded || impact > 0.5) {
          // landing
          if (impact > 1.0) this.onSound?.(d.mat, impact, it.pos, false);
          if (d.fragile && impact > d.fragile) { this._break(it, ground, impact); continue; }
          if (impact > 1.6 && (d.spill === 'soil' || d.spill === 'treats') && !it.spilled) this._spill(it, ground);
          if (dropped > 0.25 && !it.lying && !d.flat && !d.roll) this._lie(it);
          if (!it.scored && it.startY - ground > 0.25) {
            it.scored = true;
            this.onLand?.(it, impact, it.startY - ground, false);
          }
        }
        it.vel.y = impact > 1.2 ? impact * 0.22 : 0;
        it.grounded = it.vel.y === 0;
        if (it.grounded) it.maxY = ground;
        const fr = d.roll || (it.lying && !d.flat && it.def.h > it.def.r * 2) ? 0.8 : 5.5;
        const sp = Math.hypot(it.vel.x, it.vel.z);
        const ns = Math.max(0, sp - fr * dt * (it.grounded ? 1 : 0.3));
        if (sp > 1e-5) { it.vel.x *= ns / sp; it.vel.z *= ns / sp; }
      } else {
        if (it.grounded && nb - ground > 0.02) it.grounded = false;
        if (!it.grounded) it.maxY = Math.max(it.maxY, nb);
      }
      // orientation
      if (!it.grounded) {
        const w = it.ang.length();
        if (w > 1e-4) {
          _q.setFromAxisAngle(_v.copy(it.ang).divideScalar(w), w * dt);
          it.mesh.quaternion.premultiply(_q);
        }
      } else {
        const sp = Math.hypot(it.vel.x, it.vel.z);
        if (d.roll && sp > 0.01) {
          // spheres roll about the axis across their motion
          _v.set(it.vel.z, 0, -it.vel.x).normalize();
          _q.setFromAxisAngle(_v, (sp / d.r) * dt);
          it.mesh.quaternion.premultiply(_q);
          it.restQ.copy(it.mesh.quaternion);
        } else if (it.lying && !d.flat && sp > 0.01) {
          it.rollAngle += (sp / d.r) * dt;
          _q2.setFromAxisAngle(UP, it.rollAngle);
          it.mesh.quaternion.copy(it.restQ).multiply(_q2);
        } else {
          it.mesh.quaternion.slerp(it.restQ, 1 - Math.exp(-14 * dt));
        }
        it.ang.multiplyScalar(Math.exp(-8 * dt));
      }
      // the lying half-height eases in
      const targetHH = it.lying ? d.r * 0.9 : d.h / 2;
      it.hh += (targetHH - it.hh) * (1 - Math.exp(-14 * dt));
      // room bounds and safety
      it.pos.x = Math.max(-6.98 + d.r, Math.min(6.98 - d.r, it.pos.x));
      it.pos.z = Math.max(-4.98 + d.r, Math.min(4.98 - d.r, it.pos.z));
      if (it.pos.y < it.hh) { it.pos.y = it.hh; it.vel.y = Math.max(0, it.vel.y); }
      it.mesh.position.copy(it.pos);
      // sleep
      if (it.grounded && Math.hypot(it.vel.x, it.vel.z) < 0.03) {
        it.rest += dt;
        if (it.rest > 0.4) { it.awake = false; it.vel.set(0, 0, 0); it.mesh.quaternion.copy(it.restQ); }
      } else it.rest = 0;
    }
    this.debris.update(dt);
    this.decals.update(dt);
  }

  _lie(it) {
    it.lying = true;
    const yaw = Math.atan2(it.vel.x, it.vel.z) + Math.PI / 2 + rnd(-0.3, 0.3);
    _q.setFromAxisAngle(UP, yaw);
    _q2.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    it.restQ.copy(_q).multiply(_q2);
    it.rollAngle = rnd(0, Math.PI * 2);
    _q2.setFromAxisAngle(UP, it.rollAngle);
    it.restQ.multiply(_q2);
  }

  _break(it, ground, impact) {
    it.broken = true;
    it.mesh.visible = false;
    it.awake = false;
    const p = _v.set(it.pos.x, ground, it.pos.z);
    const n = Math.round(10 + it.def.r * 120);
    this.debris.burst(p, it.shard, n, 0.6 + impact * 0.25, it.def.r);
    if (it.def.spill) this.decals.add(it.def.spill, p.x, p.z, it.def.r * 4);
    this.onSound?.(it.def.mat, impact, it.pos, true);
    if (!it.scored && it.startY - ground > 0.25) {
      it.scored = true;
      this.onLand?.(it, impact, it.startY - ground, true);
    } else this.onLand?.(it, impact, 0, true);
  }

  _spill(it, ground) {
    it.spilled = true;
    const p = _v.set(it.pos.x, ground, it.pos.z);
    if (it.def.spill === 'soil') {
      this.debris.burst(p, '#5a3b25', 16, 1.2, 0.05, 0.5);
      this.decals.add('soil', p.x, p.z, 0.22);
    } else if (it.def.spill === 'treats') {
      this.debris.burst(p, '#8a5a33', 30, 1.8, 0.05, 0.9);
    }
  }

  /** Items touching a vertical cylinder; used by the cat and the robot. */
  near(x, y, z, r, h) {
    const out = [];
    for (const it of this.list) {
      if (it.broken) continue;
      if (it.pos.y + it.hh < y || it.pos.y - it.hh > y + h) continue;
      const dx = it.pos.x - x, dz = it.pos.z - z;
      const rr = r + it.def.r;
      if (dx * dx + dz * dz < rr * rr) out.push(it);
    }
    return out;
  }
}

// ---------- shards and spills ----------

class Debris {
  constructor(scene, world) {
    this.world = world;
    this.max = 900;
    const g = new THREE.TetrahedronGeometry(1, 0);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.35 }), this.max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.p = [];
    this._m = new THREE.Matrix4();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
    this._qq = new THREE.Quaternion();
  }

  clear() { this.p.length = 0; this.mesh.count = 0; }

  burst(pos, color, n, speed, spread, size = 1) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * rnd(0.3, 1);
      this.p.push({
        x: pos.x + Math.cos(a) * spread * 0.5, y: pos.y + 0.03, z: pos.z + Math.sin(a) * spread * 0.5,
        vx: Math.cos(a) * s, vy: rnd(0.5, 2.2) * speed * 0.6, vz: Math.sin(a) * s,
        rx: rnd(0, 6), ry: rnd(0, 6), rz: rnd(0, 6), w: rnd(4, 14),
        size: rnd(0.006, 0.018) * size, col: c.clone().multiplyScalar(rnd(0.85, 1.1)), rest: false, alive: true,
      });
    }
    this.dirty = true;
  }

  /** The robot vacuum eats shards. Returns how many it ate. */
  suck(x, z, r) {
    let n = 0;
    for (const p of this.p) {
      if (!p.alive || p.y > 0.08) continue;
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < r * r) { p.alive = false; n++; }
    }
    if (n) { this.p = this.p.filter((p) => p.alive); this.dirty = true; }
    return n;
  }

  update(dt) {
    let moving = false;
    for (const p of this.p) {
      if (p.rest) continue;
      moving = true;
      p.vy -= G * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.w * dt; p.rz += p.w * 0.7 * dt;
      if (p.x < -6.98 || p.x > 6.98) { p.vx *= -0.4; p.x = Math.max(-6.98, Math.min(6.98, p.x)); }
      if (p.z < -4.98 || p.z > 4.98) { p.vz *= -0.4; p.z = Math.max(-4.98, Math.min(4.98, p.z)); }
      const g = this.world.groundAt(p.x, p.z, p.y + 0.02, 0) + p.size * 0.4;
      if (p.y <= g) {
        p.y = g;
        if (Math.abs(p.vy) < 0.6) { p.rest = true; p.rx = Math.round(p.rx / Math.PI) * Math.PI + 0.3; }
        p.vy = -p.vy * 0.3; p.vx *= 0.5; p.vz *= 0.5; p.w *= 0.5;
      }
    }
    if (!moving && !this.dirty) return;
    this.dirty = false;
    const m = this._m;
    this.p.forEach((p, i) => {
      this._qq.setFromEuler(this._e.set(p.rx, p.ry, p.rz));
      m.compose(this._s.set(p.x, p.y, p.z), this._qq, new THREE.Vector3(p.size, p.size * 0.5, p.size));
      this.mesh.setMatrixAt(i, m);
      this.mesh.setColorAt(i, p.col);
    });
    this.mesh.count = this.p.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

class Decals {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.n = 0;
  }

  _shape(kind) {
    const pts = [];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = kind === 'water' ? rnd(0.75, 1) : kind === 'egg' ? rnd(0.7, 1) : rnd(0.55, 1);
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    g.rotateX(-Math.PI / 2);
    return g;
  }

  add(kind, x, z, size) {
    const col = kind === 'water' ? '#9cc9dc' : kind === 'egg' ? '#f6efd9' : '#5a3b25';
    const mat = new THREE.MeshStandardMaterial({
      color: col, roughness: kind === 'soil' ? 1 : 0.08, transparent: kind === 'water', opacity: kind === 'water' ? 0.55 : 1,
      polygonOffset: true, polygonOffsetFactor: -2 - this.n, depthWrite: kind !== 'water',
    });
    const mesh = new THREE.Mesh(this._shape(kind), mat);
    mesh.position.set(x, 0.004 + (this.n % 10) * 0.0004, z);
    mesh.rotation.y = rnd(0, 6.28);
    mesh.receiveShadow = true;
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    const d = { mesh, size, t: 0 };
    this.list.push(d);
    if (kind === 'egg') {
      const yolk = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f2b230', roughness: 0.1, polygonOffset: true, polygonOffsetFactor: -12 }));
      yolk.position.set(rnd(-0.2, 0.2), 0.001, rnd(-0.2, 0.2));
      mesh.add(yolk);
    }
    this.n++;
  }

  clear() {
    for (const d of this.list) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); d.mesh.material.dispose(); }
    this.list.length = 0;
    this.n = 0;
  }

  update(dt) {
    for (const d of this.list) {
      if (d.t >= 1) continue;
      d.t = Math.min(1, d.t + dt * 1.6);
      d.mesh.scale.setScalar(d.size * (1 - Math.pow(1 - d.t, 3)));
    }
  }
}
