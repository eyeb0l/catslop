// Third-person orbit camera. Mouse (or stick, or arrow keys) steers it; left
// alone, it drifts back behind the cat so keyboard-only play still works.
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, angleDelta } from './util.js';
import { heightAt, waterLevelAt } from './terrain.js';
import { pointBlocked } from './physics.js';

export class FollowCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.08, 1400);
    this.yaw = Math.PI; // camera sits at +yaw direction from target
    this.pitch = 0.32;
    this.dist = 3.4; this.wantDist = 3.4;
    this.target = new THREE.Vector3();
    this.fov = 55;
    this.sensitivity = 1;
    this.invertY = false;
    this.shake = 0;
    this.initialised = false;
  }

  /** Direction the camera is looking along the ground, as a yaw for the player. */
  get forwardYaw() { return this.yaw + Math.PI; }

  snap(pos, yawBehind) {
    this.yaw = yawBehind + Math.PI;
    this.target.set(pos.x, pos.y + 0.55, pos.z);
    this.initialised = false;
  }

  update(dt, input, player, opts = {}) {
    const now = performance.now();
    const k = 0.0026 * this.sensitivity;
    this.yaw -= input.lookX * k;
    this.pitch = clamp(this.pitch + input.lookY * k * (this.invertY ? -1 : 1), -0.18, 1.25);
    this.yaw -= input.turn() * 2.2 * dt;
    this.wantDist = clamp(this.wantDist + input.zoom * 0.45, 2.0, 7.5);

    // Drift behind the cat when the player is not steering the camera.
    const idleLook = now - (input.lastLookAt || -1e9) > 1400 && !input.turn();
    if (idleLook && player.speed > 0.8 && !player.charging) {
      const behind = player.yaw + Math.PI;
      const d = angleDelta(this.yaw, behind);
      // Running toward the camera should not whip it around.
      if (Math.abs(d) < 2.5) this.yaw = dampAngle(this.yaw, behind, 0.9 + Math.min(player.speed, 6) * 0.14, dt);
      this.pitch = damp(this.pitch, 0.3, 0.6, dt);
    }

    const focusY = player.pos.y + 0.6 + (player.swimming ? 0.25 : 0);
    if (!this.initialised) { this.target.set(player.pos.x, focusY, player.pos.z); this.initialised = true; }
    this.target.x = damp(this.target.x, player.pos.x, 14, dt);
    this.target.z = damp(this.target.z, player.pos.z, 14, dt);
    this.target.y = damp(this.target.y, focusY, player.grounded ? 9 : 5, dt);

    const charge = player.chargePower || 0;
    const wantFov = 55 + clamp((player.speed - 5) * 2.2, 0, 11) - charge * 5 + (opts.fovKick || 0);
    this.fov = damp(this.fov, wantFov, 5, dt);
    const dist = this.wantDist * (1 - charge * 0.14) * (opts.distScale || 1);
    this.dist = damp(this.dist, dist, 6, dt);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
    // Pull in if the line of sight goes through a building or under the ground.
    let reach = this.dist;
    for (let i = 1; i <= 10; i++) {
      const t = (i / 10) * this.dist;
      const x = this.target.x + dx * t, y = this.target.y + dy * t, z = this.target.z + dz * t;
      if (pointBlocked(x, y, z, 0.3) || y < heightAt(x, z) + 0.12) { reach = Math.max(0.9, t - this.dist / 10); break; }
    }
    this.reach = this.reach === undefined ? reach : (reach < this.reach ? reach : damp(this.reach, reach, 4, dt));
    const cam = this.camera;
    cam.position.set(this.target.x + dx * this.reach, this.target.y + dy * this.reach, this.target.z + dz * this.reach);
    const floor = Math.max(heightAt(cam.position.x, cam.position.z), waterLevelAt(cam.position.x, cam.position.z)) + 0.22;
    if (cam.position.y < floor) cam.position.y = floor;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.12;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.target.x, this.target.y + lerp(0.1, 0.35, charge), this.target.z);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
