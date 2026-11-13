// Collision world: the terrain plus a list of simple solids (boxes and
// cylinders with a top). A solid whose top is within a step of your feet is
// ground; anything taller is a wall. That one rule gives the cat a porch, a
// dock, crates, fences and rocks to hop onto.
import { heightAt } from './terrain.js';

export const STEP = 0.32;
const solids = [];

/** box: { kind:'box', x, z, hw, hd, rot?, top, bottom } / circle: { kind:'circle', x, z, r, top, bottom } */
export function addSolid(s) {
  if (s.kind === 'box') { s.cos = Math.cos(s.rot || 0); s.sin = Math.sin(s.rot || 0); }
  solids.push(s);
  return s;
}
export const addSolids = (list) => list.forEach(addSolid);

function inside(s, x, z, pad) {
  if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) < s.r + pad;
  const dx = x - s.x, dz = z - s.z;
  const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
  return Math.abs(lx) < s.hw + pad && Math.abs(lz) < s.hd + pad;
}

/** Highest walkable surface under (x,z) for something whose feet are at yFeet. */
export function groundAt(x, z, yFeet = 1e9) {
  let g = heightAt(x, z);
  for (const s of solids) {
    if (s.top > g && s.top <= yFeet + STEP && inside(s, x, z, 0)) g = s.top;
  }
  return g;
}

/** Push a vertical capsule (radius, feet..feet+height) out of every solid it cannot step onto. */
export function collide(pos, radius, height) {
  let hit = false;
  for (const s of solids) {
    if (s.top <= pos.y + STEP || s.bottom >= pos.y + height) continue;
    if (s.kind === 'circle') {
      const dx = pos.x - s.x, dz = pos.z - s.z;
      const d = Math.hypot(dx, dz), min = s.r + radius;
      if (d < min) {
        const k = d > 1e-4 ? (min - d) / d : 0;
        if (k === 0) pos.x += min; else { pos.x += dx * k; pos.z += dz * k; }
        hit = true;
      }
    } else {
      const dx = pos.x - s.x, dz = pos.z - s.z;
      let lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
      const ox = s.hw + radius - Math.abs(lx), oz = s.hd + radius - Math.abs(lz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) lx += Math.sign(lx || 1) * ox; else lz += Math.sign(lz || 1) * oz;
        pos.x = s.x + lx * s.cos + lz * s.sin;
        pos.z = s.z - lx * s.sin + lz * s.cos;
        hit = true;
      }
    }
  }
  return hit;
}

/** True if the point is inside something solid (used to keep the camera out of walls). */
export function pointBlocked(x, y, z, pad = 0.25) {
  for (const s of solids) {
    if (y < s.top + pad && y > s.bottom && s.top - s.bottom > 1.2 && inside(s, x, z, pad)) return true;
  }
  return false;
}
