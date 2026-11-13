// Particles, floating sprites, the pounce arc and landing ring.
import * as THREE from 'three';
import { rand, TAU, lerp } from './util.js';

const MAX = 1400;

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
varying vec4 vColor;
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (520.0 / max(0.1, -mv.z));
}`;
const FRAG = /* glsl */ `
varying vec4 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.22, d) * vColor.a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor.rgb, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(scene, additive) {
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.size = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3); this.life = new Float32Array(MAX); this.max = new Float32Array(MAX);
    this.grav = new Float32Array(MAX); this.drag = new Float32Array(MAX); this.size0 = new Float32Array(MAX); this.grow = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.geo = geo;
  }
  spawn(x, y, z, vx, vy, vz, life, size, r, g, b, a = 1, grav = 0, drag = 0, grow = 0) {
    const i = this.next; this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size0[i] = size; this.grow[i] = grow;
    this.col[i * 4] = r; this.col[i * 4 + 1] = g; this.col[i * 4 + 2] = b; this.alpha[i] = a;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - k));
      this.col[i * 4 + 3] = this.alpha[i] * Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 12);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
  }
}

function glyphTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.soft = new Pool(scene, false);
    this.glow = new Pool(scene, true);

    const text = (ch, color) => glyphTexture((g) => {
      g.font = '900 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(30,20,10,0.85)'; g.strokeText(ch, 32, 35);
      g.fillStyle = color; g.fillText(ch, 32, 35);
    });
    this.textures = {
      heart: glyphTexture((g) => {
        g.fillStyle = '#ff5d7e'; g.strokeStyle = 'rgba(90,10,30,0.8)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(32, 54); g.bezierCurveTo(2, 34, 8, 8, 32, 22); g.bezierCurveTo(56, 8, 62, 34, 32, 54); g.fill(); g.stroke();
      }),
      bang: text('!', '#ffd23e'), what: text('?', '#ffffff'), zed: text('z', '#cfe3ff'),
      note: glyphTexture((g) => {
        g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(30,20,10,0.85)'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(22, 46, 11, 8, -0.3, 0, TAU); g.fill(); g.stroke();
        g.fillRect(29, 10, 5, 36); g.strokeRect(29, 10, 5, 36); g.fillRect(29, 10, 20, 9); g.strokeRect(29, 10, 20, 9);
      }),
      biscuit: glyphTexture((g) => {
        g.fillStyle = '#e2a657'; g.strokeStyle = '#7a4a1c'; g.lineWidth = 5;
        g.beginPath(); g.ellipse(32, 32, 20, 13, 0, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(48, 32); g.lineTo(60, 20); g.lineTo(60, 44); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#7a4a1c'; g.beginPath(); g.arc(22, 29, 3, 0, TAU); g.fill();
      }),
    };
    this.sprites = [];
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
      s.visible = false; s.renderOrder = 20;
      scene.add(s);
      this.sprites.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), scale: 0.3 });
    }

    // Landing ring and pounce arc.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, fog: false }),
    );
    this.ring.renderOrder = 15; this.ring.visible = false;
    this.lock = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, fog: false }),
    );
    this.lock.renderOrder = 16; this.lock.visible = false;
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    this.arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, fog: false }));
    this.arc.renderOrder = 15; this.arc.visible = false; this.arc.frustumCulled = false;
    scene.add(this.ring, this.lock, this.arc);
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.soft.update(dt); this.glow.update(dt);
    for (const p of this.sprites) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      const k = p.life / p.max;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.position.x += Math.sin(this.time * 4 + p.max * 20) * dt * 0.15;
      p.s.material.opacity = Math.min(1, k * 2.5);
      p.s.scale.setScalar(p.scale * (0.6 + Math.min(1, (1 - k) * 6) * 0.4));
    }
  }

  sprite(kind, pos, { life = 1.2, scale = 0.32, rise = 0.6 } = {}) {
    const p = this.sprites.find((q) => q.life <= 0) || this.sprites[0];
    p.s.material.map = this.textures[kind]; p.s.material.needsUpdate = true;
    p.s.position.copy(pos); p.s.visible = true;
    p.life = p.max = life; p.scale = scale; p.vel.set(rand(-0.1, 0.1), rise, rand(-0.1, 0.1));
  }

  dust(pos, strength = 1, color = [0.75, 0.68, 0.52]) {
    const n = Math.round(5 + strength * 9);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(0.5, 1.8) * (0.5 + strength);
      this.soft.spawn(pos.x, pos.y + 0.05, pos.z, Math.cos(a) * v, rand(0.2, 0.9), Math.sin(a) * v, rand(0.35, 0.7), rand(0.12, 0.22), color[0], color[1], color[2], 0.5, 0.6, 3, 1.4);
    }
  }
  splash(pos, strength = 1) {
    const n = Math.round(14 + strength * 34);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(0.5, 2.6) * (0.5 + strength * 0.6);
      this.soft.spawn(pos.x, pos.y + 0.03, pos.z, Math.cos(a) * v, rand(1.5, 4.5) * (0.5 + strength * 0.6), Math.sin(a) * v, rand(0.5, 0.95), rand(0.05, 0.11), 0.85, 0.95, 1, 0.85, 9, 0.6, 0);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      this.soft.spawn(pos.x, pos.y + 0.03, pos.z, Math.cos(a) * 1.6, 0.05, Math.sin(a) * 1.6, 0.7, 0.14, 1, 1, 1, 0.55, 0, 2.2, 1.5);
    }
  }
  spray(pos) {
    for (let i = 0; i < 46; i++) {
      const a = rand(0, TAU), v = rand(1.5, 4);
      this.soft.spawn(pos.x, pos.y + rand(0.2, 0.5), pos.z, Math.cos(a) * v, rand(0.2, 2), Math.sin(a) * v, rand(0.3, 0.6), rand(0.035, 0.07), 0.85, 0.95, 1, 0.9, 8, 1.5, 0);
    }
  }
  sparkle(pos, color = [1, 0.85, 0.35], n = 22) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), b = rand(-0.4, 1.2), v = rand(0.8, 3);
      this.glow.spawn(pos.x, pos.y, pos.z, Math.cos(a) * v * Math.cos(b), Math.sin(b) * v + 0.8, Math.sin(a) * v * Math.cos(b), rand(0.4, 0.9), rand(0.06, 0.13), color[0], color[1], color[2], 1, 3, 2.2, -0.5);
    }
  }
  smoke(pos) {
    this.soft.spawn(pos.x + rand(-0.1, 0.1), pos.y, pos.z + rand(-0.1, 0.1), rand(0.2, 0.5), rand(0.5, 0.9), rand(-0.1, 0.2), rand(3.5, 5), rand(0.35, 0.5), 0.92, 0.92, 0.95, 0.3, -0.05, 0.1, 2.2);
  }
  ripple(pos, color = [1, 1, 1]) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      this.soft.spawn(pos.x, pos.y + 0.02, pos.z, Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8, 0.9, 0.07, color[0], color[1], color[2], 0.7, 0, 1.2, 0.8);
    }
  }
  speedLine(pos, vel) {
    this.soft.spawn(pos.x + rand(-0.3, 0.3), pos.y + rand(0.1, 0.5), pos.z + rand(-0.3, 0.3), -vel.x * 0.15, 0.1, -vel.z * 0.15, 0.3, 0.06, 1, 1, 1, 0.5, 0, 1, 0.5);
  }
  glint(pos) {
    this.glow.spawn(pos.x, pos.y + 0.12, pos.z, 0, 0.1, 0, 0.45, 0.16, 0.7, 0.95, 1, 0.8, 0, 0, 0.3);
  }

  /** Draw (or hide) the pounce preview. */
  showAim(player, gravity = 24) {
    const aim = player.aim;
    this.ring.visible = this.arc.visible = aim.active;
    this.lock.visible = aim.active && !!aim.target;
    if (!aim.active) return;
    const pulse = 1 + Math.sin(this.time * 9) * 0.06;
    this.ring.position.copy(aim.point); this.ring.position.y += 0.06;
    this.ring.scale.setScalar(pulse * lerp(0.8, 1.15, aim.power));
    this.ring.material.color.set(aim.target ? 0xffd23e : 0xffffff);
    if (aim.target) {
      this.lock.position.copy(aim.target.pos); this.lock.position.y += 0.05;
      this.lock.rotation.y = this.time * 2.5;
      this.lock.scale.setScalar(1.1 + Math.sin(this.time * 12) * 0.1);
    }
    const v = player.computeLaunch(aim.power, aim.target ? aim.target.aimPoint : null, tmp);
    const arr = this.arc.geometry.attributes.position.array;
    const dx = aim.point.x - player.pos.x, dz = aim.point.z - player.pos.z;
    const total = Math.max(0.2, Math.hypot(dx, dz) / Math.max(0.1, Math.hypot(v.x, v.z)));
    for (let i = 0; i < 24; i++) {
      const t = ((i + 1) / 24) * total;
      arr[i * 3] = player.pos.x + v.x * t; arr[i * 3 + 1] = player.pos.y + 0.35 + v.y * t - 0.5 * gravity * t * t; arr[i * 3 + 2] = player.pos.z + v.z * t;
    }
    this.arc.geometry.attributes.position.needsUpdate = true;
  }
}
const tmp = new THREE.Vector3();
