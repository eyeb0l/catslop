// The flat: geometry, colliders, light, sky and the moving sunbeams.
// Static furniture is built from boxes and merged per material, so the whole
// room costs a few dozen draw calls. Every box that can be stood on or bumped
// into is also an axis-aligned collider.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const ROOM = { x0: -7, x1: 7, z0: -5, z1: 5, h: 2.8 };
// things too thin to stand on, and things a pounce should never aim at
export const SKIP_STAND = new Set(['wall', 'box', 'chairback', 'tv', 'lamp', 'post']);
export const SKIP_AIM = new Set(['wall', 'box', 'chairback', 'tv', 'lamp', 'post', 'hood']);
export const SKIP_CLEAR = new Set(['wall']);
export const WINDOWS = [
  { x0: -2.6, x1: -0.8, y0: 0.65, y1: 2.35 },
  { x0: -0.2, x1: 1.6, y0: 0.65, y1: 2.35 },
  { x0: 3.7, x1: 5.3, y0: 1.2, y1: 2.3 },
];
const WALL_Z = -5;
const C = (h) => new THREE.Color(h);
// time of day: [t, sun colour, sun intensity, sky top, sky horizon, fill intensity]
const DAY_KEYS = [
  [0.0, C('#ffe5bd'), 2.7, C('#8cc0ea'), C('#f4e2c4'), 1.15],
  [0.4, C('#fff6e6'), 3.2, C('#79b4ea'), C('#e8eff1'), 1.25],
  [0.75, C('#ffd9a6'), 3.0, C('#87acd6'), C('#f7d9b0'), 1.1],
  [1.0, C('#ff9550'), 2.6, C('#6c78b6'), C('#ffaf78'), 0.8],
];
const HEMI_A = C('#fff4e4'), HEMI_B = C('#ffd2b0');
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

// ---------- procedural textures ----------

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function floorTexture() {
  return canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -Math.random() * 400;
      while (x < w) {
        const len = rnd(260, 520);
        const l = rnd(-4.5, 4.5);
        g.fillStyle = `hsl(${rnd(27, 31)}, ${rnd(40, 47)}%, ${55 + l}%)`;
        g.fillRect(x, r * rh, len, rh);
        // grain
        g.globalAlpha = 0.12;
        for (let k = 0; k < 9; k++) {
          g.strokeStyle = Math.random() < 0.5 ? '#5a3418' : '#f3c58f';
          g.lineWidth = rnd(1, 3);
          g.beginPath();
          const y0 = r * rh + rnd(4, rh - 4);
          g.moveTo(x, y0);
          g.bezierCurveTo(x + len * 0.3, y0 + rnd(-6, 6), x + len * 0.6, y0 + rnd(-6, 6), x + len, y0 + rnd(-4, 4));
          g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(60,30,10,0.4)';
        g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(60,30,10,0.5)';
      g.fillRect(0, r * rh, w, 3);
    }
  }, 7, 5.5);
}

function tileTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9d2c5';
    g.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let y = 0; y < n * 2; y++) for (let x = 0; x < n; x++) {
      const off = (y % 2) * s * 0.5;
      g.fillStyle = `hsl(${rnd(160, 175)}, ${rnd(18, 26)}%, ${rnd(80, 86)}%)`;
      g.fillRect(x * s + off + 2, y * s * 0.5 + 2, s - 4, s * 0.5 - 4);
      if (off) g.fillRect(off - s + 2, y * s * 0.5 + 2, s - 4, s * 0.5 - 4);
    }
  }, 4, 2);
}

function rugTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const cols = ['#c8664b', '#efe1c6', '#e3a64a', '#efe1c6', '#3f8079', '#efe1c6', '#c8664b', '#f4ead6'];
    for (let i = 0; i < cols.length; i++) {
      g.fillStyle = cols[i];
      g.beginPath();
      g.arc(cx, cy, (w / 2) * (1 - i / cols.length), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 0.18;
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
      g.fillRect(rnd(0, w), rnd(0, h), 2, 2);
    }
  });
}

function runnerTexture() {
  return canvasTex(256, 1024, (g, w, h) => {
    g.fillStyle = '#35576b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9dcc0';
    g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#35576b';
    g.fillRect(24, 24, w - 48, h - 48);
    for (let y = 60; y < h - 60; y += 64) {
      g.fillStyle = '#d9a441';
      g.beginPath();
      g.moveTo(w / 2, y); g.lineTo(w / 2 + 40, y + 32); g.lineTo(w / 2, y + 64); g.lineTo(w / 2 - 40, y + 32);
      g.fill();
      g.fillStyle = '#c8664b';
      g.fillRect(w / 2 - 8, y + 24, 16, 16);
    }
  });
}

function sisalTexture() {
  return canvasTex(64, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = `hsl(38, 40%, ${rnd(55, 68)}%)`;
      g.fillRect(0, y, w, 4);
    }
  }, 1, 4);
}

