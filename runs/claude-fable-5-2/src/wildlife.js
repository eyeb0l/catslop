// Everything on the island that can end up on the doormat: ten kinds of
// animal with their own senses and escape plans, four objects, and one red dot.
import * as THREE from 'three';
import { heightAt, waterLevelAt, waterDepthAt, tallGrassAt, grassAt, woodsAt, isBeach, inYard, POND, DOCK, COTTAGE } from './terrain.js';
import { CAT_SCALE } from './cat.js';
import { pounceRange, pounceTime } from './player.js';
import { rand, pick, clamp, lerp, damp, TAU, dampAngle } from './util.js';

const V3 = THREE.Vector3;
const SPHERE = new THREE.SphereGeometry(1, 12, 9);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

function part(parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
function glowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

// ---- Models: each returns a Group facing +Z ---------------------------------------

const BUILD = {
  butterfly(scale = 1, colors = ['#ff9d2e', '#3d8bff', '#ffe14a', '#ffffff', '#ff6fa3']) {
    const g = new THREE.Group();
    part(g, SPHERE, std('#2a2420'), 0, 0, 0, 0.012, 0.012, 0.05);
    const wingGeo = new THREE.CircleGeometry(0.085, 7); wingGeo.rotateX(-Math.PI / 2); wingGeo.scale(1, 1, 1.25); wingGeo.translate(0.075, 0, 0);
    const m = std(pick(colors), { side: THREE.DoubleSide, emissive: '#221100', roughness: 0.6 });
    g.userData.wings = [1, -1].map((s) => {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(wingGeo, m); w.scale.x = s; w.castShadow = true;
      pivot.add(w); g.add(pivot);
      return pivot;
    });
    g.scale.setScalar(scale);
    return g;
  },
  moth() { return BUILD.butterfly(0.8, ['#e9dcc0', '#cdbf9f', '#f4ecd8']); },
  firefly() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(SPHERE, new THREE.MeshBasicMaterial({ color: '#e6ff7a' }));
    m.scale.setScalar(0.022);
    g.add(m);
    g.userData.glow = glowSprite('#c8ff5a', 0.55);
    g.add(g.userData.glow);
    return g;
  },
  dragonfly() {
    const g = new THREE.Group();
    const teal = std('#1fb5a8', { metalness: 0.5, roughness: 0.3, emissive: '#06403a' });
    part(g, new THREE.CylinderGeometry(0.011, 0.007, 0.22, 6).rotateX(Math.PI / 2), teal, 0, 0, -0.04);
    part(g, SPHERE, teal, 0, 0.004, 0.085, 0.022);
    const wingGeo = new THREE.PlaneGeometry(0.17, 0.04); wingGeo.rotateX(-Math.PI / 2); wingGeo.translate(0.09, 0, 0);
    const wm = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.2 });
    g.userData.wings = [];
    for (const z of [0.04, 0]) for (const s of [1, -1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, 0.012, z);
      const w = new THREE.Mesh(wingGeo, wm); w.scale.x = s;
      pivot.add(w); g.add(pivot); g.userData.wings.push(pivot);
    }
    return g;
  },
  frog() {
    const g = new THREE.Group();
    const green = std('#5fae3e'), dark = std('#3f8530');
    g.userData.body = part(g, SPHERE, green, 0, 0.075, 0, 0.1, 0.075, 0.12);
    for (const s of [1, -1]) {
      part(g, SPHERE, green, s * 0.048, 0.14, 0.065, 0.032);
      part(g, SPHERE, new THREE.MeshBasicMaterial({ color: '#111' }), s * 0.052, 0.146, 0.086, 0.016);
      part(g, SPHERE, dark, s * 0.095, 0.045, -0.05, 0.05, 0.04, 0.075);
      part(g, SPHERE, dark, s * 0.075, 0.02, 0.085, 0.025, 0.02, 0.04);
    }
    return g;
  },
  mouse() {
    const g = new THREE.Group();
    const fur = std('#a3917f'), pink = std('#f0a9a8');
    part(g, SPHERE, fur, 0, 0.06, 0, 0.065, 0.06, 0.11);
    part(g, SPHERE, fur, 0, 0.065, 0.11, 0.045, 0.042, 0.06);
    part(g, SPHERE, pink, 0, 0.058, 0.168, 0.012);
    for (const s of [1, -1]) {
      part(g, SPHERE, pink, s * 0.04, 0.108, 0.09, 0.03, 0.03, 0.008);
      part(g, SPHERE, new THREE.MeshBasicMaterial({ color: '#111' }), s * 0.026, 0.078, 0.145, 0.009);
    }
    g.userData.tail = part(g, new THREE.CylinderGeometry(0.008, 0.004, 0.2, 5).rotateX(Math.PI / 2).translate(0, 0, -0.1), pink, 0, 0.04, -0.1);
    return g;
  },
  sparrow() {
    const g = new THREE.Group();
    const brown = std('#8c6a48'), dark = std('#5c402c'), cream = std('#e6d6ba');
    part(g, SPHERE, brown, 0, 0.085, 0, 0.07, 0.068, 0.105);
    part(g, SPHERE, cream, 0, 0.07, 0.02, 0.06, 0.055, 0.085);
    g.userData.head = part(g, SPHERE, dark, 0, 0.15, 0.08, 0.052);
    part(g.userData.head, new THREE.ConeGeometry(0.4, 0.9, 5).rotateX(Math.PI / 2), std('#e9a53a'), 0, -0.1, 1.15);
    for (const s of [1, -1]) part(g.userData.head, SPHERE, new THREE.MeshBasicMaterial({ color: '#111' }), s * 0.7, 0.2, 0.6, 0.2);
    part(g, new THREE.BoxGeometry(0.06, 0.012, 0.11), dark, 0, 0.095, -0.13).rotation.x = -0.3;
    const wingGeo = new THREE.PlaneGeometry(0.15, 0.09); wingGeo.rotateX(-Math.PI / 2); wingGeo.translate(0.075, 0, 0);
    const wm = std('#6f5238', { side: THREE.DoubleSide });
    g.userData.wings = [1, -1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.055, 0.11, 0);
      const w = new THREE.Mesh(wingGeo, wm); w.scale.x = s; w.castShadow = true;
      pivot.add(w); g.add(pivot);
      return pivot;
    });
    for (const s of [1, -1]) part(g, new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4), std('#c9853a'), s * 0.025, 0.02, 0);
    return g;
  },
  fish(color = '#ff8a2a', belly = '#ffd9a8', len = 0.3) {
    const g = new THREE.Group();
    const m = std(color, { roughness: 0.35, emissive: color, emissiveIntensity: 0.18 });
    part(g, SPHERE, m, 0, 0, 0, len * 0.17, len * 0.26, len * 0.5);
    part(g, SPHERE, std(belly, { roughness: 0.4 }), 0, -len * 0.06, len * 0.03, len * 0.15, len * 0.2, len * 0.42);
    const tailGeo = new THREE.ConeGeometry(len * 0.26, len * 0.36, 3); tailGeo.rotateX(-Math.PI / 2); tailGeo.scale(0.25, 1, 1); tailGeo.translate(0, 0, -len * 0.18);
    const pivot = new THREE.Group(); pivot.position.z = -len * 0.42;
    part(pivot, tailGeo, m);
    g.add(pivot); g.userData.tail = pivot;
    part(g, new THREE.ConeGeometry(len * 0.1, len * 0.2, 3).scale(0.25, 1, 1), m, 0, len * 0.27, -len * 0.05);
    for (const s of [1, -1]) part(g, SPHERE, new THREE.MeshBasicMaterial({ color: '#111' }), s * len * 0.13, len * 0.06, len * 0.33, len * 0.035);
    return g;
  },
  goldfish() { return BUILD.fish('#ff7a1a', '#ffe1b0', 0.34); },
  mackerel() {
    const g = BUILD.fish('#3f7fb8', '#e9f2f7', 0.52);
    for (let i = 0; i < 5; i++) part(g, new THREE.BoxGeometry(0.19, 0.02, 0.02), std('#16324d'), 0, 0.085, -0.12 + i * 0.07);
    return g;
  },
  crab() {
    const g = new THREE.Group();
    const shell = std('#e2553a'), dark = std('#b63a25');
    part(g, SPHERE, shell, 0, 0.075, 0, 0.14, 0.06, 0.1);
    g.userData.claws = [1, -1].map((s) => {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.13, 0.08, 0.07);
      part(pivot, SPHERE, dark, s * 0.045, 0.02, 0.05, 0.05, 0.035, 0.06);
      part(pivot, SPHERE, dark, s * 0.02, 0, 0.02, 0.022, 0.022, 0.04);
      g.add(pivot);
      return pivot;
    });
    for (const s of [1, -1]) {
      part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4), dark, s * 0.045, 0.14, 0.08);
      part(g, SPHERE, new THREE.MeshBasicMaterial({ color: '#111' }), s * 0.045, 0.18, 0.08, 0.017);
    }
    g.userData.legs = [];
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.11, 0.06, -0.06 + i * 0.045);
      part(pivot, new THREE.CylinderGeometry(0.01, 0.006, 0.13, 4).translate(0, -0.065, 0), dark).rotation.z = s * 1.0;
      g.add(pivot); g.userData.legs.push(pivot);
    }
    return g;
  },
  sock() {
    const g = new THREE.Group();
    const white = std('#f6f1e6'), red = std('#d7263d');
    part(g, new THREE.BoxGeometry(0.085, 0.2, 0.085), white, 0, -0.1, 0);
    part(g, new THREE.BoxGeometry(0.087, 0.035, 0.087), red, 0, -0.03, 0);
    part(g, new THREE.BoxGeometry(0.085, 0.085, 0.17), white, 0, -0.235, 0.045);
    part(g, new THREE.BoxGeometry(0.087, 0.087, 0.05), red, 0, -0.235, 0.125);
    part(g, new THREE.BoxGeometry(0.02, 0.07, 0.035), std('#b98b56'), 0, 0.02, 0);
    return g;
  },
  shell() {
    const g = new THREE.Group();
    const m = std('#ffe6dc', { roughness: 0.35, flatShading: true });
    const cone = part(g, new THREE.ConeGeometry(0.085, 0.2, 9, 3), m, 0, 0.06, 0);
    cone.rotation.set(Math.PI / 2 - 0.25, 0, 0);
    part(g, new THREE.TorusGeometry(0.05, 0.022, 5, 10), std('#ffb9a8', { roughness: 0.4 }), 0, 0.055, -0.045).rotation.x = -0.25;
    return g;
  },
  pinecone() {
    const g = new THREE.Group();
    const m = std('#7a5230', { flatShading: true, roughness: 1 });
    for (let i = 0; i < 4; i++) part(g, new THREE.ConeGeometry(0.075 - i * 0.012, 0.07, 7), m, 0, 0.04 + i * 0.038, 0).rotation.y = i * 0.6;
    return g;
  },
  mushroom() {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.03, 0.042, 0.13, 8), std('#f4eee0'), 0, 0.065, 0);
    part(g, new THREE.SphereGeometry(0.1, 12, 7, 0, TAU, 0, Math.PI / 2), std('#d92b2b', { roughness: 0.45 }), 0, 0.12, 0).scale.y = 0.75;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05, r = i === 0 ? 0 : 0.062;
      part(g, SPHERE, std('#ffffff'), Math.cos(a) * r, 0.12 + (i === 0 ? 0.074 : 0.05), Math.sin(a) * r, 0.014, 0.008, 0.014);
    }
    return g;
  },
};
const MODEL = {
  butterfly: 'butterfly', firefly: 'firefly', moth: 'moth', frog: 'frog', dragonfly: 'dragonfly', crab: 'crab', mouse: 'mouse',
  goldfish: 'goldfish', sparrow: 'sparrow', mackerel: 'mackerel', sock: 'sock', shell: 'shell', pinecone: 'pinecone', mushroom: 'mushroom',
};

