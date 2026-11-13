// The cat's body in the world: movement, jumping, pouncing, collisions,
// swatting, idle behaviour. CatModel only draws what this decides.
import * as THREE from 'three';
import { SKIP_STAND, SKIP_AIM, SKIP_CLEAR } from './world.js';

const G = 16;            // cats are a little floaty
const R = 0.15;          // body radius
const H = 0.3;           // body height
const STEP = 0.1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const rnd = (a, b) => a + Math.random() * (b - a);

export const SPEED = { sneak: 0.55, trot: 1.55, run: 4.1 };

export class Player {
  constructor(world, items) {
    this.world = world;
    this.items = items;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.reset(-1.0, 3.6, Math.PI);
    this.events = [];
  }

  reset(x, z, yaw) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.speed = 0;
    this.grounded = true;
    this.groundY = 0;
    this.groundTag = 'floor';
    this.coyote = 0;
    this.jumpBuf = 0;
    this.charging = false;
    this.charge = 0;
    this.idle = 0;
    this.mode = 'stand';
    this.swatT = -1;
    this.meowT = -1;
    this.scratchT = -1;
    this.startleT = -1;
    this.turn = 0;
    this.airTime = 0;
    this.landImpact = 0;
    this.onRobot = false;
    this.sprintTime = 0;
    this.groomT = -1;
    this.teleport = true;
    this.fallStart = 0;
    this.plan = null;
    this.events = [];
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }

  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /**
   * input: { x, z (camera-relative move vector, length <= 1), run, sneak, jumpDown, jumpHeld, swat, meow, any }
   * camYaw: horizontal angle of the camera's forward direction.
   */
  update(dt, input, camYaw, robot) {
    this.landImpact = 0;
    const fwdCam = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const rightCam = new THREE.Vector3(-fwdCam.z, 0, fwdCam.x);
    const want = new THREE.Vector3().addScaledVector(fwdCam, input.z).addScaledVector(rightCam, input.x);
    const mag = Math.min(1, want.length());
    if (mag > 0.01) want.divideScalar(want.length());

    // timers
    if (this.swatT >= 0) { this.swatT += dt; if (this.swatT > 0.4) this.swatT = -1; }
    if (this.meowT >= 0) { this.meowT += dt; if (this.meowT > 0.7) this.meowT = -1; }
    if (this.scratchT >= 0) { this.scratchT += dt; if (this.scratchT > 0.7) this.scratchT = -1; }
    if (this.startleT >= 0) { this.startleT += dt; if (this.startleT > 1.4) this.startleT = -1; }
    if (this.groomT >= 0) { this.groomT += dt; if (this.groomT > 2.6) this.groomT = -1; }
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    if (input.jumpDown) this.jumpBuf = 0.14;

    // ----- actions -----
    if (input.swat && this.swatT < 0) {
      this.swatT = 0;
      this._swatDone = false;
      this.emit('swat');
      this.idle = 0;
    }
    if (this.swatT >= 0.1 && !this._swatDone) { this._swatDone = true; this._doSwat(robot); }
    if (input.meow && this.meowT < 0) {
      this.meowT = 0;
      this.emit('meow');
      this.idle = Math.min(this.idle, 1);
    }

    // ----- jumping -----
    const canJump = (this.grounded || this.coyote > 0) && this.startleT < 0;
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / 0.75);
      if (mag > 0.01) this.yaw += clamp(angDiff(this.yaw, Math.atan2(want.x, want.z)), -6 * dt, 6 * dt);
      if (!input.jumpHeld || !this.grounded) this._launch(this.charge);
    } else if (this.jumpBuf > 0 && canJump) {
      this.jumpBuf = 0;
      if (this.speed > 0.7 || !this.grounded) this._launch(0.15, true);
      else { this.charging = true; this.charge = 0; this.emit('charge'); }
    }

    // ----- horizontal movement -----
    const moving = mag > 0.01;
    const target = this.charging ? 0 : (input.sneak ? SPEED.sneak : input.run ? SPEED.run : SPEED.trot) * mag;
    if (input.run && moving && this.grounded) this.sprintTime += dt; else this.sprintTime = 0;
    let yawRate = 0;
    if (this.grounded) {
      if (moving && !this.charging && this.startleT < 0) {
        const desired = Math.atan2(want.x, want.z);
        const diff = angDiff(this.yaw, desired);
        const maxTurn = (this.speed < 0.6 ? 11 : this.speed > 3 ? 6.5 : 9) * dt;
        const step = clamp(diff, -maxTurn, maxTurn);
        this.yaw += step;
        yawRate = step / dt;
        // slow down to turn around
        const align = Math.cos(Math.min(Math.abs(diff), Math.PI / 2));
        const tgt = target * (0.35 + 0.65 * align);
        const acc = tgt > this.speed ? (this.speed < 1.6 ? 9 : 5) : 12;
        this.speed += clamp(tgt - this.speed, -acc * dt, acc * dt);
      } else {
        this.speed += clamp(-this.speed, -10 * dt, 10 * dt);
      }
      const f = this.forward;
      this.vel.x = f.x * this.speed;
      this.vel.z = f.z * this.speed;
    } else {
      // gentle air steering
      if (moving) {
        const airAcc = 3.2 * dt;
        const hv = new THREE.Vector2(this.vel.x, this.vel.z);
        const len = hv.length();
        this.vel.x += want.x * airAcc;
        this.vel.z += want.z * airAcc;
        const nl = Math.hypot(this.vel.x, this.vel.z);
        const cap = Math.max(len, 1.6);
        if (nl > cap) { this.vel.x *= cap / nl; this.vel.z *= cap / nl; }
      }
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > 0.3) {
        const desired = Math.atan2(this.vel.x, this.vel.z);
        const step = clamp(angDiff(this.yaw, desired), -5 * dt, 5 * dt);
        this.yaw += step;
        yawRate = step / dt;
      }
      this.speed = hs;
    }
    this.turn += (yawRate - this.turn) * (1 - Math.exp(-10 * dt));

    // ----- integrate with collisions -----
    const prevY = this.pos.y;
    const p = this.pos;
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    const contacts = [];
    this.world.collideCircle(p, R, H, this.grounded ? STEP : 0.02, contacts);
    if (contacts.length) {
      for (const c of contacts) {
        const vn = this.vel.x * c.nx + this.vel.z * c.nz;
        if (vn < 0) { this.vel.x -= vn * c.nx; this.vel.z -= vn * c.nz; }
      }
      if (this.grounded) this.speed = Math.min(this.speed, Math.hypot(this.vel.x, this.vel.z) + 0.3);
    }
    p.x = clamp(p.x, -6.98 + R, 6.98 - R);
    p.z = clamp(p.z, -4.98 + R, 4.98 - R);

    // vertical
    if (!this.grounded) {
      this.vel.y -= G * dt;
      p.y += this.vel.y * dt;
      this.airTime += dt;
      if (this.vel.y > 0) {
        const ceil = this.world.ceilingAt(p.x, p.z, prevY + H, R);
        if (p.y + H > ceil) { p.y = ceil - H; this.vel.y = 0; this.emit('bonk'); }
      }
    }
    if (!this.grounded && this.airTime > 0.05) this._tryMantle(want, moving);
    // robot as a moving platform
    let ground = this.world.groundAt(p.x, p.z, this.grounded ? p.y + STEP : Math.max(p.y, prevY) + 0.02, 0.03, SKIP_STAND);
    let tag = this.world.lastTag;
    let onRobot = false;
    if (robot && robot.active) {
      const dx = p.x - robot.pos.x, dz = p.z - robot.pos.z;
      if (dx * dx + dz * dz < 0.2 * 0.2 && robot.top <= (this.grounded ? p.y + STEP : Math.max(p.y, prevY) + 0.03) && robot.top > ground) {
        ground = robot.top; tag = 'robot'; onRobot = true;
      }
    }
    if (this.grounded) {
      if (p.y - ground > STEP + 0.001 || ground - p.y > STEP) {
        this.grounded = false;
        this.coyote = 0.1;
        this.vel.y = 0;
        this.airTime = 0;
        this.fallStart = p.y;
      } else {
        p.y = ground;
      }
    } else if (p.y <= ground && this.vel.y <= 0) {
      const impact = -this.vel.y;
      p.y = ground;
      this.vel.y = 0;
      this.grounded = true;
      this.landImpact = impact;
      this.speed = Math.hypot(this.vel.x, this.vel.z) * 0.6;
      if (impact > 2) this.emit('land', { impact, fall: this.fallStart - p.y });
    }
    if (!this.grounded) this.fallStart = Math.max(this.fallStart, p.y);
    this.groundY = ground;
    this.groundTag = tag;
    this.onRobot = onRobot && this.grounded;
    if (this.onRobot) { p.x += robot.delta.x; p.z += robot.delta.z; this.yaw += robot.deltaYaw * 0.5; }

    // ----- shove things the cat walks into -----
    this._shove(dt);

    // ----- mood / idle -----
    const busy = moving || this.charging || !this.grounded || this.swatT >= 0 || input.any;
    if (busy) this.idle = 0; else this.idle += dt;
    let mode = 'stand';
    if (this.startleT >= 0) mode = 'startle';
    else if (this.charging) mode = 'charge';
    else if (this.scratchT >= 0) mode = 'scratch';
    else if (this.grounded && this.idle > 0) {
      const inBox = this.inBox();
      if (inBox && this.idle > 0.4) mode = 'sit';
      else if (this.idle > 9) mode = this.sunny ? 'nap' : 'loaf';
      else if (this.idle > 2.2) {
        mode = 'sit';
        if (this.idle > 4.5 && this.groomT < 0 && Math.random() < dt * 0.25) this.groomT = 0;
        if (this.groomT >= 0) mode = 'groom';
      }
    }
    if (mode !== 'groom' && this.groomT >= 0 && busy) this.groomT = -1;
    if (this.sunny && this.idle > 6 && !this.onRobot) mode = 'nap';
    if (mode !== this.mode) {
      if (mode === 'nap') this.emit('nap');
      if (this.mode === 'nap') this.emit('wake');
      this.mode = mode;
    }
  }

  inBox() {
    const b = this.world.boxInterior;
    return this.pos.y < 0.05 && this.pos.x > b.x0 && this.pos.x < b.x1 && this.pos.z > b.z0 && this.pos.z < b.z1;
  }

  _launch(charge, running = false) {
    const c = clamp(charge, 0, 1);
    if (running) {
      const f = this.forward;
      this.vel.y = Math.sqrt(2 * G * 0.95);
      this.vel.x += f.x * 0.4;
      this.vel.z += f.z * 0.4;
    } else {
      // a standing pounce is measured: the cat picks a spot and jumps exactly there
      const plan = this.plan || this.planPounce();
      const v = this._solve(plan);
      this.yaw = plan.yaw;
      this.vel.set(v.x, v.y, v.z);
    }
    this.plan = null;
    this.grounded = false;
    this.coyote = 0;
    this.charging = false;
    this.airTime = 0;
    this.fallStart = this.pos.y;
    this.emit('jump', { power: running ? 0.4 : c });
    this.charge = 0;
  }

  /**
   * Choose where a standing pounce will land. The charge sets the preferred
   * distance; ledges above the cat inside a small cone are preferred, which is
   * what makes "tap Space facing the table" land on the table.
   */
  planPounce() {
    const p = this.pos;
    const want = 0.3 + 2.3 * clamp(this.charge, 0, 1);
    let best = null;
    for (const da of [0, -0.14, 0.14, -0.28, 0.28]) {
      const yaw = this.yaw + da;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (let d = 0.22; d <= 2.9; d += 0.06) {
        const x = p.x + fx * d, z = p.z + fz * d;
        if (x < -6.84 || x > 6.84 || z < -4.84 || z > 4.84) break;
        const top = this.world.groundAt(x, z, p.y + 1.5, -0.05, SKIP_AIM);
        const dh = top - p.y;
        if (dh < -2.6) continue;
        if (this.world.ceilingAt(x, z, top + 0.01, R * 0.5) - top < H - 0.02) continue;
        if (2.78 - H - p.y < dh + 0.06) continue;
        const raised = dh > 0.12;
        const score = Math.abs(d - want) + Math.abs(da) * 0.9 - (raised ? 0.6 : 0) + (dh < -0.1 ? 0.15 : 0);
        if (!best || score < best.score) best = { x, z, top, d, yaw, score };
      }
    }
    if (!best) best = { x: p.x, z: p.z, top: p.y, d: 0, yaw: this.yaw, score: 0 };
    // clear anything in the way (box walls, chair seats, the edge of the target)
    best.clear = 0;
    const fx = Math.sin(best.yaw), fz = Math.cos(best.yaw);
    for (let s = 0.08; s < best.d - 0.05; s += 0.07) {
      const t = this.world.groundAt(p.x + fx * s, p.z + fz * s, p.y + 1.6, R * 0.9, SKIP_CLEAR) - p.y;
      if (t > best.clear) best.clear = t;
    }
    return best;
  }

  _solve(plan) {
    const dh = plan.top - this.pos.y;
    let apex = Math.max(dh + 0.2 + 0.05 * plan.d, 0.28 + 0.2 * plan.d);
    apex = Math.max(apex, (plan.clear || 0) + 0.14);
    apex = Math.min(apex, 2.78 - H - this.pos.y);
    apex = Math.max(apex, dh + 0.06, 0.1);
    const vy = Math.sqrt(2 * G * apex);
    const t = vy / G + Math.sqrt((2 * Math.max(0.005, apex - dh)) / G);
    const hs = plan.d / t;
    return { x: Math.sin(plan.yaw) * hs, y: vy, z: Math.cos(plan.yaw) * hs, t };
  }

  /** Predicted landing arc for the pounce preview. */
  predictArc(out) {
    this.plan = this.planPounce();
    const v = this._solve(this.plan);
    let x = this.pos.x, y = this.pos.y, z = this.pos.z, vy = v.y;
    out.length = 0;
    const n = 26;
    for (let i = 1; i <= n; i++) {
      const t = (i / n) * v.t;
      out.push(this.pos.x + v.x * t, this.pos.y + v.y * t - 0.5 * G * t * t + 0.05, this.pos.z + v.z * t);
    }
    return { x: this.plan.x, y: this.plan.top, z: this.plan.z };
  }

  _tryMantle(want, moving) {
    // A cat that jumps a little short scrambles up the last bit. Probe just ahead
    // of the body for a ledge whose top is slightly above the feet.
    const p = this.pos;
    if (this.vel.y > 6.5) return;
    const apex = p.y + Math.max(0, this.vel.y) ** 2 / (2 * G);
    let dx, dz;
    if (moving) { dx = want.x; dz = want.z; } else { dx = Math.sin(this.yaw); dz = Math.cos(this.yaw); }
    const px = p.x + dx * (R + 0.08), pz = p.z + dz * (R + 0.08);
    for (const c of this.world.colliders) {
      if (SKIP_STAND.has(c.tag) || c.tag === 'leg') continue;
      const rise = c.y1 - p.y;
      if (rise <= 0.02 || rise > 0.32 || apex < c.y1 - 0.32) continue;
      if (px < c.x0 || px > c.x1 || pz < c.z0 || pz > c.z1) continue;
      const nxp = clamp(p.x + dx * (R * 0.6), c.x0 + 0.03, c.x1 - 0.03);
      const nzp = clamp(p.z + dz * (R * 0.6), c.z0 + 0.03, c.z1 - 0.03);
      const ceil = this.world.ceilingAt(nxp, nzp, c.y1 + 0.01, R);
      if (ceil - c.y1 < H - 0.05) continue;
      // nothing solid in the way at the new spot
      const test = new THREE.Vector3(nxp, c.y1, nzp);
      const before = test.clone();
      this.world.collideCircle(test, R * 0.7, H, STEP);
      if (test.distanceToSquared(before) > 0.0025) continue;
      p.x = nxp; p.z = nzp; p.y = c.y1;
      this.vel.y = 0;
      this.vel.x *= 0.3; this.vel.z *= 0.3;
      this.grounded = true;
      this.landImpact = 2.5;
      this.emit('mantle');
      return;
    }
  }


  _shove(dt) {
    const f = this.forward;
    const pts = [[this.pos.x + f.x * 0.13, this.pos.z + f.z * 0.13], [this.pos.x - f.x * 0.1, this.pos.z - f.z * 0.1]];
    const hs = Math.hypot(this.vel.x, this.vel.z);
    for (const [x, z] of pts) {
      for (const it of this.items.near(x, this.pos.y + 0.03, z, 0.1, H - 0.05)) {
        const dx = it.pos.x - x, dz = it.pos.z - z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const nx = dx / d, nz = dz / d;
        const pen = 0.1 + it.def.r - d;
        it.pos.x += nx * pen * 0.8;
        it.pos.z += nz * pen * 0.8;
        const along = this.vel.x * nx + this.vel.z * nz;
        const k = 0.35 + Math.max(0, along) * 0.75;
        this.items.push(it, nx * k * dt * 8, 0, nz * k * dt * 8, hs > 2 ? 4 : 0);
        if (it.def.toy && hs > 1) this.items.push(it, nx * hs * 0.4, 0.4, nz * hs * 0.4);
      }
    }
  }

  _doSwat(robot) {
    const f = this.forward;
    const px = this.pos.x + f.x * 0.25, pz = this.pos.z + f.z * 0.25;
    const hits = this.items.near(px, this.pos.y - 0.12, pz, 0.17, 0.6);
    for (const it of hits) {
      const side = rnd(-0.6, 0.6);
      const power = 2.6 + (this.grounded ? 0 : 0.8);
      this.items.push(it, (f.x + -f.z * side * 0.4) * power * it.mass, 0.9 * it.mass, (f.z + f.x * side * 0.4) * power * it.mass, 9);
    }
    if (hits.length) { this.emit('swatHit', { n: hits.length }); return; }
    if (robot && robot.active) {
      const dx = robot.pos.x - px, dz = robot.pos.z - pz;
      if (dx * dx + dz * dz < 0.3 * 0.3 && Math.abs(robot.top - this.pos.y) < 0.25) { robot.bonk(f); this.emit('swatRobot'); return; }
    }
    // scratching the sofa (or the armchair) counts as maintenance
    const sx = this.pos.x + f.x * 0.3, sz = this.pos.z + f.z * 0.3;
    for (const c of this.world.colliders) {
      if (c.tag !== 'sofa' && c.tag !== 'armchair' && c.tag !== 'post') continue;
      if (c.y1 < this.pos.y + 0.12 || c.y0 > this.pos.y + 0.2) continue;
      if (sx > c.x0 - 0.05 && sx < c.x1 + 0.05 && sz > c.z0 - 0.05 && sz < c.z1 + 0.05) {
        this.scratchT = 0;
        this.emit('scratch', { tag: c.tag, x: sx, y: this.pos.y + 0.2, z: sz });
        return;
      }
    }
  }

  startle(fromX, fromZ) {
    if (this.startleT >= 0) return;
    this.startleT = 0;
    this.charging = false;
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 1.6, 5.2, (dz / d) * 1.6);
    this.grounded = false;
    this.fallStart = this.pos.y;
    this.idle = 0;
    this.emit('startle');
  }
}