function artTexture(kind) {
  return canvasTex(256, 320, (g, w, h) => {
    if (kind === 0) {
      g.fillStyle = '#2f5d73'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8875a';
      g.beginPath(); g.ellipse(120, 170, 70, 38, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(180, 170); g.lineTo(230, 130); g.lineTo(230, 210); g.fill();
      g.fillStyle = '#f6efe0'; g.beginPath(); g.arc(85, 160, 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#9fd0d9';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(60 + i * 15, 90 - i * 10, 5 + i, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 1) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#f7c873'); gr.addColorStop(1, '#ea7f5d');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff2c9'; g.beginPath(); g.arc(160, 120, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a4c63';
      g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(90, 150, 170, 230); g.quadraticCurveTo(220, 190, 256, 220); g.lineTo(256, 320); g.lineTo(0, 320); g.fill();
      g.fillStyle = '#4b3550';
      g.beginPath(); g.moveTo(0, 270); g.quadraticCurveTo(120, 220, 256, 280); g.lineTo(256, 320); g.lineTo(0, 320); g.fill();
    } else {
      g.fillStyle = '#efe6d4'; g.fillRect(0, 0, w, h);
      const cols = ['#c8664b', '#3f8079', '#e3a64a', '#2f3e57'];
      for (let i = 0; i < 7; i++) {
        g.fillStyle = cols[i % 4];
        g.globalAlpha = 0.9;
        g.beginPath(); g.arc(rnd(40, 216), rnd(40, 280), rnd(18, 60), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = '#2f3e57'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(30, 260); g.bezierCurveTo(90, 120, 170, 300, 230, 60); g.stroke();
    }
  });
}

// ---------- the world ----------

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = [];
    this.bins = new Map();
    this.dynamic = new THREE.Group();
    scene.add(this.dynamic);
    this._makeMaterials();
    this._buildRoom();
    this._buildLiving();
    this._buildKitchen();
    this._buildMisc();
    this._buildOutside();
    this._flush();
    this._buildLights();
    this._buildBeams();
    this.sunDir = new THREE.Vector3(0, 1, -1).normalize(); // points toward the sun
    this.setTime(0);
  }

  _makeMaterials() {
    const std = (color, r = 0.85, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
    this.m = {
      floor: std(0xffffff, 0.7, 0, { map: floorTexture() }),
      wall: std('#f0e2cc', 0.95),
      wallGreen: std('#a9c4ae', 0.95),
      tile: std(0xffffff, 0.4, 0, { map: tileTexture() }),
      ceiling: std('#f6eee2', 1),
      trim: std('#fbf6ec', 0.6),
      oak: std('#c8925e', 0.6),
      walnut: std('#70503a', 0.55),
      sage: std('#8fae8f', 0.65),
      top: std('#f2eee7', 0.35),
      terracotta: std('#c8664b', 0.95),
      terraDark: std('#a9533c', 0.95),
      mustard: std('#dba642', 0.95),
      teal: std('#3f8079', 0.9),
      cream: std('#efe1c6', 0.95),
      metal: std('#cfd2d4', 0.3, 0.8),
      dark: std('#2d2b31', 0.45),
      screen: std('#14171f', 0.15, 0.2),
      fridge: std('#f3e4c3', 0.35),
      cardboard: std('#c99e6c', 1),
      cardboardIn: std('#a87e52', 1),
      sisal: std(0xffffff, 1, 0, { map: sisalTexture() }),
      rug: std(0xffffff, 1, 0, { map: rugTexture() }),
      runner: std(0xffffff, 1, 0, { map: runnerTexture() }),
      leaf: std('#5f8f4e', 0.75),
      leafDark: std('#43703c', 0.75),
      pot: std('#c9744f', 0.9),
      potWhite: std('#ece6da', 0.5),
      grass: std('#93be6a', 1),
      hedge: std('#5d9150', 0.95),
      trunk: std('#7a5a3f', 1),
      fence: std('#f2ebdf', 0.9),
      house: std('#e8b8a0', 0.95),
      house2: std('#a9c1d6', 0.95),
      roof: std('#8b5b4f', 0.95),
      glassFrame: std('#fbf8f2', 0.5),
      door: std('#3f6f69', 0.6),
      laptop: std('#b9bec4', 0.35, 0.6),
      art0: std(0xffffff, 0.8, 0, { map: artTexture(0) }),
      art1: std(0xffffff, 0.8, 0, { map: artTexture(1) }),
      art2: std(0xffffff, 0.8, 0, { map: artTexture(2) }),
    };
    this.lampShade = new THREE.MeshStandardMaterial({ color: '#fbe5bd', roughness: 0.9, emissive: new THREE.Color('#ffc477'), emissiveIntensity: 0, side: THREE.DoubleSide });
    this.bulb = new THREE.MeshBasicMaterial({ color: '#fff3d6' });
  }

  // ---------- builders ----------

  geo(g, mat, { cast = true, receive = true } = {}) {
    const key = `${mat.uuid}|${cast}|${receive}`;
    if (!this.bins.has(key)) this.bins.set(key, { mat, cast, receive, geos: [] });
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(name)) ng.deleteAttribute(name);
    this.bins.get(key).geos.push(ng);
  }

  box(x0, x1, y0, y1, z0, z1, mat, o = {}) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    let g;
    if (o.round) {
      const r = Math.min(o.round, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002);
      g = new RoundedBoxGeometry(w, h, d, 3, r);
    } else g = new THREE.BoxGeometry(w, h, d);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    if (o.visible !== false) this.geo(g, mat, o);
    if (o.collide !== false) this.colliders.push({ x0, x1, y0, y1, z0, z1, tag: o.tag || '' });
  }

  collider(x0, x1, y0, y1, z0, z1, tag = '') {
    this.colliders.push({ x0, x1, y0, y1, z0, z1, tag });
  }

  cyl(x, y0, z, r0, r1, h, mat, o = {}) {
    const g = new THREE.CylinderGeometry(r1, r0, h, o.seg || 20);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    g.translate(x, y0 + h / 2, z);
    this.geo(g, mat, o);
  }

  sphere(x, y, z, r, mat, sx = 1, sy = 1, sz = 1, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 14, o.seg ? Math.max(6, o.seg >> 1) : 10);
    g.scale(sx, sy, sz);
    if (o.ry) g.rotateY(o.ry);
    if (o.rx) g.rotateX(o.rx);
    if (o.rz) g.rotateZ(o.rz);
    g.translate(x, y, z);
    this.geo(g, mat, o);
  }

  table(x0, x1, z0, z1, top, mat, tag, legMat = mat, thick = 0.04, leg = 0.045) {
    this.box(x0, x1, top - thick, top, z0, z1, mat, { tag, round: 0.012 });
    const i = 0.05;
    for (const [lx, lz] of [[x0 + i, z0 + i], [x1 - i, z0 + i], [x0 + i, z1 - i], [x1 - i, z1 - i]]) {
      this.box(lx - leg / 2, lx + leg / 2, 0, top - thick, lz - leg / 2, lz + leg / 2, legMat, { tag: 'leg' });
    }
  }

  chair(cx, cz, facing, mat) {
    // facing: +1 the sitter faces +z, -1 faces -z
    const s = 0.21;
    this.box(cx - s, cx + s, 0.42, 0.46, cz - s, cz + s, mat, { tag: 'chair', round: 0.01 });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      this.box(cx + lx * (s - 0.03) - 0.016, cx + lx * (s - 0.03) + 0.016, 0, 0.42, cz + lz * (s - 0.03) - 0.016, cz + lz * (s - 0.03) + 0.016, mat, { tag: 'leg' });
    }
    const bz = cz - facing * (s - 0.02);
    this.box(cx - s, cx + s, 0.46, 0.92, bz - 0.02, bz + 0.02, mat, { tag: 'chairback', round: 0.01 });
  }

  plant(x, y, z, scale = 1, kind = 0) {
    // purely decorative greenery
    if (kind === 0) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rnd(-0.3, 0.3);
        const r = rnd(0.12, 0.22) * scale;
        const hgt = rnd(0.35, 0.7) * scale;
        this.cyl(x + Math.cos(a) * r * 0.4, y, z + Math.sin(a) * r * 0.4, 0.008 * scale, 0.006 * scale, hgt, this.m.leafDark, { seg: 5, cast: false });
        this.sphere(x + Math.cos(a) * r, y + hgt, z + Math.sin(a) * r, 0.13 * scale, i % 2 ? this.m.leaf : this.m.leafDark, 1, 0.25, 0.75, { ry: -a, rz: rnd(-0.4, 0.4), seg: 10 });
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const a = rnd(0, Math.PI * 2);
        const g = new THREE.ConeGeometry(0.035 * scale, rnd(0.4, 0.75) * scale, 4);
        g.scale(1, 1, 0.35);
        g.rotateY(a);
        g.rotateX(rnd(-0.15, 0.15));
        g.rotateZ(rnd(-0.15, 0.15));
        g.translate(x + rnd(-0.06, 0.06) * scale, y + 0.25 * scale, z + rnd(-0.06, 0.06) * scale);
        this.geo(g, i % 2 ? this.m.leaf : this.m.leafDark);
      }
    }
  }

  art(x, y, z, w, h, mat, axis) {
    // a framed print on a wall. axis: 'x+' means the wall normal is +x
    const t = 0.03;
    if (axis === 'x+') {
      this.box(x, x + t, y - h / 2 - 0.03, y + h / 2 + 0.03, z - w / 2 - 0.03, z + w / 2 + 0.03, this.m.walnut, { collide: false });
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(Math.PI / 2);
      g.translate(x + t + 0.002, y, z);
      this.geo(g, mat, { cast: false });
    } else if (axis === 'z-') {
      this.box(x - w / 2 - 0.03, x + w / 2 + 0.03, y - h / 2 - 0.03, y + h / 2 + 0.03, z - t, z, this.m.walnut, { collide: false });
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(Math.PI);
      g.translate(x, y, z - t - 0.002);
      this.geo(g, mat, { cast: false });
    } else if (axis === 'x-') {
      this.box(x - t, x, y - h / 2 - 0.03, y + h / 2 + 0.03, z - w / 2 - 0.03, z + w / 2 + 0.03, this.m.walnut, { collide: false });
      const g = new THREE.PlaneGeometry(w, h);
      g.rotateY(-Math.PI / 2);
      g.translate(x - t - 0.002, y, z);
      this.geo(g, mat, { cast: false });
    }
  }

  // ---------- the room ----------

  _buildRoom() {
    const { m } = this;
    const H = ROOM.h;
    // floor
    const fg = new THREE.PlaneGeometry(14, 10);
    fg.rotateX(-Math.PI / 2);
    this.geo(fg, m.floor, { cast: false });
    // ceiling (casts the shadow that makes the windows the only way in for the sun)
    this.box(-7.4, 7.4, H, H + 0.15, -5.4, 5.4, m.ceiling, { collide: false });
    // side walls
    this.box(-7.3, -7, 0, H, -5.3, 5.3, m.wallGreen, { collide: false });
    this.box(7, 7.3, 0, H, -5.3, 5.3, m.wall, { collide: false });
    // front wall with the front door at x 4.2..5.2
    this.box(-7.3, 4.2, 0, H, 5, 5.3, m.wall, { collide: false });
    this.box(5.2, 7.3, 0, H, 5, 5.3, m.wall, { collide: false });
    this.box(4.2, 5.2, 2.15, H, 5, 5.3, m.wall, { collide: false });
    // back wall, cut around three windows
    const z0 = -5.3, z1 = WALL_Z;
    const cols = [[-7.3, -2.6], [-0.8, -0.2], [1.6, 3.7], [5.3, 7.3]];
    for (const [a, b] of cols) this.box(a, b, 0, H, z0, z1, m.wall, { collide: false });
    for (const w of WINDOWS) {
      this.box(w.x0, w.x1, 0, w.y0, z0, z1, m.wall, { collide: false });
      this.box(w.x0, w.x1, w.y1, H, z0, z1, m.wall, { collide: false });
      // frame and glazing bars
      const f = 0.05;
      this.box(w.x0, w.x1, w.y1 - f, w.y1, -5.2, -5.08, m.glassFrame, { collide: false });
      this.box(w.x0, w.x1, w.y0, w.y0 + f, -5.2, -5.08, m.glassFrame, { collide: false });
      this.box(w.x0, w.x0 + f, w.y0, w.y1, -5.2, -5.08, m.glassFrame, { collide: false });
      this.box(w.x1 - f, w.x1, w.y0, w.y1, -5.2, -5.08, m.glassFrame, { collide: false });
      const mx = (w.x0 + w.x1) / 2;
      this.box(mx - 0.02, mx + 0.02, w.y0, w.y1, -5.18, -5.1, m.glassFrame, { collide: false });
      const my = w.y0 + (w.y1 - w.y0) * 0.62;
      this.box(w.x0, w.x1, my - 0.02, my + 0.02, -5.18, -5.1, m.glassFrame, { collide: false });
      // inside sill
      const deep = w.y0 > 1 ? -4.86 : -4.72;
      this.box(w.x0 - 0.08, w.x1 + 0.08, w.y0 - 0.04, w.y0, WALL_Z, deep, m.trim, { tag: 'sill' });
      // outside sill (for the bird)
      this.box(w.x0 - 0.05, w.x1 + 0.05, w.y0 - 0.05, w.y0 - 0.01, -5.5, -5.3, m.trim, { collide: false });
    }
    // invisible room bounds as colliders (thin slabs) so items bounce off walls
    this.collider(-7.5, -7, 0, H, -5.5, 5.5, 'wall');
    this.collider(7, 7.5, 0, H, -5.5, 5.5, 'wall');
    this.collider(-7.5, 7.5, 0, H, 5, 5.5, 'wall');
    this.collider(-7.5, 7.5, 0, H, -5.5, -5, 'wall');
    // skirting boards
    this.box(-7, 7, 0, 0.09, 4.985, 5, m.trim, { collide: false, cast: false });
    this.box(-7, 7, 0, 0.09, -5, -4.985, m.trim, { collide: false, cast: false });
    this.box(-7, -6.985, 0, 0.09, -5, 5, m.trim, { collide: false, cast: false });
    this.box(6.985, 7, 0, 0.09, -5, 5, m.trim, { collide: false, cast: false });
    // the front door
    const door = new THREE.Group();
    const dg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.15, 0.05), m.door);
    dg.position.set(0.5, 1.075, 0);
    dg.castShadow = true; dg.receiveShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), m.metal);
    knob.position.set(0.88, 1.0, -0.05);
    door.add(dg, knob);
    door.position.set(4.2, 0, 5.03);
    this.door = door;
    this.scene.add(door);
    // daylight outside the door, seen when it opens
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), new THREE.MeshBasicMaterial({ color: '#ffd9a8' }));
    glow.rotation.y = Math.PI;
    glow.position.set(4.7, 1.1, 5.32);
    this.scene.add(glow);
    this.box(4.15, 5.25, 0, 0.012, 4.4, 4.95, m.terracotta, { collide: false, cast: false }); // doormat
  }

  _buildLiving() {
    const { m } = this;
    // rug
    const rg = new THREE.CircleGeometry(1.8, 48);
    rg.rotateX(-Math.PI / 2);
    rg.scale(1.15, 1, 0.85);
    rg.translate(-3.9, 0.006, -0.3);
    this.geo(rg, m.rug, { cast: false });

    // sofa (faces the TV at the back wall)
    const sx0 = -5.2, sx1 = -2.6, sz0 = 0.7, sz1 = 1.65;
    this.box(sx0, sx1, 0.06, 0.3, sz0, sz1, m.terraDark, { tag: 'sofa', round: 0.04 });
    this.box(sx0 + 0.22, (sx0 + sx1) / 2, 0.3, 0.45, sz0, 1.4, m.terracotta, { tag: 'sofa', round: 0.06 });
    this.box((sx0 + sx1) / 2, sx1 - 0.22, 0.3, 0.45, sz0, 1.4, m.terracotta, { tag: 'sofa', round: 0.06 });
    this.box(sx0 + 0.22, sx1 - 0.22, 0.3, 0.88, 1.38, sz1, m.terracotta, { tag: 'sofa', round: 0.08 });
    this.box(sx0, sx0 + 0.22, 0.3, 0.62, sz0, sz1, m.terraDark, { tag: 'sofa', round: 0.08 });
    this.box(sx1 - 0.22, sx1, 0.3, 0.62, sz0, sz1, m.terraDark, { tag: 'sofa', round: 0.08 });
    for (const x of [sx0 + 0.1, sx1 - 0.1]) for (const z of [sz0 + 0.08, sz1 - 0.08]) this.cyl(x, 0, z, 0.025, 0.02, 0.06, m.walnut, { seg: 8 });
    // throw cushions (decorative)
    this.box(-4.95, -4.6, 0.45, 0.78, 1.18, 1.36, m.teal, { collide: false, round: 0.07 });
    this.box(-3.2, -2.85, 0.45, 0.76, 1.18, 1.36, m.mustard, { collide: false, round: 0.07 });

    // coffee table
    this.table(-4.5, -3.3, -1.3, -0.6, 0.42, m.oak, 'coffeetable', m.walnut);
    this.box(-4.42, -3.38, 0.12, 0.14, -1.22, -0.68, m.walnut, { tag: 'shelf-low' });

    // TV stand + TV
    this.box(-4.9, -3.1, 0.06, 0.5, -5, -4.55, m.walnut, { tag: 'tvstand', round: 0.015 });
    this.box(-4.88, -3.12, 0, 0.06, -4.98, -4.6, m.dark, { collide: false });
    this.box(-4.15, -3.85, 0.5, 0.53, -4.92, -4.68, m.dark, { collide: false });
    this.box(-4.03, -3.97, 0.53, 0.62, -4.88, -4.84, m.dark, { collide: false });
    this.box(-4.65, -3.35, 0.6, 1.32, -4.9, -4.84, m.dark, { tag: 'tv' });
    const sg = new THREE.PlaneGeometry(1.24, 0.66);
    sg.translate(-4.0, 0.96, -4.835);
    this.geo(sg, m.screen, { cast: false });

    // bookcase in the corner (its top is the summit)
    const bx0 = -7.0, bx1 = -5.35, bz0 = -5, bz1 = -4.6, bh = 2.15;
    this.collider(bx0, bx1, 0, bh, bz0, bz1, 'bookcase');
    this.box(bx0, bx0 + 0.03, 0, bh, bz0, bz1, m.walnut, { collide: false });
    this.box(bx1 - 0.03, bx1, 0, bh, bz0, bz1, m.walnut, { collide: false });
    this.box(bx0, bx1, 0, bh, bz0, bz0 + 0.02, m.walnut, { collide: false });
    this.box(bx0, bx1, bh - 0.04, bh, bz0, bz1 + 0.01, m.walnut, { collide: false });
    const shelves = [0.0, 0.42, 0.84, 1.26, 1.68];
    for (const y of shelves) this.box(bx0, bx1, y, y + 0.03, bz0, bz1, m.walnut, { collide: false });
    // books, instanced
    const books = [];
    const bookCols = ['#c8664b', '#3f8079', '#e3a64a', '#2f3e57', '#efe1c6', '#7a4c63', '#8fae8f', '#d98b6f', '#5c6f8f'];
    for (let s = 0; s < shelves.length; s++) {
      let x = bx0 + 0.05;
      while (x < bx1 - 0.08) {
        if (Math.random() < 0.08) { x += rnd(0.08, 0.18); continue; }
        const w = rnd(0.025, 0.05), h = rnd(0.24, 0.36), d = rnd(0.22, 0.3);
        const lean = x > bx1 - 0.25 && Math.random() < 0.5 ? 0.25 : 0;
        books.push({ x: x + w / 2, y: shelves[s] + 0.03 + h / 2, z: bz0 + 0.02 + d / 2, w, h, d, lean, c: bookCols[(Math.random() * bookCols.length) | 0] });
        x += w + 0.003;
      }
    }
    const bmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), books.length);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    books.forEach((b, i) => {
      q.setFromEuler(e.set(0, 0, b.lean));
      mm.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.w, b.h, b.d));
      bmesh.setMatrixAt(i, mm);
      bmesh.setColorAt(i, new THREE.Color(b.c));
    });
    bmesh.castShadow = true; bmesh.receiveShadow = true;
    this.scene.add(bmesh);

    // sideboard + floating shelves: the climbing route up to the bookcase
    this.box(-7, -6.45, 0.08, 0.8, -3.7, -1.9, m.oak, { tag: 'sideboard', round: 0.012 });
    this.box(-6.46, -6.44, 0.14, 0.74, -3.62, -2.82, m.sage, { collide: false });
    this.box(-6.46, -6.44, 0.14, 0.74, -2.78, -1.98, m.sage, { collide: false });
    for (const z of [-3.6, -2.0]) this.box(-6.9, -6.55, 0, 0.08, z - 0.03, z + 0.03, m.walnut, { collide: false });
    this.box(-7, -6.72, 1.31, 1.35, -2.75, -2.0, m.walnut, { tag: 'shelf' });
    this.box(-7, -6.72, 1.76, 1.8, -3.95, -3.2, m.walnut, { tag: 'shelf' });
    for (const [z, y] of [[-2.6, 1.31], [-2.15, 1.31], [-3.8, 1.76], [-3.35, 1.76]]) this.box(-7, -6.8, y - 0.12, y, z - 0.01, z + 0.01, m.dark, { collide: false });

    // armchair + floor lamp
    this.box(-6.55, -5.85, 0.06, 0.42, -0.7, 0.3, m.mustard, { tag: 'armchair', round: 0.06 });
    this.box(-6.78, -6.55, 0.06, 0.92, -0.7, 0.3, m.mustard, { tag: 'armchair', round: 0.08 });
    this.box(-6.55, -5.85, 0.06, 0.6, -0.72, -0.52, m.mustard, { tag: 'armchair', round: 0.06 });
    this.box(-6.55, -5.85, 0.06, 0.6, 0.12, 0.32, m.mustard, { tag: 'armchair', round: 0.06 });
    this.cyl(-6.45, 0, 0.75, 0.16, 0.16, 0.025, m.dark, { seg: 24 });
    this.box(-6.47, -6.43, 0.02, 1.4, 0.73, 0.77, m.dark, { tag: 'lamp' });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.28, 24, 1, true), this.lampShade);
    shade.position.set(-6.45, 1.5, 0.75);
    shade.castShadow = false;
    this.scene.add(shade);

    // side table by the sofa
    this.table(-2.5, -2.02, 1.0, 1.48, 0.55, m.walnut, 'sidetable');

    // the cardboard box
    const cx0 = -1.65, cx1 = -0.95, cz0 = 2.3, cz1 = 2.85, ch = 0.3, t = 0.015;
    this.box(cx0, cx1, 0, ch, cz0, cz0 + t, m.cardboard, { tag: 'box' });
    this.box(cx0, cx1, 0, ch, cz1 - t, cz1, m.cardboard, { tag: 'box' });
    this.box(cx0, cx0 + t, 0, ch, cz0, cz1, m.cardboard, { tag: 'box' });
    this.box(cx1 - t, cx1, 0, ch, cz0, cz1, m.cardboard, { tag: 'box' });
    this.box(cx0 + t, cx1 - t, 0, 0.01, cz0 + t, cz1 - t, m.cardboardIn, { collide: false, cast: false });
    const flap = (w, d, x, z, rx, rz) => {
      const g = new THREE.BoxGeometry(w, 0.01, d);
      g.translate(0, 0, 0);
      g.rotateX(rx); g.rotateZ(rz);
      g.translate(x, ch, z);
      this.geo(g, m.cardboard);
    };
    flap(cx1 - cx0, 0.2, (cx0 + cx1) / 2, cz0 - 0.07, -0.9, 0);
    flap(cx1 - cx0, 0.2, (cx0 + cx1) / 2, cz1 + 0.07, 0.9, 0);
    this.boxInterior = { x0: cx0 + t, x1: cx1 - t, z0: cz0 + t, z1: cz1 - t };

    // cat tree by the window
    this.box(1.95, 2.85, 0, 0.07, -5.0, -4.05, m.cream, { tag: 'cattree', round: 0.02 });
    this.box(2.24, 2.36, 0.07, 1.5, -4.51, -4.39, m.sisal, { tag: 'post' });
    this.box(2.3, 2.9, 0.5, 0.56, -4.75, -4.15, m.cream, { tag: 'cattree', round: 0.02 });
    this.box(2.62, 2.7, 0.07, 0.5, -4.49, -4.41, m.sisal, { tag: 'post' });
    this.box(1.7, 2.3, 1.0, 1.06, -4.75, -4.15, m.cream, { tag: 'cattree', round: 0.02 });
    this.box(1.86, 1.94, 0.56, 1.0, -4.49, -4.41, m.sisal, { tag: 'post' });
    this.box(2.15, 2.8, 1.5, 1.56, -4.8, -4.15, m.cream, { tag: 'cattree', round: 0.02 });
    // bed rim on the top platform
    const rim = new THREE.TorusGeometry(0.27, 0.04, 8, 24);
    rim.rotateX(Math.PI / 2);
    rim.scale(1, 1, 1);
    rim.translate(2.475, 1.6, -4.475);
    this.geo(rim, m.terracotta);
    // dangling toy
    this.box(2.86, 2.87, 1.25, 1.5, -4.2, -4.19, m.dark, { collide: false, cast: false });
    this.sphere(2.865, 1.23, -4.195, 0.03, m.terracotta, 1, 1, 1, { collide: false });
  }

  _buildKitchen() {
    const { m } = this;
    // tiled splashback
    const tg = new THREE.PlaneGeometry(6.0, 0.62);
    tg.rotateY(-Math.PI / 2);
    tg.translate(6.995, 1.23, -2.0);
    this.geo(tg, m.tile, { cast: false });
    const tb = new THREE.PlaneGeometry(3.7, 0.28);
    tb.translate(5.15, 1.06, -4.995);
    this.geo(tb, m.tile, { cast: false });
    // counters
    const top = 0.92;
    this.box(6.35, 7, 0.08, top - 0.04, -4.35, 0.75, m.sage, { tag: 'counter' });
    this.box(3.3, 7, 0.08, top - 0.04, -5, -4.35, m.sage, { tag: 'counter' });
    this.box(6.3, 7, top - 0.04, top, -4.35, 0.78, m.top, { tag: 'counter' });
    this.box(3.27, 7, top - 0.04, top, -5, -4.32, m.top, { tag: 'counter' });
    this.box(6.4, 7, 0, 0.08, -4.35, 0.72, m.dark, { collide: false, cast: false });
    this.box(3.35, 7, 0, 0.08, -4.97, -4.4, m.dark, { collide: false, cast: false });
    // cabinet door seams + handles
    for (let z = -4.2; z < 0.7; z += 0.6) {
      this.box(6.33, 6.35, 0.12, 0.84, z, z + 0.008, m.top, { collide: false, cast: false });
      this.box(6.32, 6.34, 0.7, 0.74, z + 0.25, z + 0.35, m.metal, { collide: false, cast: false });
    }
    for (let x = 3.4; x < 6.3; x += 0.6) {
      this.box(x, x + 0.008, 0.12, 0.84, -4.37, -4.35, m.top, { collide: false, cast: false });
      this.box(x + 0.25, x + 0.35, 0.7, 0.74, -4.36, -4.34, m.metal, { collide: false, cast: false });
    }
    // sink under the window
    this.box(4.1, 4.9, top, top + 0.005, -4.85, -4.45, m.metal, { collide: false, cast: false });
    this.cyl(4.5, top, -4.9, 0.015, 0.015, 0.28, m.metal, { seg: 8 });
    this.box(4.485, 4.515, top + 0.26, top + 0.28, -4.9, -4.72, m.metal, { collide: false });
    // stove
    this.box(6.42, 6.95, top, top + 0.008, -0.6, 0.15, m.dark, { collide: false, cast: false });
    for (const [x, z] of [[6.55, -0.4], [6.8, -0.4], [6.55, -0.05], [6.8, -0.05]]) this.cyl(x, top + 0.008, z, 0.07, 0.07, 0.004, m.metal, { seg: 16, cast: false });
    // hood
    this.box(6.5, 7, 1.7, 2.1, -0.65, 0.2, m.metal, { tag: 'hood' });
    // upper cabinets (a high perch)
    this.box(6.62, 7, 1.5, 2.25, -4.1, -2.6, m.sage, { tag: 'cabinet' });
    for (let z = -4.1; z < -2.65; z += 0.5) this.box(6.6, 6.62, 1.52, 2.23, z + 0.005, z + 0.012, m.top, { collide: false, cast: false });
    // fridge
    this.box(6.3, 7, 0, 1.85, 1.0, 1.75, m.fridge, { tag: 'fridge', round: 0.05 });
    this.box(6.28, 6.3, 1.25, 1.27, 1.04, 1.71, m.dark, { collide: false });
    this.box(6.26, 6.29, 1.35, 1.7, 1.1, 1.13, m.metal, { collide: false });
    this.box(6.26, 6.29, 0.85, 1.15, 1.1, 1.13, m.metal, { collide: false });
    // island + stools
    this.box(3.65, 4.95, 0.08, 0.88, -2.35, -1.45, m.sage, { tag: 'island' });
    this.box(3.6, 5.0, 0.88, top, -2.4, -1.4, m.top, { tag: 'island' });
    this.box(3.68, 4.92, 0, 0.08, -2.32, -1.48, m.dark, { collide: false, cast: false });
    for (const x of [3.95, 4.65]) {
      this.cyl(x, 0.0, -0.95, 0.15, 0.15, 0.02, m.dark, { seg: 16 });
      this.box(x - 0.02, x + 0.02, 0.02, 0.62, -0.97, -0.93, m.dark, { tag: 'leg' });
      this.cyl(x, 0.62, -0.95, 0.17, 0.17, 0.05, m.oak, { seg: 20 });
      this.collider(x - 0.15, x + 0.15, 0.62, 0.67, -1.1, -0.8, 'stool');
    }
    // runner rug
    const rg = new THREE.PlaneGeometry(0.8, 3.6);
    rg.rotateX(-Math.PI / 2);
    rg.translate(5.6, 0.006, -1.6);
    this.geo(rg, m.runner, { cast: false });
    // pendants over the island
    this.pendants = [];
    for (const x of [3.95, 4.65]) {
      this.box(x - 0.004, x + 0.004, 1.85, ROOM.h, -1.904, -1.896, m.dark, { collide: false, cast: false });
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 24, 1, true), this.lampShade);
      s.position.set(x, 1.8, -1.9);
      this.scene.add(s);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), this.bulb);
      b.position.set(x, 1.72, -1.9);
      this.scene.add(b);
    }
  }

  _buildMisc() {
    const { m } = this;
    // dining table with four chairs
    this.table(0.0, 1.7, 0.3, 1.25, 0.75, m.oak, 'dining', m.oak, 0.04, 0.06);
    this.chair(0.45, 0.02, 1, m.walnut);
    this.chair(1.25, 0.02, 1, m.walnut);
    this.chair(0.45, 1.53, -1, m.walnut);
    this.chair(1.25, 1.53, -1, m.walnut);

    // study nook: desk, laptop, chair
    this.table(-7.0, -5.6, 4.25, 5.0, 0.75, m.oak, 'desk', m.dark);
    this.box(-6.55, -6.1, 0.75, 0.765, 4.4, 4.72, m.laptop, { tag: 'laptop' });
    const scr = new THREE.BoxGeometry(0.45, 0.3, 0.012);
    scr.translate(0, 0.15, 0);
    scr.rotateX(-0.25);
    scr.translate(-6.325, 0.765, 4.73);
    this.geo(scr, m.laptop);
    const scr2 = new THREE.PlaneGeometry(0.41, 0.26);
    scr2.translate(0, 0.15, 0);
    scr2.rotateX(-0.25);
    scr2.rotateY(Math.PI);
    scr2.translate(-6.325, 0.765, 4.722);
    this.laptopScreen = new THREE.Mesh(scr2, new THREE.MeshBasicMaterial({ color: '#9fc4d8' }));
    this.scene.add(this.laptopScreen);
    this.chair(-6.2, 3.85, 1, m.walnut);
    this.laptopRect = { x0: -6.55, x1: -6.1, z0: 4.4, z1: 4.72 };

    // shoe rack + coat hooks by the door
    this.box(5.45, 6.45, 0, 0.42, 4.62, 5, m.oak, { tag: 'shoerack', round: 0.01 });
    this.box(5.5, 6.4, 0.43, 0.46, 4.85, 4.98, m.dark, { collide: false });
    this.box(5.6, 6.3, 1.6, 1.64, 4.95, 5, m.walnut, { collide: false });
    this.box(5.7, 6.0, 1.2, 1.6, 4.82, 4.95, m.teal, { collide: false, round: 0.04 });
    this.box(6.05, 6.25, 1.1, 1.6, 4.84, 4.95, m.mustard, { collide: false, round: 0.04 });

    // big floor plants
    this.cyl(-5.15, 0, 4.6, 0.18, 0.22, 0.42, m.pot, { seg: 20 });
    this.collider(-5.37, -4.93, 0, 0.42, 4.38, 4.82, 'pot');
    this.plant(-5.15, 0.42, 4.6, 1.3, 0);
    this.cyl(3.0, 0, -4.55, 0.13, 0.16, 0.34, m.potWhite, { seg: 20 });
    this.collider(2.95, 3.19, 0, 0.34, -4.73, -4.37, 'pot');
    this.plant(3.07, 0.34, -4.55, 1.4, 1);
    this.cyl(-6.55, 0, 2.6, 0.16, 0.2, 0.38, m.terracotta, { seg: 20 });
    this.collider(-6.77, -6.33, 0, 0.38, 2.38, 2.82, 'pot');
    this.plant(-6.55, 0.38, 2.6, 1.1, 0);

    // robot dock
    this.box(2.35, 2.65, 0, 0.12, 4.88, 5, m.dark, { tag: 'dock', round: 0.02 });

    // wall art
    this.art(-6.99, 1.65, -0.2, 0.7, 0.9, m.art1, 'x+');
    this.art(-1.2, 1.6, 4.99, 0.8, 1.0, m.art0, 'z-');
    this.art(0.4, 1.75, 4.99, 0.5, 0.62, m.art2, 'z-');
    this.art(6.99, 1.7, 3.2, 0.6, 0.75, m.art2, 'x-');

    // wall clock between the window and the cat tree
    const face = new THREE.CircleGeometry(0.22, 32);
    face.translate(3.05, 2.05, -4.985);
    this.geo(face, m.trim, { cast: false });
    const ring = new THREE.TorusGeometry(0.22, 0.02, 8, 32);
    ring.translate(3.05, 2.05, -4.985);
    this.geo(ring, m.walnut);
    const mkHand = (len, w) => {
      const g = new THREE.BoxGeometry(w, len, 0.006);
      g.translate(0, len / 2 - 0.02, 0);
      const mesh = new THREE.Mesh(g, m.dark);
      mesh.position.set(3.05, 2.05, -4.975);
      this.scene.add(mesh);
      return mesh;
    };
    this.hourHand = mkHand(0.12, 0.018);
    this.minHand = mkHand(0.18, 0.011);
  }

  _buildOutside() {
    const { m } = this;
    const yard = new THREE.PlaneGeometry(80, 40);
    yard.rotateX(-Math.PI / 2);
    yard.translate(0, -0.4, -25.3);
    this.geo(yard, m.grass, { cast: false });
    // hedge and fence
    this.box(-20, 20, -0.4, 0.7, -9.5, -8.6, m.hedge, { collide: false, cast: false, round: 0.3 });
    for (let x = -18; x <= 18; x += 0.35) this.box(x - 0.06, x + 0.06, -0.4, 0.55, -8.5, -8.45, m.fence, { collide: false, cast: false });
    // trees
    const trees = [[-9, -13], [-4, -15], [3, -12.5], [7.5, -14], [12, -12], [-13, -11]];
    for (const [x, z] of trees) {
      const s = rnd(0.9, 1.3);
      this.cyl(x, -0.4, z, 0.18 * s, 0.14 * s, 2.2 * s, m.trunk, { seg: 8, cast: false });
      const g = new THREE.IcosahedronGeometry(1.5 * s, 1);
      g.translate(x, 2.4 * s, z);
      this.geo(g, Math.random() < 0.5 ? m.hedge : m.leaf, { cast: false });
      const g2 = new THREE.IcosahedronGeometry(1.0 * s, 1);
      g2.translate(x + 0.8 * s, 3.1 * s, z + 0.3);
      this.geo(g2, m.hedge, { cast: false });
    }
    // neighbours
    const houses = [[-11, -22, m.house], [-2, -24, m.house2], [8, -21, m.house]];
    for (const [x, z, mat] of houses) {
      this.box(x - 3, x + 3, -0.4, 4.5, z - 2.5, z + 2.5, mat, { collide: false, cast: false });
      const roof = new THREE.CylinderGeometry(0.01, 3.6, 2.2, 4, 1);
      roof.rotateY(Math.PI / 4);
      roof.scale(1.15, 1, 0.95);
      roof.translate(x, 5.6, z);
      this.geo(roof, m.roof, { cast: false });
      for (const dx of [-1.6, 0, 1.6]) this.box(x + dx - 0.4, x + dx + 0.4, 2.4, 3.4, z + 2.5, z + 2.55, m.glassFrame, { collide: false, cast: false });
    }
    // sky dome
    this.skyU = {
      top: { value: new THREE.Color('#7fb5e6') },
      horizon: { value: new THREE.Color('#f2e6cf') },
      sunCol: { value: new THREE.Color('#fff0cf') },
      sunDir: { value: new THREE.Vector3(0, 0.5, -1).normalize() },
    };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.skyU,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y*1.6+0.05, 0.0, 1.0);
            vec3 c = mix(horizon, top, pow(h, 0.7));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            c += sunCol * (pow(s, 600.0)*2.0 + pow(s, 12.0)*0.35);
            gl_FragColor = vec4(c, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.position.set(0, 0, -5);
    this.sky = sky;
    this.scene.add(sky);
  }

  _flush() {
    for (const bin of this.bins.values()) {
      const merged = mergeGeometries(bin.geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, bin.mat);
      mesh.castShadow = bin.cast;
      mesh.receiveShadow = bin.receive;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      for (const g of bin.geos) g.dispose();
    }
    this.bins.clear();
  }

  _buildLights() {
    const sun = new THREE.DirectionalLight('#fff0d6', 3.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 40;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.025;
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.hemi = new THREE.HemisphereLight('#fff4e4', '#b28b67', 1.25);
    this.scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight('#ffe6cc', 0.35); // soft bounce light from the window side
    this.fill.position.set(0, 3, 6);
    this.scene.add(this.fill);
    this.lamps = [];
    const lamp = (x, y, z, int) => {
      const l = new THREE.PointLight('#ffbd73', 0, 7, 1.6);
      l.position.set(x, y, z);
      this.scene.add(l);
      this.lamps.push({ l, int });
    };
    lamp(-6.45, 1.45, 0.75, 4.5);
    lamp(4.3, 1.65, -1.9, 4.0);
  }

  _buildBeams() {
    this.beams = [];
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { col: { value: new THREE.Color('#ffd9a0') }, op: { value: 0.07 } },
      vertexShader: `attribute float fade; varying float vF; void main(){ vF = fade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 col; uniform float op; varying float vF; void main(){ gl_FragColor = vec4(col * op * pow(vF, 1.4), 1.0); }`,
    });
    this.beamMat = mat;
    const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
    for (const w of WINDOWS) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3));
      g.setAttribute('fade', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 1, 0, 0, 0, 0]), 1));
      g.setIndex(idx);
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      this.scene.add(mesh);
      this.beams.push({ w, mesh });
    }
    // dust motes
    const N = 500;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    this.dust = [];
    for (let i = 0; i < N; i++) {
      const d = { x: rnd(-3.5, 6), y: rnd(0.1, 2.5), z: rnd(-5, 3), vx: rnd(-0.02, 0.02), vy: rnd(-0.01, 0.01), vz: rnd(-0.02, 0.02), ph: rnd(0, 6.28) };
      this.dust.push(d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dustPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.014, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dustPts.frustumCulled = false;
    this.scene.add(this.dustPts);
  }

  // ---------- time of day ----------

  setTime(t) {
    // t: 0 at 9:00, 1 at 17:30
    this.t = t;
    const az = lerp(-0.85, 0.95, t);
    const el = 0.13 + 0.73 * Math.sin(Math.PI * Math.min(1, (t + 0.25) / 1.25));
    const S = this.sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.sun.position.copy(S).multiplyScalar(18);
    this.sun.target.position.set(0, 0, 0);
    // colours along the day
    const keys = DAY_KEYS;
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 0; i < keys.length - 1; i++) if (t >= keys[i][0] && t <= keys[i + 1][0]) { a = keys[i]; b = keys[i + 1]; break; }
    const k = smooth(Math.min(1, Math.max(0, (t - a[0]) / Math.max(1e-6, b[0] - a[0]))));
    this.sun.color.copy(a[1]).lerp(b[1], k);
    this.sun.intensity = lerp(a[2], b[2], k);
    this.skyU.top.value.copy(a[3]).lerp(b[3], k);
    this.skyU.horizon.value.copy(a[4]).lerp(b[4], k);
    this.skyU.sunCol.value.copy(this.sun.color);
    this.skyU.sunDir.value.copy(S);
    this.hemi.intensity = lerp(a[5], b[5], k);
    this.hemi.color.copy(HEMI_A).lerp(HEMI_B, smooth(Math.max(0, (t - 0.6) / 0.4)));
    this.beamMat.uniforms.col.value.copy(this.sun.color);
    this.beamMat.uniforms.op.value = 0.05 + 0.05 * smooth(Math.max(0, (t - 0.5) / 0.5));
    // lamps come on in the late afternoon
    const lampK = smooth(Math.min(1, Math.max(0, (t - 0.68) / 0.25)));
    for (const { l, int } of this.lamps) l.intensity = int * lampK;
    this.lampShade.emissiveIntensity = lampK * 1.2;
    // wall clock: 9:00 + t * 8.5h
    const hours = 9 + t * 8.5;
    this.minHand.rotation.z = -((hours % 1) * Math.PI * 2);
    this.hourHand.rotation.z = -(((hours % 12) / 12) * Math.PI * 2);
    this._updateBeams();
  }

  _updateBeams() {
    const S = this.sunDir;
    for (const { w, mesh } of this.beams) {
      const p = mesh.geometry.attributes.position;
      const corners = [[w.x0, w.y0], [w.x1, w.y0], [w.x1, w.y1], [w.x0, w.y1]];
      corners.forEach(([x, y], i) => {
        p.setXYZ(i, x, y, WALL_Z - 0.1);
        const s = y / S.y; // distance along -S down to the floor
        p.setXYZ(i + 4, x - S.x * s, 0, WALL_Z - 0.1 - S.z * s);
      });
      p.needsUpdate = true;
    }
  }

  updateDust(dt, time) {
    const pos = this.dustPts.geometry.attributes.position;
    const col = this.dustPts.geometry.attributes.color;
    const c = this.sun.color;
    for (let i = 0; i < this.dust.length; i++) {
      const d = this.dust[i];
      d.x += (d.vx + Math.sin(time * 0.3 + d.ph) * 0.01) * dt;
      d.y += (d.vy + Math.cos(time * 0.23 + d.ph) * 0.006) * dt;
      d.z += d.vz * dt;
      if (d.x < -3.5) d.x = 6; if (d.x > 6) d.x = -3.5;
      if (d.y < 0.1) d.y = 2.5; if (d.y > 2.5) d.y = 0.1;
      if (d.z < -5) d.z = 3; if (d.z > 3) d.z = -5;
      pos.setXYZ(i, d.x, d.y, d.z);
      if ((i + this._dustTick) % 4 === 0) {
        const lit = this.sunlit(d.x, d.y, d.z, false) ? 1.2 : 0.0;
        const tw = 0.6 + 0.4 * Math.sin(time * 2 + d.ph * 3);
        col.setXYZ(i, c.r * lit * tw, c.g * lit * tw, c.b * lit * tw);
      }
    }
    this._dustTick = ((this._dustTick || 0) + 1) % 4;
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  // ---------- queries ----------

  /** Is the point lit by the sun through a window? Optionally test furniture occlusion. */
  sunlit(x, y, z, occlusion = true) {
    const S = this.sunDir;
    if (S.z >= -0.01 || S.y <= 0.01) return false;
    const t = (WALL_Z - z) / S.z;
    if (t <= 0) return false;
    const qx = x + S.x * t, qy = y + S.y * t;
    let hit = false;
    for (const w of WINDOWS) {
      if (qx > w.x0 + 0.05 && qx < w.x1 - 0.05 && qy > w.y0 + 0.05 && qy < w.y1 - 0.05) { hit = true; break; }
    }
    if (!hit || !occlusion) return hit;
    // furniture between the point and the window
    const o = [x, y + 0.01, z], d = [S.x, S.y, S.z];
    for (const c of this.colliders) {
      if (c.tag === 'wall') continue;
      const h = rayBox(o, d, c, t);
      if (h !== null && h > 0.02) return false;
    }
    return true;
  }

  /** Highest walkable top under (x,z) that is no higher than maxY. */
  groundAt(x, z, maxY, margin = 0, skip = null) {
    let best = 0, tag = 'floor';
    for (const c of this.colliders) {
      if (c.y1 > maxY || c.y1 <= best) continue;
      if (skip && skip.has(c.tag)) continue;
      if (x < c.x0 - margin || x > c.x1 + margin || z < c.z0 - margin || z > c.z1 + margin) continue;
      best = c.y1;
      tag = c.tag;
    }
    this.lastTag = tag;
    return best;
  }

  /**
   * Push a vertical cylinder (feet at p.y, height h, radius r) out of colliders.
   * Boxes whose top is within `step` of the feet are ignored (they are stepped onto).
   * Returns the last contact normal or null.
   */
  collideCircle(p, r, h, step, out = null) {
    let contact = null;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.colliders) {
        if (c.y1 <= p.y + step || c.y0 >= p.y + h) continue;
        const cx = Math.max(c.x0, Math.min(p.x, c.x1));
        const cz = Math.max(c.z0, Math.min(p.z, c.z1));
        let dx = p.x - cx, dz = p.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let nx, nz, pen;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          nx = dx / d; nz = dz / d; pen = r - d;
        } else {
          // centre inside: leave through the nearest face
          const l = p.x - c.x0, rr = c.x1 - p.x, b = p.z - c.z0, f = c.z1 - p.z;
          const mn = Math.min(l, rr, b, f);
          if (mn === l) { nx = -1; nz = 0; pen = l + r; }
          else if (mn === rr) { nx = 1; nz = 0; pen = rr + r; }
          else if (mn === b) { nx = 0; nz = -1; pen = b + r; }
          else { nx = 0; nz = 1; pen = f + r; }
        }
        p.x += nx * pen;
        p.z += nz * pen;
        contact = { nx, nz, c };
        if (out) out.push(contact);
      }
    }
    return contact;
  }

  /** Lowest underside above the head, for bonking on tables and shelves. */
  ceilingAt(x, z, y, r) {
    let best = ROOM.h;
    for (const c of this.colliders) {
      if (c.y0 < y - 0.01 || c.y0 >= best) continue;
      if (x < c.x0 - r * 0.6 || x > c.x1 + r * 0.6 || z < c.z0 - r * 0.6 || z > c.z1 + r * 0.6) continue;
      best = c.y0;
    }
    return best;
  }

  /** Distance along a ray to the nearest collider (for the camera), or max. */
  raycast(o, d, max) {
    let best = max;
    const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z];
    for (const c of this.colliders) {
      if (c.tag === 'wall' || c.tag === 'leg' || c.tag === 'post' || c.tag === 'lamp') continue;
      const t = rayBox(oa, da, c, best);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
}

export function rayBox(o, d, c, max) {
  let t0 = 0, t1 = max;
  const mins = [c.x0, c.y0, c.z0], maxs = [c.x1, c.y1, c.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mins[i] || o[i] > maxs[i]) return null;
    } else {
      let a = (mins[i] - o[i]) / d[i], b = (maxs[i] - o[i]) / d[i];
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t0 > t1) return null;
    }
  }
  return t0;
}