// ---- Per-species numbers -----------------------------------------------------------
const SPEC = {
  butterfly: { catchR: 0.8, hear: 1.7, flying: true, max: { day: 9, dusk: 4, dawn: 5, night: 0 } },
  firefly: { catchR: 0.8, hear: 0, flying: true, max: { day: 0, dusk: 8, dawn: 2, night: 14 } },
  moth: { catchR: 0.85, hear: 0, flying: true, max: { day: 0, dusk: 3, dawn: 0, night: 6 } },
  frog: { catchR: 0.62, hear: 3.3, max: { day: 4, dusk: 5, dawn: 5, night: 5 } },
  dragonfly: { catchR: 0.75, hear: 2.3, flying: true, max: { day: 3, dusk: 1, dawn: 2, night: 0 } },
  crab: { catchR: 0.62, hear: 3.9, max: { day: 5, dusk: 5, dawn: 5, night: 2 } },
  mouse: { catchR: 0.62, hear: 4.7, max: { day: 2, dusk: 5, dawn: 5, night: 6 } },
  goldfish: { catchR: 0.9, hear: 3.2, swims: true, max: { day: 5, dusk: 5, dawn: 5, night: 5 } },
  sparrow: { catchR: 0.68, hear: 6.6, max: { day: 6, dusk: 3, dawn: 6, night: 0 } },
  mackerel: { catchR: 1.0, hear: 0, flying: true, max: { day: 1, dusk: 1, dawn: 1, night: 1 } },
  sock: { catchR: 0.85, item: true, flying: true, max: { day: 1, dusk: 1, dawn: 1, night: 1 } },
  shell: { catchR: 0.7, item: true, max: { day: 3, dusk: 3, dawn: 3, night: 3 } },
  pinecone: { catchR: 0.7, item: true, max: { day: 3, dusk: 3, dawn: 3, night: 3 } },
  mushroom: { catchR: 0.7, item: true, max: { day: 2, dusk: 2, dawn: 2, night: 2 } },
};
const SPARROW_HAUNTS = [[9, 7], [-2, 7], [17, 4], [7, 22], [21, 20], [-9, 25], [11, 40], [16, -7]];

