// The cat as a physical thing: running, sneaking, hopping, charged pounces
// with aim assist, wading, swimming and shaking dry.
import * as THREE from 'three';
import { Cat, CAT_SCALE } from './cat.js';
import { clamp, lerp, damp, dampAngle, angleDelta, smoothstep } from './util.js';
import { heightAt, waterLevelAt, tallGrassAt } from './terrain.js';
import { groundAt, collide, STEP } from './physics.js';

const GRAVITY = 24;
const SPEED = { sneak: 1.2, run: 4.7, sprint: 7.0, zoomies: 9.8, swim: 1.7, swimWings: 3.3, charge: 0.9 };
const SWIM_DEPTH = 0.42;
const SWIM_SINK = 0.36;
const WORLD_RADIUS = 121;

export class Player {
  constructor() {
    this.cat = new Cat();
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.yawRate = 0;
    this.speed = 0;
    this.grounded = true; this.swimming = false; this.wading = 0;
    this.sneaking = false;
    this.charging = false; this.chargeTime = 0; this.chargePower = 0;
    this.pouncing = false; this.pounceGrace = 0; this.airTime = 0; this.coyote = 0;
    this.idleTime = 0; this.sitting = false;
    this.wet = 0; this.shakeLock = 0; this.stun = 0;
    this.upgrades = { springy: false, softPaws: false, zoomies: false, wings: false, bell: false };
    this.aim = { active: false, point: new THREE.Vector3(), target: null, power: 0 };
    this.look = null; this.alert = 0; this.happy = 0;
    this.frozen = false;
    this.hidden = false;
    this.events = { jump: null, land: null, splash: null, shake: null, step: null, pounce: null };
    this.findTarget = null;
    this.cat.onStep = (i, sp) => { if (this.events.step) this.events.step(i, sp, this); };
    this._ground = (x, z) => groundAt(x, z, this.pos.y);
    this._fallPeak = 0;
    this.animState = { pos: this.pos, yaw: 0, speed: 0, yawRate: 0, vy: 0, grounded: true, swim: false, crouch: 0, charge: 0, sit: false, look: null, alert: 0, night: 0, happy: 0, rim: null, groundAt: this._ground };
  }

  teleport(x, z, yaw = this.yaw) {
    this.pos.set(x, groundAt(x, z, 1e9), z);
    if (waterLevelAt(x, z) - this.pos.y > SWIM_DEPTH) this.pos.y = waterLevelAt(x, z) - SWIM_SINK;
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.grounded = true; this.pouncing = false; this.charging = false; this.chargePower = 0;
  }

  /** 0..1 how loud the cat is right now; prey multiplies its hearing range by this. */
  get noise() {
    let n;
    if (this.swimming) n = 1.3;
    else if (this.pouncing || this.pounceGrace > 0) return 0; // once the cat is in the air it is too late to hear it
    else if (this.sneaking || this.charging) n = this.inTallGrass ? 0.16 : 0.34;
    else if (this.speed < 0.3) n = 0.45;
    else n = lerp(0.8, 1.55, smoothstep(4, 9, this.speed));
    if (this.upgrades.softPaws) n *= 0.68;
    if (this.upgrades.bell) n = Math.max(n * 1.5, 0.9);
    return n;
  }

