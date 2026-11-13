// The other residents: Bumble the robot vacuum and a bird that visits the window.
import * as THREE from 'three';
import { WINDOWS } from './world.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

export class Robot {
  constructor(scene, world, items) {
    this.world = world;
    this.items = items;
    this.r = 0.17;
    this.top = 0.085;
    this.pos = new THREE.Vector3();
    this.delta = new THREE.Vector3();
    this.deltaYaw = 0;
    const g = (this.mesh = new THREE.Group());
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 32), std('#f1eee8', { roughness: 0.35 }));
    body.position.y = 0.045;
    const topDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.012, 32), std('#3a3940', { roughness: 0.25 }));
    topDisc.position.y = 0.083;
    const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.173, 0.173, 0.04, 32, 1, true, -Math.PI / 2.2, Math.PI / 1.1), std('#55535b'));
    bumper.position.y = 0.04;
    bumper.material.side = THREE.DoubleSide;
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 16), std('#cfd2d4', { metalness: 0.7, roughness: 0.3 }));
    btn.position.set(0, 0.091, 0.06);
    this.ledMat = new THREE.MeshBasicMaterial({ color: '#ff5a4a' });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), this.ledMat);
    led.position.set(0, 0.09, 0.11);
    // a face, because of course it has a face
    const eyeM = new THREE.MeshBasicMaterial({ color: '#7fe3ff' });
    this.eyes = [];
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), eyeM);
      e.scale.set(1, 1.4, 0.4);
      e.position.set(s * 0.04, 0.05, 0.172);
      g.add(e);
      this.eyes.push(e);
    }
    this.brush = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.003, 0.006), std('#e3a64a'));
      b.position.x = 0.035;
      const holder = new THREE.Group();
      holder.rotation.y = (i / 3) * Math.PI * 2;
      holder.add(b);
      this.brush.add(holder);
    }
    this.brush.position.set(0.11, 0.008, 0.11);
    g.add(body, topDisc, bumper, btn, led, this.brush);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    this.reset();
  }

  reset() {
    this.active = false;
    this.state = 'dock';
    this.pos.set(2.5, 0, 4.62);
    this.heading = Math.PI;
    this.turnTo = 0;
    this.speed = 0.36;
    this.blink = 0;
    this.stuck = 0;
    this.sucked = 0;
    this.ledMat.color.set('#ff5a4a');
    this._sync();
  }

  activate() {
    if (this.active) return;
    this.active = true;
    this.state = 'drive';
    this.ledMat.color.set('#4cd97b');
  }

  bonk(dir) {
    this.state = 'turn';
    this.turnTo = Math.atan2(dir.x, dir.z) + rnd(-0.5, 0.5);
    this.dizzy = 1.2;
  }

  _blocked(x, z) {
    if (x < -6.98 + this.r || x > 6.98 - this.r || z < -4.98 + this.r || z > 4.98 - this.r) return true;
    for (const c of this.world.colliders) {
      if (c.y0 > 0.09 || c.y1 < 0.02 || c.tag === 'dock') continue;
      const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1));
      if ((x - cx) ** 2 + (z - cz) ** 2 < this.r * this.r) return true;
    }
    return false;
  }

  update(dt, player, time) {
    const ox = this.pos.x, oz = this.pos.z, oh = this.heading;
    this.blink -= dt;
    if (this.blink < -3) this.blink = 0.12;
    const eyeS = this.blink > 0 ? 0.15 : 1;
    for (const e of this.eyes) e.scale.y = 1.4 * eyeS;
    if (!this.active) { this.delta.set(0, 0, 0); this.deltaYaw = 0; this._sync(); return; }
    this.brush.rotation.y += dt * 18;
    if (this.dizzy > 0) { this.dizzy -= dt; this.heading += dt * 9; }
    else if (this.state === 'turn') {
      const d = angDiff(this.heading, this.turnTo);
      const s = Math.sign(d) * Math.min(Math.abs(d), 2.4 * dt);
      this.heading += s;
      if (Math.abs(d) < 0.02) this.state = 'drive';
    } else if (this.state === 'drive') {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      if (this._blocked(nx, nz)) {
        this.state = 'turn';
        this.turnTo = this.heading + (Math.random() < 0.5 ? 1 : -1) * rnd(1.6, 3.2);
        this.stuck++;
      } else {
        this.pos.x = nx; this.pos.z = nz;
        this.stuck = 0;
        // occasional lazy curve
        this.heading += Math.sin(time * 0.37) * 0.15 * dt;
      }
      if (this.stuck > 8) { // wedged: nudge free
        this.pos.x += rnd(-0.05, 0.05); this.pos.z += rnd(-0.05, 0.05);
        if (this._blocked(this.pos.x, this.pos.z)) { this.pos.x = ox; this.pos.z = oz; }
      }
    }
    // push floor items, eat shards
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    for (const it of this.items.near(this.pos.x, 0, this.pos.z, this.r, 0.08)) {
      if (it.pos.y - it.hh > 0.06) continue;
      const dx = it.pos.x - this.pos.x, dz = it.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const pen = this.r + it.def.r - d;
      it.pos.x += (dx / d) * pen;
      it.pos.z += (dz / d) * pen;
      this.items.push(it, (dx / d) * 0.4 + f.x * 0.3, 0, (dz / d) * 0.4 + f.z * 0.3);
    }
    this.sucked += this.items.debris.suck(this.pos.x, this.pos.z, this.r * 0.9);
    // the cat
    if (!player.onRobot && player.pos.y < 0.06) {
      const dx = player.pos.x - this.pos.x, dz = player.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < this.r + 0.15) {
        const calm = ['sit', 'loaf', 'nap', 'groom'].includes(player.mode) || (player.mode === 'stand' && player.speed < 0.2);
        if (calm) player.startle(this.pos.x, this.pos.z);
        else {
          const pen = this.r + 0.15 - d;
          player.pos.x += (dx / (d || 1)) * pen;
          player.pos.z += (dz / (d || 1)) * pen;
        }
        if (this.state === 'drive') { this.state = 'turn'; this.turnTo = this.heading + Math.PI * rnd(0.6, 1.2); }
      }
    }
    this.delta.set(this.pos.x - ox, 0, this.pos.z - oz);
    this.deltaYaw = angDiff(oh, this.heading);
    this._sync();
  }

  _sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }
}