class Critter {
  constructor(type, mesh) {
    this.type = type; this.spec = SPEC[type]; this.mesh = mesh; this.pos = mesh.position;
    this.vel = new V3(); this.home = new V3(); this.goal = new V3(); this.aimPoint = new V3();
    this.state = 'idle'; this.t = 0; this.seed = Math.random() * 100; this.yaw = Math.random() * TAU;
    this.alive = true; this.carried = false; this.catchable = true; this.cool = 0; this.age = 0;
  }
}

export class Wildlife {
  constructor(scene, { flowers, spots, fx, trees }) {
    this.scene = scene; this.flowers = flowers; this.spots = spots; this.fx = fx;
    this.pines = trees.filter((t) => t.pine && woodsAt(t.x, t.z) > 0.3);
    this.list = [];
    this.emit = () => {};
    this.spawnTimer = 0; this.glintTimer = 0; this.time = 0;
    this.respawn = { sock: 0, shell: 0, pinecone: 0, mushroom: 0 };
    this.nightEyes = false;
    this.nearest = null;

    // The red dot.
    const dot = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff1a1a', fog: false }));
    disc.position.y = 0.02;
    const halo = glowSprite('#ff2a2a', 0.34); halo.position.y = 0.1;
    dot.add(disc, halo);
    dot.visible = false;
    scene.add(dot);
    this.dot = { mesh: dot, active: false, t: 0, wait: 18, goal: new V3(), hits: 0, hop: 0, total: 0 };
  }

  count(type) { let n = 0; for (const c of this.list) if (c.type === type && c.alive && !c.carried) n++; return n; }

  // ---- Spawning ---------------------------------------------------------------------
  findSpot(pred, pp, minDist, tries = 40, range = 96) {
    for (let i = 0; i < tries; i++) {
      const x = rand(-range, range), z = rand(-range, range);
      if (Math.hypot(x - pp.x, z - pp.z) < minDist) continue;
      if (pred(x, z)) return tmp.set(x, heightAt(x, z), z);
    }
    return null;
  }

  spawn(type, pp, minDist) {
    let spot = null, c;
    const make = () => { const m = BUILD[MODEL[type]](); this.scene.add(m); return new Critter(type, m); };
    switch (type) {
      case 'butterfly': {
        for (let i = 0; i < 20 && !spot; i++) { const f = pick(this.flowers); if (Math.hypot(f.x - pp.x, f.z - pp.z) > minDist) spot = f; }
        if (!spot) return;
        c = make(); c.home.set(spot.x, spot.y + spot.h, spot.z); c.pos.copy(c.home); c.pos.y += 0.5; c.goal.copy(c.pos); c.state = 'flit';
        break;
      }
      case 'firefly': {
        spot = this.findSpot((x, z) => heightAt(x, z) > 1.4 && grassAt(x, z) > 0.3 && (woodsAt(x, z) > 0.15 || tallGrassAt(x, z) > 0.3 || Math.hypot(x - POND.x, z - POND.z) < 24 || Math.hypot(x - 4, z - 4) < 22), pp, minDist * 0.5, 40, 70);
        if (!spot) return;
        c = make(); c.home.copy(spot); c.home.y += rand(0.6, 1.4); c.pos.copy(c.home);
        break;
      }
      case 'moth': {
        const lamp = this.count('moth') % 2 === 0 ? this.spots.porchLamp : this.spots.dockLamp;
        c = make(); c.home.copy(lamp); c.pos.copy(lamp); c.pos.x += 0.6;
        break;
      }
      case 'frog': {
        for (let i = 0; i < 20 && !spot; i++) {
          const a = rand(0, TAU), r = POND.r + rand(0.5, 2.2);
          const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
          if (Math.hypot(x - pp.x, z - pp.z) > minDist * 0.7) spot = tmp.set(x, heightAt(x, z), z);
        }
        if (!spot) return;
        c = make(); c.pos.copy(spot); c.yaw = Math.atan2(POND.x - spot.x, POND.z - spot.z) + rand(-1, 1);
        break;
      }
      case 'dragonfly': {
        c = make(); const a = rand(0, TAU), r = rand(2, POND.r);
        c.pos.set(POND.x + Math.cos(a) * r, POND.level + 0.9, POND.z + Math.sin(a) * r); c.goal.copy(c.pos); c.t = rand(0.5, 2);
        break;
      }
      case 'crab': {
        spot = this.findSpot((x, z) => isBeach(x, z) && heightAt(x, z) > 0.2 && heightAt(x, z) < 0.65 && Math.abs(x - DOCK.x) > 3, pp, minDist, 60, 110);
        if (!spot) return;
        c = make(); c.pos.copy(spot); c.t = rand(0, 2);
        break;
      }
      case 'mouse': {
        spot = this.findSpot((x, z) => tallGrassAt(x, z) > 0.6, pp, minDist, 60, 80);
        if (!spot) return;
        c = make(); c.pos.copy(spot); c.goal.copy(spot); c.home.copy(spot);
        break;
      }
      case 'goldfish': {
        c = make(); const a = rand(0, TAU), r = rand(2, POND.r - 3);
        c.pos.set(POND.x + Math.cos(a) * r, POND.level - 0.07, POND.z + Math.sin(a) * r);
        break;
      }
      case 'sparrow': {
        const h = pick(SPARROW_HAUNTS);
        const x = h[0] + rand(-3.5, 3.5), z = h[1] + rand(-3.5, 3.5);
        if (Math.hypot(x - pp.x, z - pp.z) < minDist || tallGrassAt(x, z) > 0.3 || heightAt(x, z) < 1.2) return;
        c = make(); c.pos.set(x, heightAt(x, z), z); c.home.set(h[0], 0, h[1]);
        // Arrive by air unless the game is just starting.
        if (minDist > 8) { c.state = 'arrive'; c.goal.copy(c.pos); c.pos.y += 9; c.pos.x += rand(-8, 8); c.pos.z += rand(-8, 8); }
        break;
      }
      case 'mackerel': {
        c = make(); c.state = 'wait'; c.t = rand(2, 4); c.catchable = false; c.mesh.visible = false;
        break;
      }
      case 'sock': {
        c = make(); c.pos.copy(this.spots.sockLine); c.home.copy(this.spots.sockLine);
        break;
      }
      case 'shell': {
        spot = this.findSpot((x, z) => isBeach(x, z) && heightAt(x, z) > 0.25, pp, minDist, 60, 110);
        if (!spot) return;
        c = make(); c.pos.copy(spot); c.mesh.rotation.y = rand(0, TAU);
        break;
      }
      case 'pinecone': {
        const t = pick(this.pines);
        if (!t) return;
        const a = rand(0, TAU), x = t.x + Math.cos(a) * rand(0.9, 1.8), z = t.z + Math.sin(a) * rand(0.9, 1.8);
        c = make(); c.pos.set(x, heightAt(x, z), z); c.mesh.rotation.set(rand(-0.4, 0.4) + Math.PI / 2, rand(0, TAU), 0); c.pos.y += 0.05;
        break;
      }
      case 'mushroom': {
        spot = this.findSpot((x, z) => woodsAt(x, z) > 0.55 && heightAt(x, z) > 3, pp, minDist, 60, 70);
        if (!spot) return;
        c = make(); c.pos.copy(spot); c.mesh.scale.setScalar(1.25);
        break;
      }
    }
    if (c) { c.mesh.rotation.y = c.mesh.rotation.y || c.yaw; this.list.push(c); }
    return c;
  }