  get facing() { return tmpF.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /** Where the mouth is, roughly: what has to touch prey to catch it. */
  catchPoint(out) {
    return out.set(this.pos.x + Math.sin(this.yaw) * 0.42 * CAT_SCALE, this.pos.y + 0.36 * CAT_SCALE, this.pos.z + Math.cos(this.yaw) * 0.42 * CAT_SCALE);
  }

  /** Launch velocity for a pounce of the given power, optionally homing on a target point. */
  computeLaunch(power, target, out) {
    const boost = this.upgrades.springy ? 1.35 : 1;
    const range = pounceRange(power, this.upgrades.springy);
    const T = pounceTime(power, this.upgrades.springy);
    let dx = Math.sin(this.yaw), dz = Math.cos(this.yaw), dist = range, dy;
    if (target) {
      dx = target.x - this.pos.x; dz = target.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d; dz /= d;
      dist = clamp(d - 0.3, 0.3, range * 1.15);
      dy = target.y - this.pos.y;
    } else {
      const lx = this.pos.x + dx * dist, lz = this.pos.z + dz * dist;
      dy = clamp(Math.max(heightAt(lx, lz), waterLevelAt(lx, lz) - 0.3) - this.pos.y, -2, 1.5);
    }
    const vy = clamp((dy + 0.5 * GRAVITY * T * T) / T, 3.6, 13);
    return out.set(dx * (dist / T), vy, dz * (dist / T));
  }

  update(dt, input, cam, env) {
    const up = this.upgrades;
    const depth = waterLevelAt(this.pos.x, this.pos.z) - heightAt(this.pos.x, this.pos.z);
    const waterY = waterLevelAt(this.pos.x, this.pos.z);
    this.inTallGrass = tallGrassAt(this.pos.x, this.pos.z) > 0.5 && this.grounded;
    this.stun = Math.max(0, this.stun - dt);
    this.shakeLock = Math.max(0, this.shakeLock - dt);
    this.pounceGrace = Math.max(0, this.pounceGrace - dt);

    // ---- Intent -------------------------------------------------------------------
    let mx = 0, my = 0, wantJump = false, jumpHeld = false, sprint = false;
    if (!this.frozen && this.stun <= 0) {
      const m = input.move();
      mx = m.x; my = m.y;
      jumpHeld = input.held('jump');
      wantJump = input.pressed('jump');
      sprint = input.held('sprint');
      if (input.pressed('sneak')) this.sneaking = !this.sneaking;
    }
    const sneakHeld = !this.frozen && input.held('sneakHold');
    const mag = Math.min(1, Math.hypot(mx, my));
    const fy = cam.forwardYaw;
    const wx = Math.sin(fy) * my - Math.cos(fy) * mx, wz = Math.cos(fy) * my + Math.sin(fy) * mx;
    const moving = mag > 0.05;
    if (sprint && moving) this.sneaking = false;
    const sneak = (this.sneaking || sneakHeld) && !this.swimming;

    // ---- Charging a pounce -------------------------------------------------------------
    const canJump = (this.grounded || this.coyote > 0) && !this.swimming && this.shakeLock <= 0;
    if (wantJump && canJump && !this.charging) { this.charging = true; this.chargeTime = 0; }
    if (this.charging) {
      this.chargeTime += dt;
      this.chargePower = smoothstep(0.16, 0.72, this.chargeTime);
      if (!jumpHeld || !canJump) {
        if (canJump) this.launch();
        this.charging = false; this.chargePower = 0;
      }
    }
    const aiming = this.charging && this.chargeTime > 0.16;

    // ---- Horizontal movement ---------------------------------------------------------------
    let top = sneak ? SPEED.sneak : sprint ? (up.zoomies ? SPEED.zoomies : SPEED.sprint) : SPEED.run;
    if (aiming) top = SPEED.charge;
    if (this.swimming) top = up.wings ? SPEED.swimWings : SPEED.swim;
    else if (this.wading > 0.2) top *= lerp(1, 0.68, this.wading);
    if (this.shakeLock > 0) top *= 0.2;
    const tvx = wx * top * (moving ? 1 : 0), tvz = wz * top * (moving ? 1 : 0);
    const accel = this.swimming ? 5 : this.grounded ? (moving ? 30 : 38) : (this.pouncing ? 1.5 : 9);
    const ax = tvx - this.vel.x, az = tvz - this.vel.z;
    const al = Math.hypot(ax, az);
    if (al > 1e-5) {
      const stepv = Math.min(al, accel * dt);
      this.vel.x += (ax / al) * stepv; this.vel.z += (az / al) * stepv;
    }

    // Facing: toward travel, or along the camera while aiming.
    const prevYaw = this.yaw;
    if (aiming) this.yaw = dampAngle(this.yaw, fy, 14, dt);
    else if (moving && !this.pouncing) this.yaw = dampAngle(this.yaw, Math.atan2(wx, wz), this.grounded ? 12 : 5, dt);
    else if (this.pouncing && Math.hypot(this.vel.x, this.vel.z) > 1) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
    this.yawRate = damp(this.yawRate, angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-4), 12, dt);

    // ---- Vertical ------------------------------------------------------------------------------
    if (!this.grounded && !this.swimming) this.vel.y -= GRAVITY * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt; this.pos.y += this.vel.y * dt;

    // Keep the cat on the map: the sea pushes back.
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > WORLD_RADIUS) { const k = WORLD_RADIUS / r; this.pos.x *= k; this.pos.z *= k; }

    if (collide(this.pos, 0.3, 0.6)) { /* slid along something */ }
    const g = groundAt(this.pos.x, this.pos.z, this.pos.y);
    const deep = depth > SWIM_DEPTH && g < waterY - SWIM_DEPTH + 0.05;