export class Bird {
  constructor(scene) {
    const g = (this.mesh = new THREE.Group());
    const blue = std('#4f7fc2', { roughness: 0.8 }), yellow = std('#f2cf4a', { roughness: 0.8 }), white = std('#f6f2ea', { roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), yellow);
    body.scale.set(0.85, 0.9, 1.25);
    body.position.y = 0.035;
    this.head = new THREE.Group();
    this.head.position.set(0, 0.07, 0.025);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 10), blue);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), white);
    cheek.position.set(0, -0.004, 0.006);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.016, 6), std('#3a3036'));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.002, 0.026);
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), std('#111', { roughness: 0.1 }));
      e.position.set(s * 0.013, 0.004, 0.017);
      this.head.add(e);
    }
    this.head.add(head, cheek, beak);
    this.wings = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.022, 0.05, 0.0);
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 6), blue);
      w.scale.set(0.25, 0.6, 1.1);
      w.position.set(s * 0.004, -0.01, -0.01);
      pivot.add(w);
      g.add(pivot);
      this.wings.push({ pivot, s });
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.04), blue);
    tail.position.set(0, 0.035, -0.045);
    tail.rotation.x = -0.4;
    for (const s of [1, -1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.02, 4), std('#6b5a4a'));
      leg.position.set(s * 0.01, 0.008, 0.005);
      g.add(leg);
    }
    g.add(body, this.head, tail);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(1.2);
    scene.add(g);
    this.reset();
  }

  reset() {
    this.state = 'away';
    this.timer = rnd(14, 22);
    this.mesh.visible = false;
    this.chirp = 0;
  }

  get present() { return this.state === 'perch'; }

  scare() {
    if (this.state !== 'perch') return false;
    this.state = 'out';
    this.t = 0;
    this.from = this.mesh.position.clone();
    this.to = new THREE.Vector3(this.from.x + rnd(-5, 5), 4.5, -14);
    return true;
  }

  update(dt, time, sound, camPos) {
    if (this.state === 'away') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'in';
        this.t = 0;
        this.win = WINDOWS[Math.random() < 0.5 ? 0 : 1];
        this.perchX = rnd(this.win.x0 + 0.25, this.win.x1 - 0.25);
        this.to = new THREE.Vector3(this.perchX, this.win.y0 - 0.01, -5.4);
        this.from = new THREE.Vector3(this.perchX + rnd(-6, 6), 4.5, -14);
        this.mesh.visible = true;
      }
      return;
    }
    const flap = (speed) => { for (const w of this.wings) w.pivot.rotation.z = w.s * (0.3 + Math.sin(time * speed) * 0.9); };
    if (this.state === 'in' || this.state === 'out') {
      this.t += dt / 2.2;
      const k = Math.min(1, this.t);
      const e = this.state === 'in' ? 1 - Math.pow(1 - k, 2.2) : k * k;
      const p = this.mesh.position.lerpVectors(this.from, this.to, e);
      p.y += Math.sin(k * Math.PI) * 0.6;
      this.mesh.lookAt(this.to.x, this.mesh.position.y, this.to.z);
      if (this.state === 'in') this.mesh.rotation.y = Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
      flap(40);
      if (k >= 1) {
        if (this.state === 'in') { this.state = 'perch'; this.stay = rnd(18, 28); this.hop = 1; this.mesh.rotation.set(0, rnd(-0.6, 0.6), 0); }
        else this.reset();
      }
      return;
    }
    // perched: hop, peck, look inside, chirp
    for (const w of this.wings) w.pivot.rotation.z = w.s * 0.15;
    this.stay -= dt;
    this.hop -= dt;
    this.chirp -= dt;
    if (this.chirp <= 0) {
      this.chirp = rnd(1.2, 3.5);
      const pan = Math.max(-1, Math.min(1, (this.mesh.position.x - camPos.x) * 0.3));
      const dist = this.mesh.position.distanceTo(camPos);
      sound.chirp(pan, Math.min(1, 2.5 / Math.max(1, dist)));
      this.chirpPulse = 0.3;
    }
    if (this.hop <= 0) {
      this.hop = rnd(0.8, 2.2);
      this.hopFrom = this.mesh.position.x;
      this.hopTo = Math.max(this.win.x0 + 0.15, Math.min(this.win.x1 - 0.15, this.hopFrom + rnd(-0.3, 0.3)));
      this.hopT = 0;
      this.mesh.rotation.y = rnd(-0.9, 0.9);
    }
    if (this.hopT !== undefined && this.hopT < 1) {
      this.hopT = Math.min(1, this.hopT + dt / 0.18);
      this.mesh.position.x = this.hopFrom + (this.hopTo - this.hopFrom) * this.hopT;
      this.mesh.position.y = this.win.y0 - 0.01 + Math.sin(this.hopT * Math.PI) * 0.04;
    }
    const peck = Math.max(0, Math.sin(time * 3.1)) > 0.92 ? 0.7 : 0;
    this.head.rotation.x = peck;
    this.head.rotation.y = Math.sin(time * 1.7) * 0.6;
    this.chirpPulse = Math.max(0, (this.chirpPulse || 0) - dt);
    this.head.position.y = 0.07 + this.chirpPulse * 0.02;
    if (this.stay <= 0) this.scare();
  }
}