  populate(period, pp) {
    for (let i = 0; i < 90; i++) this.spawnTick(period, pp, 5);
  }
  spawnTick(period, pp, minDist) {
    const types = Object.keys(SPEC);
    const type = types[(Math.random() * types.length) | 0];
    if (this.respawn[type] > 0) return;
    if (this.count(type) < SPEC[type].max[period]) this.spawn(type, pp, minDist);
  }

  remove(c) {
    c.alive = false;
    if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
  }

  // ---- Per-frame -------------------------------------------------------------------------
  update(dt, player, env) {
    this.time += dt;
    const pp = player.pos, period = env.period, noise = player.noise;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 0.35; this.spawnTick(period, pp, 13); }
    for (const k in this.respawn) this.respawn[k] = Math.max(0, this.respawn[k] - dt);

    let nearest = null, nearestD = 9;
    const ctx = { dt, player, pp, noise, env, period, time: this.time };
    for (const c of this.list) {
      if (!c.alive) continue;
      c.age += dt; c.cool = Math.max(0, c.cool - dt);
      if (c.carried) continue;
      if (c.state === 'delivered') {
        c.t += dt;
        if (c.t > 7) { c.mesh.scale.multiplyScalar(Math.max(0, 1 - dt * 5)); if (c.t > 7.6) this.remove(c); }
        continue;
      }
      const dx = c.pos.x - pp.x, dz = c.pos.z - pp.z;
      ctx.dist = Math.hypot(dx, dz); ctx.dx = dx; ctx.dz = dz;
      ctx.heard = c.spec.hear > 0 && ctx.dist < c.spec.hear * noise;
      this[c.type](c, ctx);
      if (!c.alive) continue;
      // Out of season and out of sight: quietly leave.
      if (c.spec.max[period] === 0 && ctx.dist > 24) { this.remove(c); continue; }
      if (c.catchable && !c.spec.item && ctx.dist < nearestD) { nearestD = ctx.dist; nearest = c; }
    }
    this.nearest = nearest;
    for (let i = this.list.length - 1; i >= 0; i--) if (!this.list[i].alive) this.list.splice(i, 1);