    if (deep && this.pos.y <= waterY - SWIM_SINK + 0.06) {
      if (!this.swimming) {
        const hard = this.vel.y < -3;
        if (this.pouncing) this.pounceGrace = 0.3; // a pounce into water can still catch a fish
        this.swimming = true; this.grounded = false; this.pouncing = false; this.charging = false; this.chargePower = 0;
        this.vel.x *= 0.45; this.vel.z *= 0.45;
        if (this.events.splash) this.events.splash(hard ? 1 : 0.4, this);
      }
      this.vel.y = 0;
      this.pos.y = damp(this.pos.y, waterY - SWIM_SINK + Math.sin(performance.now() * 0.004) * 0.02, 10, dt);
      this.wet = 1;
    } else {
      if (this.swimming) { this.swimming = false; this.grounded = true; }
      if (this.grounded) {
        if (g < this.pos.y - STEP - 0.05) { this.grounded = false; this.coyote = 0.1; this._fallPeak = this.pos.y; } else this.pos.y = damp(this.pos.y, g, 30, dt), this.vel.y = 0;
        if (Math.abs(this.pos.y - g) < 0.02) this.pos.y = g;
      } else if (this.pos.y <= g && this.vel.y <= 0) {
        const impact = clamp(-this.vel.y / 11, 0.15, 1);
        this.pos.y = g; this.vel.y = 0; this.grounded = true;
        if (this.pouncing) { this.pounceGrace = 0.14; this.vel.x *= 0.5; this.vel.z *= 0.5; }
        this.pouncing = false;
        this.cat.land(impact);
        if (this.events.land) this.events.land(impact, this);
      }
    }
    this.coyote = Math.max(0, this.coyote - dt);
    this.airTime = this.grounded || this.swimming ? 0 : this.airTime + dt;

    // Wading: shallow water slows and splashes.
    const wantWade = !this.swimming && this.grounded && depth > 0.06 && this.pos.y < waterY ? clamp(depth / SWIM_DEPTH) : 0;
    this.wading = damp(this.wading, wantWade, 8, dt);

    // Back on dry land after a swim: shake it off.
    if (this.wet > 0 && !this.swimming && this.grounded && depth < 0.02) {
      this.wet -= dt * 2.5;
      if (this.wet <= 0) {
        this.wet = 0; this.shakeLock = 0.85; this.cat.startShake();
        if (this.events.shake) this.events.shake(this);
      }
    }

    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // Idle long enough and the cat sits down.
    if (this.speed < 0.15 && this.grounded && !this.charging && !moving && this.shakeLock <= 0) this.idleTime += dt; else this.idleTime = 0;
    this.sitting = this.idleTime > 4.5 || this.forceSit === true;

    // ---- Aim preview ------------------------------------------------------------------------------
    this.aim.active = aiming;
    if (aiming) {
      this.aim.power = this.chargePower;
      this.aim.target = this.findTarget ? this.findTarget(this, this.chargePower) : null;
      const v = this.computeLaunch(this.chargePower, this.aim.target ? this.aim.target.aimPoint : null, tmpV);
      // Walk the arc forward to find where it comes down.
      let x = this.pos.x, y = this.pos.y, z = this.pos.z, vy = v.y;
      for (let i = 0; i < 60; i++) {
        x += v.x * 0.03; z += v.z * 0.03; vy -= GRAVITY * 0.03; y += vy * 0.03;
        const gy = Math.max(groundAt(x, z, y + 0.2), waterLevelAt(x, z));
        if (y <= gy && vy < 0) { y = gy; break; }
      }
      this.aim.point.set(x, y, z);
    } else this.aim.target = null;

    // ---- Animation ----------------------------------------------------------------------------------
    const a = this.animState;
    a.yaw = this.yaw; a.speed = this.speed; a.yawRate = this.yawRate; a.vy = this.vel.y;
    a.grounded = this.grounded; a.swim = this.swimming;
    a.crouch = sneak && !this.swimming ? 1 : 0;
    a.charge = aiming ? 0.35 + this.chargePower * 0.65 : 0;
    a.sit = this.sitting;
    a.look = this.look; a.alert = this.alert; a.happy = this.happy;
    a.night = env ? env.night : 0;
    a.rim = env ? tmpRim.copy(env.lightColor).multiplyScalar(0.1 + env.sun.intensity * 0.07) : null;
    this.cat.root.visible = !this.hidden;
    this.cat.update(dt, a);
  }

  launch() {
    const tap = this.chargeTime < 0.16;
    if (tap) {
      this.vel.y = 6.4;
      // A hop keeps your momentum, with a little forward push if you are moving.
      if (this.speed > 0.5) { this.vel.x *= 1.08; this.vel.z *= 1.08; }
    } else {
      const target = this.aim.target;
      const v = this.computeLaunch(this.chargePower, target ? target.aimPoint : null, tmpV);
      this.vel.copy(v);
      this.yaw = Math.atan2(v.x, v.z);
    }
    this.grounded = false; this.pouncing = true; this.coyote = 0; this.sneaking = false;
    this.pos.y += 0.02;
    if (this.events.jump) this.events.jump(tap ? 0 : this.chargePower, this);
  }
}

const tmpF = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpRim = new THREE.Color();

/** How far a pounce of this power carries on flat ground, and how long it is in the air. */
export const pounceRange = (power, springy) => lerp(2.0, 4.3, power) * (springy ? 1.35 : 1);
export const pounceTime = (power, springy) => lerp(0.44, 0.68, power) * (springy ? 1.08 : 1);