    if (this.nightEyes && env.night > 0.5) {
      this.glintTimer -= dt;
      if (this.glintTimer <= 0) {
        this.glintTimer = 0.55;
        for (const c of this.list) if (c.catchable && !c.carried && c.state !== 'delivered' && c.type !== 'firefly' && c.pos.distanceToSquared(pp) < 1600) this.fx.glint(c.pos);
      }
    }
    this.updateDot(dt, player, env);
  }

  alarm(c, ctx, state = 'flee') {
    if (c.state === state) return;
    c.state = state; c.t = 0;
    tmp.copy(c.pos); tmp.y += 0.35;
    this.fx.sprite('bang', tmp, { life: 0.7, scale: 0.26, rise: 0.5 });
    this.emit('alarm', c);
  }

  // ---- Behaviours ----------------------------------------------------------------------------
  butterfly(c, { dt, pp, heard, time, dx, dz, dist }) {
    c.t -= dt;
    if (heard && c.state !== 'flee') { this.alarm(c, null); c.t = 2.6; }
    if (c.state === 'flee') {
      const k = 1 / (dist || 1);
      c.goal.set(c.pos.x + dx * k * 2, heightAt(c.pos.x, c.pos.z) + 2.3, c.pos.z + dz * k * 2);
      if (c.t <= 0) { c.state = 'flit'; c.t = 0; }
    } else if (c.t <= 0) {
      if (c.state === 'flit' && Math.random() < 0.3) { c.state = 'perch'; c.t = rand(2, 4); c.goal.copy(c.home); c.goal.y += 0.03; } else {
        c.state = 'flit'; c.t = rand(1.2, 3);
        if (Math.random() < 0.3) { const f = pick(this.flowers); if (Math.hypot(f.x - c.home.x, f.z - c.home.z) < 9) c.home.set(f.x, f.y + f.h, f.z); }
        c.goal.set(c.home.x + rand(-1.3, 1.3), c.home.y + rand(0.25, 0.75), c.home.z + rand(-1.3, 1.3));
      }
    }
    const speed = c.state === 'flee' ? 2.7 : c.state === 'perch' ? 1.4 : 1.1;
    tmp.subVectors(c.goal, c.pos);
    const d = tmp.length();
    if (d > 0.03) { c.pos.addScaledVector(tmp, Math.min(1, (speed * dt) / d)); c.yaw = dampAngle(c.yaw, Math.atan2(tmp.x, tmp.z), 6, dt); }
    const perched = c.state === 'perch' && d < 0.06;
    if (!perched) c.pos.y += Math.sin(time * 9 + c.seed) * 0.35 * dt;
    c.mesh.rotation.y = c.yaw;
    const flap = perched ? Math.sin(time * 3 + c.seed) * 0.5 + 0.6 : Math.sin(time * 26 + c.seed) * 0.95 + 0.25;
    c.mesh.userData.wings[0].rotation.z = flap; c.mesh.userData.wings[1].rotation.z = -flap;
    c.aimPoint.copy(c.pos); c.aimPoint.y -= 0.4 * CAT_SCALE;
  }

  firefly(c, { dt, time }) {
    const s = c.seed;
    c.pos.x = damp(c.pos.x, c.home.x + Math.sin(time * 0.31 + s) * 2.2 + Math.sin(time * 0.83 + s * 2) * 0.6, 1.5, dt);
    c.pos.z = damp(c.pos.z, c.home.z + Math.cos(time * 0.27 + s * 1.3) * 2.2 + Math.cos(time * 0.9 + s) * 0.6, 1.5, dt);
    c.pos.y = c.home.y + Math.sin(time * 0.6 + s) * 0.35;
    const g = Math.max(0, Math.sin(time * 1.6 + s * 3));
    c.mesh.userData.glow.scale.setScalar(0.25 + g * 0.5);
    c.mesh.userData.glow.material.opacity = 0.35 + g * 0.65;
    c.aimPoint.copy(c.pos); c.aimPoint.y -= 0.4 * CAT_SCALE;
  }

  moth(c, { dt, time }) {
    const s = c.seed, a = time * (1.5 + (s % 1) * 0.8) + s;
    const r = 0.55 + Math.sin(time * 2.3 + s) * 0.22;
    c.pos.set(c.home.x + Math.cos(a) * r, c.home.y - 0.25 + Math.sin(time * 3.1 + s) * 0.22, c.home.z + 0.35 + Math.sin(a) * r);
    c.mesh.rotation.y = -a;
    const flap = Math.sin(time * 34 + s) * 0.9 + 0.2;
    c.mesh.userData.wings[0].rotation.z = flap; c.mesh.userData.wings[1].rotation.z = -flap;
    c.aimPoint.copy(c.home); c.aimPoint.y -= 0.25 + 0.4 * CAT_SCALE; c.aimPoint.z += 0.35;
  }

  dragonfly(c, { dt, time, heard, dx, dz, dist }) {
    c.t -= dt;
    if (heard && c.cool <= 0) {
      c.cool = 0.9; c.t = rand(1, 2);
      const k = 1 / (dist || 1);
      c.goal.set(c.pos.x + dx * k * 5, POND.level + rand(0.9, 1.6), c.pos.z + dz * k * 5);
      this.emit('alarm', c);
    } else if (c.t <= 0) {
      c.t = rand(2, 4.5);
      // Dragonflies like the reedy margin, which is also where a cat can reach them.
      const a = rand(0, TAU), r = Math.random() < 0.65 ? rand(POND.r - 2.5, POND.r + 2) : rand(1, POND.r);
      c.goal.set(POND.x + Math.cos(a) * r, 0, POND.z + Math.sin(a) * r);
      c.goal.y = Math.max(POND.level, heightAt(c.goal.x, c.goal.z)) + rand(0.55, 1.15);
    }
    // Keep it over the pond and its banks.
    const gx = c.goal.x - POND.x, gz = c.goal.z - POND.z, gr = Math.hypot(gx, gz);
    if (gr > POND.r + 4) { c.goal.x = POND.x + (gx / gr) * (POND.r + 3); c.goal.z = POND.z + (gz / gr) * (POND.r + 3); }
    tmp.subVectors(c.goal, c.pos);
    const d = tmp.length();
    if (d > 0.05) { c.pos.addScaledVector(tmp, Math.min(1, (7.5 * dt) / d)); c.yaw = Math.atan2(tmp.x, tmp.z); c.vel.copy(tmp).multiplyScalar(d > 0.4 ? 7.5 / d : 0); } else c.vel.set(0, 0, 0);
    c.pos.y += Math.sin(time * 5 + c.seed) * 0.1 * dt;
    c.mesh.rotation.y = c.yaw;
    c.mesh.userData.wings.forEach((w, i) => { w.rotation.z = Math.sin(time * 60 + i * 1.6) * 0.5 * (i % 2 ? -1 : 1); });
    c.aimPoint.copy(c.pos); c.aimPoint.y -= 0.4 * CAT_SCALE;
  }

  frog(c, ctx) {
    const { dt, heard } = ctx;
    c.t -= dt;
    const ground = heightAt(c.pos.x, c.pos.z);
    if (heard && c.state === 'idle') { this.alarm(c, ctx, 'flee'); c.t = 0.12; c.yaw = Math.atan2(POND.x - c.pos.x, POND.z - c.pos.z) + rand(-0.4, 0.4); }
    if (c.state === 'air') {
      c.vel.y -= 16 * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y <= ground && c.vel.y < 0) {
        c.pos.y = ground;
        if (waterDepthAt(c.pos.x, c.pos.z) > 0.2) {
          tmp.set(c.pos.x, POND.level, c.pos.z);
          this.fx.splash(tmp, 0.25); this.emit('plop', c);
          this.remove(c);
          return;
        }
        c.state = c.fleeing ? 'flee' : 'idle'; c.t = c.fleeing ? 0.16 : rand(2, 6);
      }
    } else if (c.t <= 0) {
      if (c.state === 'flee') { c.fleeing = true; this.hop(c, 3.4, 3.8); } else if (Math.random() < 0.35) { this.emit('croak', c); c.t = rand(2, 6); } else { c.yaw += rand(-1.2, 1.2); this.hop(c, 1.1, 2.4); }
    }
    c.mesh.rotation.y = c.yaw;
    const stretch = c.state === 'air' ? 1.2 : 1;
    c.mesh.scale.set(1.15 / Math.sqrt(stretch), 1.15, 1.15 * stretch);
    c.aimPoint.copy(c.pos).addScaledVector(c.vel, c.state === 'air' ? 0.25 : 0);
    c.aimPoint.y = heightAt(c.aimPoint.x, c.aimPoint.z);
  }
  hop(c, speed, up) {
    c.state = 'air'; c.vel.set(Math.sin(c.yaw) * speed, up, Math.cos(c.yaw) * speed); c.pos.y += 0.02;
  }

  crab(c, ctx) {
    const { dt, heard, dist, dx, dz, player, time } = ctx;
    c.t -= dt;
    const h = heightAt(c.pos.x, c.pos.z);
    let speed = 0;
    if (heard && c.state !== 'flee') { this.alarm(c, ctx); c.fleeDir = seaward(c.pos, tmp2).clone(); }
    if (c.state === 'flee') {
      speed = 3.3;
      c.yaw = dampAngle(c.yaw, Math.atan2(c.fleeDir.x, c.fleeDir.z) + Math.PI / 2, 10, dt);
      c.pos.x += c.fleeDir.x * speed * dt; c.pos.z += c.fleeDir.z * speed * dt;
      if (h < -0.3) { tmp.set(c.pos.x, 0, c.pos.z); this.fx.ripple(tmp); this.remove(c); return; }
    } else {
      if (c.t <= 0) { c.t = rand(1.5, 4); c.state = c.state === 'walk' ? 'idle' : 'walk'; c.dir = Math.random() < 0.5 ? 1 : -1; c.yaw += rand(-0.5, 0.5); }
      if (c.state === 'walk') {
        speed = 0.75;
        // Sideways, of course.
        const sx = Math.cos(c.yaw) * c.dir, sz = -Math.sin(c.yaw) * c.dir;
        const nx = c.pos.x + sx * speed * dt, nz = c.pos.z + sz * speed * dt, nh = heightAt(nx, nz);
        if (nh > 0.12 && nh < 0.8) { c.pos.x = nx; c.pos.z = nz; } else c.dir *= -1;
      }
      // Front-on approaches get pinched.
      if (dist < 0.8 && c.cool <= 0 && player.grounded && !player.pouncing && player.pounceGrace <= 0) {
        const facing = (-dx * Math.sin(c.yaw) - dz * Math.cos(c.yaw)) / (dist || 1);
        if (facing > 0.2) { c.cool = 2.5; this.emit('pinch', c); this.alarm(c, ctx); c.fleeDir = seaward(c.pos, tmp2).clone(); }
      }
    }
    c.pos.y = heightAt(c.pos.x, c.pos.z);
    c.mesh.rotation.y = c.yaw;
    const u = c.mesh.userData;
    u.legs.forEach((l, i) => { l.rotation.x = Math.sin(time * (speed > 0 ? 22 : 0) + i * 2.1) * 0.5; });
    const snap = c.state === 'flee' || dist < 3 ? Math.abs(Math.sin(time * 9)) * 0.5 : 0;
    u.claws[0].rotation.z = 0.3 + snap; u.claws[1].rotation.z = -0.3 - snap;
    u.claws[0].position.y = u.claws[1].position.y = 0.08 + (dist < 3.5 ? 0.06 : 0);
    c.aimPoint.copy(c.pos);
    if (c.state === 'flee') c.aimPoint.addScaledVector(c.fleeDir, 3.3 * 0.4);
  }

  mouse(c, ctx) {
    const { dt, heard, dist, dx, dz, time } = ctx;
    c.t -= dt;
    let speed = 0;
    if (heard && c.state !== 'flee') { this.alarm(c, ctx); c.t = 3.2; this.emit('squeak', c); }
    if (c.state === 'flee') {
      speed = 5.4;
      const k = 1 / (dist || 1);
      const zig = Math.sin(time * 7 + c.seed) * 0.6;
      c.yaw = dampAngle(c.yaw, Math.atan2(dx * k, dz * k) + zig, 9, dt);
      if (c.t <= 0 || dist > 15) { tmp.copy(c.pos); this.fx.dust(tmp, 0.3); this.remove(c); return; }
    } else if (c.state === 'walk') {
      speed = 1.3;
      tmp.subVectors(c.goal, c.pos); tmp.y = 0;
      if (tmp.length() < 0.2 || c.t <= 0) { c.state = 'idle'; c.t = rand(0.8, 3); } else c.yaw = dampAngle(c.yaw, Math.atan2(tmp.x, tmp.z), 8, dt);
    } else if (c.t <= 0) {
      for (let i = 0; i < 6; i++) {
        const x = c.pos.x + rand(-5, 5), z = c.pos.z + rand(-5, 5);
        if (tallGrassAt(x, z) > 0.5) { c.goal.set(x, 0, z); c.state = 'walk'; c.t = 5; break; }
      }
      if (c.state !== 'walk') c.t = 1;
    }
    c.pos.x += Math.sin(c.yaw) * speed * dt; c.pos.z += Math.cos(c.yaw) * speed * dt;
    if (waterDepthAt(c.pos.x, c.pos.z) > 0) { c.pos.x -= Math.sin(c.yaw) * speed * dt * 2; c.pos.z -= Math.cos(c.yaw) * speed * dt * 2; c.yaw += 2; }
    c.pos.y = heightAt(c.pos.x, c.pos.z) + (speed > 0 ? Math.abs(Math.sin(time * 18 + c.seed)) * 0.02 : 0);
    c.mesh.rotation.y = c.yaw;
    c.mesh.userData.tail.rotation.y = Math.sin(time * (speed > 2 ? 20 : 3) + c.seed) * 0.5;
    c.mesh.scale.setScalar(1.25);
    c.aimPoint.set(c.pos.x + Math.sin(c.yaw) * speed * 0.4, c.pos.y, c.pos.z + Math.cos(c.yaw) * speed * 0.4);
  }

  goldfish(c, ctx) {
    const { dt, dist, dx, dz, player, time } = ctx;
    let speed = 0.75;
    const scared = dist < c.spec.hear && (player.swimming || player.wading > 0.3);
    if (scared) { c.state = 'flee'; c.t = 1.6; }
    if (c.state === 'flee') {
      c.t -= dt; speed = 3.2;
      c.yaw = dampAngle(c.yaw, Math.atan2(dx, dz), 6, dt);
      if (c.t <= 0) c.state = 'idle';
    } else c.yaw += Math.sin(time * 0.5 + c.seed) * 0.6 * dt;
    // Stay in the deep part.
    const px = c.pos.x - POND.x, pz = c.pos.z - POND.z, pr = Math.hypot(px, pz);
    if (pr > POND.r - 3.2) c.yaw = dampAngle(c.yaw, Math.atan2(-px, -pz), 3.5, dt);
    c.pos.x += Math.sin(c.yaw) * speed * dt; c.pos.z += Math.cos(c.yaw) * speed * dt;
    c.pos.y = POND.level - 0.075 + Math.sin(time * 0.8 + c.seed) * 0.03;
    c.mesh.rotation.y = c.yaw;
    c.mesh.userData.tail.rotation.y = Math.sin(time * (4 + speed * 4) + c.seed) * 0.6;
    c.aimPoint.set(c.pos.x + Math.sin(c.yaw) * speed * 0.5, POND.level - 0.2, c.pos.z + Math.cos(c.yaw) * speed * 0.5);
  }

  sparrow(c, ctx) {
    const { dt, heard, dist, dx, dz, time } = ctx;
    c.t -= dt;
    const u = c.mesh.userData;
    if (c.state === 'arrive') {
      tmp.subVectors(c.goal, c.pos);
      const d = tmp.length();
      c.pos.addScaledVector(tmp, Math.min(1, (6 * dt) / (d || 1)));
      c.yaw = Math.atan2(tmp.x, tmp.z);
      if (d < 0.1) { c.state = 'idle'; c.t = 1; }
      this.flap(u, time, 1);
      c.catchable = d < 2;
    } else if (c.state === 'flee') {
      c.vel.y += 9 * dt;
      c.pos.addScaledVector(c.vel, dt);
      this.flap(u, time, 1);
      if (c.t <= 0) { this.remove(c); return; }
      c.catchable = c.t > 3.3;
    } else {
      if (heard) {
        this.alarm(c, ctx); c.t = 4; this.emit('takeoff', c);
        const k = 1 / (dist || 1);
        c.vel.set(dx * k * 4.5, 2.2, dz * k * 4.5); c.yaw = Math.atan2(dx, dz);
        // One goes, they all go.
        for (const o of this.list) if (o.type === 'sparrow' && o !== c && o.state !== 'flee' && o.state !== 'arrive' && o.pos.distanceTo(c.pos) < 5) { o.state = 'flee'; o.t = 4; o.vel.set(dx * k * 4 + rand(-1, 1), 2.4, dz * k * 4 + rand(-1, 1)); o.yaw = Math.atan2(o.vel.x, o.vel.z); }
      } else if (c.t <= 0) {
        c.t = rand(0.35, 1.1);
        if (Math.random() < 0.55) { c.peck = 0.4; } else {
          c.yaw += rand(-1.3, 1.3);
          const nx = c.pos.x + Math.sin(c.yaw) * 0.35, nz = c.pos.z + Math.cos(c.yaw) * 0.35;
          if (Math.hypot(nx - c.home.x, nz - c.home.z) < 5 && heightAt(nx, nz) > 1) { c.pos.x = nx; c.pos.z = nz; c.hopT = 0.18; } else c.yaw += Math.PI;
        }
      }
      c.hopT = Math.max(0, (c.hopT || 0) - dt); c.peck = Math.max(0, (c.peck || 0) - dt);
      c.pos.y = heightAt(c.pos.x, c.pos.z) + Math.sin((c.hopT / 0.18) * Math.PI) * 0.07;
      u.head.rotation.x = c.peck > 0 ? Math.sin((c.peck / 0.4) * Math.PI * 2) ** 2 * 0.9 : 0;
      u.head.position.y = 0.15 - (c.peck > 0 ? Math.sin((c.peck / 0.4) * Math.PI * 2) ** 2 * 0.07 : 0);
      this.flap(u, time, 0);
    }
    c.mesh.rotation.y = c.yaw;
    c.mesh.scale.setScalar(1.2);
    c.aimPoint.copy(c.pos);
    if (c.state === 'flee') { c.aimPoint.addScaledVector(c.vel, 0.3); c.aimPoint.y -= 0.4 * CAT_SCALE; }
  }
  flap(u, time, on) {
    const a = on ? Math.sin(time * 30) * 1.0 : -1.25;
    u.wings[0].rotation.z = on ? a : 1.25; u.wings[1].rotation.z = on ? -a : -1.25;
    u.wings[0].rotation.y = on ? 0 : -1.2; u.wings[1].rotation.y = on ? 0 : 1.2;
  }

  mackerel(c, { dt, period, time }) {
    c.t -= dt;
    if (c.state === 'wait') {
      if (c.t <= 0) {
        for (let i = 0; i < 12; i++) {
          const x = DOCK.x + pick([-1, 1]) * rand(2.4, 5.2), z = rand(DOCK.z1 - 10, DOCK.z1 + 1.5);
          if (waterDepthAt(x, z) > 0.7) { c.pos.set(x, -0.2, z); c.state = 'tell'; c.t = 1.0; c.rip = 0; break; }
        }
        if (c.state === 'wait') c.t = 1;
      }
    } else if (c.state === 'tell') {
      c.rip -= dt;
      if (c.rip <= 0) { c.rip = 0.3; tmp.set(c.pos.x, 0.02, c.pos.z); this.fx.ripple(tmp); }
      if (c.t <= 0) {
        // Leap roughly parallel to the dock so a pounce from the planks can meet it.
        const dir = pick([-1, 1]), a = rand(-0.5, 0.5);
        c.vel.set(Math.sin(a) * 1.9, 5.3, Math.cos(a) * 1.9 * dir);
        c.state = 'leap'; c.catchable = true; c.mesh.visible = true;
        tmp.set(c.pos.x, 0, c.pos.z); this.fx.splash(tmp, 0.35); this.emit('leap', c);
      }
    } else if (c.state === 'leap') {
      c.vel.y -= 9.6 * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.mesh.rotation.set(-Math.atan2(c.vel.y, Math.hypot(c.vel.x, c.vel.z)), Math.atan2(c.vel.x, c.vel.z), 0, 'YXZ');
      c.mesh.userData.tail.rotation.y = Math.sin(time * 30) * 0.7;
      if (c.pos.y < -0.15 && c.vel.y < 0) {
        tmp.set(c.pos.x, 0, c.pos.z); this.fx.splash(tmp, 0.4); this.emit('plop', c);
        c.state = 'wait'; c.catchable = false; c.mesh.visible = false;
        c.t = period === 'dusk' || period === 'dawn' ? rand(1.2, 3) : rand(2.5, 5.5);
      }
    }
  }

  sock(c, { time }) {
    c.mesh.rotation.z = Math.sin(time * 1.4 + 2) * 0.2;
    c.aimPoint.copy(c.pos); c.aimPoint.y -= 0.2 + 0.4 * CAT_SCALE;
    // Catching uses the dangling end, not the peg.
  }
  shell(c) { c.aimPoint.copy(c.pos); }
  pinecone(c) { c.aimPoint.copy(c.pos); }
  mushroom(c) { c.aimPoint.copy(c.pos); }

  // ---- The red dot ----------------------------------------------------------------------------
  updateDot(dt, player, env) {
    const d = this.dot;
    if (!d.active) {
      if (env.night > 0.85) d.wait -= dt;
      const nearHome = Math.hypot(player.pos.x - COTTAGE.x, player.pos.z - (COTTAGE.z + 10)) < 30;
      if (d.wait <= 0 && nearHome) {
        d.active = true; d.t = 24; d.hits = 0; d.mesh.visible = true;
        d.mesh.position.set(COTTAGE.x + rand(-4, 4), 0, COTTAGE.z + rand(7, 12));
        d.goal.copy(d.mesh.position);
        this.emit('dot-on');
      }
      return;
    }
    d.t -= dt; d.hop -= dt;
    const p = d.mesh.position;
    if (d.hop <= 0) {
      d.hop = rand(0.25, 1.1);
      d.goal.set(clamp(p.x + rand(-2.6, 2.6), COTTAGE.x - 9, COTTAGE.x + 9), 0, clamp(p.z + rand(-2.6, 2.6), COTTAGE.z + 5.5, COTTAGE.z + 15));
    }
    p.x = damp(p.x, d.goal.x, 14, dt); p.z = damp(p.z, d.goal.z, 14, dt);
    p.y = heightAt(p.x, p.z) + 0.02;
    if ((player.pouncing || player.pounceGrace > 0) && Math.hypot(player.pos.x - p.x, player.pos.z - p.z) < 0.75 && Math.abs(player.pos.y - p.y) < 0.7) {
      d.hits++; d.total++;
      tmp.copy(p); tmp.y += 0.2;
      this.fx.sparkle(tmp, [1, 0.2, 0.2], 16);
      const a = rand(0, TAU);
      d.goal.set(clamp(p.x + Math.cos(a) * 5, COTTAGE.x - 9, COTTAGE.x + 9), 0, clamp(p.z + Math.sin(a) * 5, COTTAGE.z + 5.5, COTTAGE.z + 15));
      d.hop = 0.9;
      this.emit('dot-hit', d);
    }
    if (d.t <= 0 || env.night < 0.5 || d.hits >= 3) {
      d.active = false; d.mesh.visible = false; d.wait = rand(40, 70);
      this.emit('dot-off', d);
    }
  }

  // ---- Catching and carrying ----------------------------------------------------------------------
  /** Best thing to home a pounce onto, or null. */
  findTarget(player, power) {
    const boost = player.upgrades.springy ? 1.35 : 1;
    const range = pounceRange(power, player.upgrades.springy) * 1.1;
    const T = pounceTime(power, player.upgrades.springy);
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    let best = null, bestScore = 1e9;
    for (const c of this.list) {
      if (!c.alive || c.carried || !c.catchable || c.state === 'delivered') continue;
      if (c.type === 'mackerel') {
        // A leaping fish is met where it will be when the cat gets there.
        c.aimPoint.set(c.pos.x + c.vel.x * T, Math.max(0.15, c.pos.y + c.vel.y * T - 4.8 * T * T) - 0.4 * CAT_SCALE, c.pos.z + c.vel.z * T);
      }
      const dx = c.aimPoint.x - player.pos.x, dz = c.aimPoint.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.25) continue;
      if (c.aimPoint.y - player.pos.y > 3.4 * boost) continue;
      const ang = Math.acos(clamp((dx * fx + dz * fz) / d, -1, 1));
      if (ang > lerp(0.75, 0.36, clamp(d / 5))) continue;
      const score = ang * 3 + d * 0.12;
      if (score < bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /** Anything within reach of the mouth while pouncing. */
  tryCatch(player) {
    if (!(player.pouncing || player.pounceGrace > 0)) return null;
    const cp = player.catchPoint(tmp2);
    for (const c of this.list) {
      if (!c.alive || c.carried || !c.catchable || c.state === 'delivered') continue;
      const s = c.spec;
      let px = c.pos.x, py = c.pos.y, pz = c.pos.z;
      if (c.type === 'sock') py -= 0.2;
      const dh = Math.hypot(px - cp.x, pz - cp.z), dy = py - cp.y;
      const R = s.catchR;
      const hit = s.swims ? dh < R && player.pos.y < POND.level + 1.3
        : s.flying ? Math.hypot(dh, dy * 0.8) < R
          : dh < R && dy > -1.1 && dy < 0.6;
      if (hit) return c;
    }
    return null;
  }

  /** Nearest loose object that can simply be picked up with E. */
  pickupNear(player) {
    let best = null, bd = 1.5;
    for (const c of this.list) {
      if (!c.alive || c.carried || !c.spec.item || c.type === 'sock' || c.state === 'delivered') continue;
      const d = c.pos.distanceTo(player.pos);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Put a caught critter in the cat's mouth. */
  carry(c, cat, visible) {
    c.carried = true; c.catchable = false;
    if (this.respawn[c.type] !== undefined) this.respawn[c.type] = c.type === 'sock' ? 100 : 60;
    const m = c.mesh;
    cat.mouth.add(m);
    m.position.set(0, -0.015, 0.02);
    m.rotation.set(0, Math.PI / 2, c.spec.item ? 0 : 0.25);
    const k = { mackerel: 0.55, goldfish: 0.7, sock: 0.75, crab: 0.7, sparrow: 0.75, frog: 0.75 }[c.type] || 0.85;
    m.scale.setScalar(k / CAT_SCALE);
    if (c.type === 'sock') { m.rotation.set(0, 0, Math.PI / 2); m.position.set(0.09, -0.01, 0.02); }
    if (c.type === 'firefly') m.userData.glow.scale.setScalar(0.3);
    m.visible = visible;
    m.traverse((o) => { o.castShadow = false; });
  }

  /** Lay a carried critter on the doormat. */
  deliver(c, where) {
    const m = c.mesh;
    c.carried = false; c.state = 'delivered'; c.t = 0;
    this.scene.add(m);
    m.visible = true;
    m.scale.setScalar(1);
    m.position.copy(where);
    m.rotation.set(0, rand(0, TAU), c.spec.item || c.type === 'crab' || c.type === 'frog' || c.type === 'mouse' ? 0 : Math.PI / 2);
    if (c.type === 'sock') { m.rotation.set(Math.PI / 2, rand(0, TAU), 0); m.position.y += 0.05; }
    if (c.type === 'goldfish' || c.type === 'mackerel' || c.type === 'butterfly' || c.type === 'moth' || c.type === 'dragonfly') m.position.y += 0.05;
  }

  /** Small transparent pictures of each gift, rendered from the real models, for the journal. */
  renderIcons(renderer) {
    const size = 128;
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#8a8a70', 2.2));
    const sun = new THREE.DirectionalLight('#fff3dd', 2.5); sun.position.set(2, 4, 3); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 20);
    const out = {};
    const box = new THREE.Box3(), centre = new V3(), sz = new V3();
    const buf = new Uint8Array(size * size * 4);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    for (const type of Object.keys(MODEL)) {
      const m = BUILD[MODEL[type]]();
      if (m.userData.wings && type !== 'sparrow') { m.userData.wings.forEach((w, i) => { w.rotation.z = (i % 2 ? -1 : 1) * 0.35; }); }
      if (type === 'sparrow') this.flap(m.userData, 0, 0);
      scene.add(m);
      box.setFromObject(m); box.getCenter(centre); box.getSize(sz);
      const r = Math.max(sz.x, sz.y, sz.z) * 0.5 + 0.02;
      const d = r / Math.tan((14 * Math.PI) / 180) * 1.15;
      cam.position.set(centre.x + d * 0.62, centre.y + d * 0.42, centre.z + d * 0.66);
      cam.lookAt(centre);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      const img = g.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      g.putImageData(img, 0, 0);
      out[type] = canvas.toDataURL('image/png');
      scene.remove(m);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClear);
    rt.dispose();
    return out;
  }
}

const tmp = new V3(), tmp2 = new V3();

/** Downhill direction: for a crab, the way to the sea. */
function seaward(p, out) {
  const e = 1.5;
  out.set(heightAt(p.x - e, p.z) - heightAt(p.x + e, p.z), 0, heightAt(p.x, p.z - e) - heightAt(p.x, p.z + e));
  if (out.lengthSq() < 1e-6) out.set(p.x, 0, p.z);
  return out.normalize();
}
