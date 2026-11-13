// The island: one analytic height function that everything else samples.
// Mesh, grass placement, water depth, physics and spawning all read from here,
// so nothing can disagree about where the ground is.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, noise2, fbm, distToSegment } from './util.js';

export const SEA_LEVEL = 0;
export const POND = { x: -36, z: 16, r: 11, level: 2.25 };
export const COTTAGE = { x: 4, z: -6, ground: 3.0 };
export const DOCK = { x: 14, z0: 66, z1: 86, top: 0.95, halfW: 1.15 };
export const WORLD_SIZE = 260;

// Dirt paths: porch -> dock, and a branch to the pond.
export const PATHS = [
  [[4, 2], [5, 14], [9, 30], [10, 46], [14, 58], [14, 68]],
  [[5, 14], [-8, 17], [-20, 14], [-25.5, 15]],
  [[4.5, 1.6], [11, 2.2], [15.8, 0.4], [15.8, -2.6]],
];

function rawHeight(x, z) {
  // Wobbly coastline.
  const edge = 76 + (fbm(x * 0.018 + 5.2, z * 0.018 - 1.7, 3) - 0.5) * 34;
  const r = Math.hypot(x, z * 1.04);
  const d = edge - r; // metres inland of the nominal shoreline
  let h;
  if (d < 12) h = d * 0.085 + 0.02; // long gentle beach, continuing underwater
  else h = 1.04 + smoothstep(12, 36, d) * 1.75;
  h = Math.max(h, -5.5 + (noise2(x * 0.05, z * 0.05) - 0.5));
  const inland = smoothstep(14, 44, d);
  h += (fbm(x * 0.035, z * 0.035, 4) - 0.5) * 3.2 * inland;
  // The wooded hill to the north.
  const hx = x + 14, hz = z + 46;
  h += 6.5 * Math.exp(-(hx * hx + hz * hz) / (2 * 21 * 21)) * smoothstep(4, 30, d);
  // A low rise in the south-east meadow so the horizon is not flat.
  const mx = x - 34, mz = z - 30;
  h += 1.6 * Math.exp(-(mx * mx + mz * mz) / (2 * 14 * 14)) * inland;
  return h;
}

/** Exact analytic ground height. Used once, to fill the grid below. */
function analyticHeight(x, z) {
  let h = rawHeight(x, z);
  // Flatten the cottage yard.
  const dc = Math.hypot(x - COTTAGE.x, z - COTTAGE.z - 2);
  h = lerp(COTTAGE.ground, h, smoothstep(13, 26, dc));
  // Carve the pond.
  const dp = Math.hypot(x - POND.x, z - POND.z);
  if (dp < 22) {
    h = lerp(POND.level + 0.38, h, smoothstep(13, 22, dp));
    if (dp < POND.r) {
      const q = dp / POND.r;
      h -= 2.25 * (1 - q * q);
    }
  }
  return h;
}

// The rendered mesh is a 1 m grid of the analytic function. Physics samples the
// same grid with the same triangle split, so paws land on the visible surface.
const SEG = 260;
const N1 = SEG + 1;
const CELL = WORLD_SIZE / SEG;
const HALF = WORLD_SIZE / 2;
const grid = new Float32Array(N1 * N1);
for (let j = 0; j < N1; j++) {
  for (let i = 0; i < N1; i++) grid[j * N1 + i] = analyticHeight(i * CELL - HALF, j * CELL - HALF);
}

/** Ground height at a world position (matches the terrain mesh exactly). */
export function heightAt(x, z) {
  const gx = clamp((x + HALF) / CELL, 0, SEG - 1e-4), gz = clamp((z + HALF) / CELL, 0, SEG - 1e-4);
  const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz;
  const o = iz * N1 + ix;
  const ha = grid[o], hd = grid[o + 1], hb = grid[o + N1], hc = grid[o + N1 + 1];
  return fx + fz <= 1
    ? ha + (hd - ha) * fx + (hb - ha) * fz
    : hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}

export function waterLevelAt(x, z) {
  const dp = Math.hypot(x - POND.x, z - POND.z);
  return dp < POND.r + 1.5 ? POND.level : SEA_LEVEL;
}
/** Depth of water at a point; negative means dry land. */
export const waterDepthAt = (x, z) => waterLevelAt(x, z) - heightAt(x, z);

export function pathDistance(x, z) {
  let best = 1e9;
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const d = distToSegment(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function normalAt(x, z, out = new THREE.Vector3()) {
  const e = 0.9;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  return out.set(-hx, 2 * e, -hz).normalize();
}

// ---- Zones: where things grow and live -------------------------------------

/** Under the cottage or its porch: nothing grows here. */
export const inFootprint = (x, z) => Math.abs(x - COTTAGE.x) < 5.1 && z > COTTAGE.z - 3.8 && z < COTTAGE.z + 6.6;
export const inYard = (x, z) => Math.hypot(x - COTTAGE.x, z - COTTAGE.z - 2) < 15;
export const nearPond = (x, z, extra = 0) => Math.hypot(x - POND.x, z - POND.z) < POND.r + extra;
/** 0..1 woodland density: the north hill and its skirts. */
export function woodsAt(x, z) {
  const hx = x + 14, hz = z + 48;
  const base = Math.exp(-(hx * hx + hz * hz) / (2 * 26 * 26));
  return clamp(base * 1.5 + (noise2(x * 0.06 + 40, z * 0.06) - 0.5) * 0.3);
}
/** Patches of tall grass: where a sneaking cat becomes invisible. */
export function tallGrassAt(x, z) {
  const h = heightAt(x, z);
  if (h < 1.5 || inYard(x, z) || nearPond(x, z, 2.5) || pathDistance(x, z) < 2.2) return 0;
  if (woodsAt(x, z) > 0.45) return 0;
  const n = fbm(x * 0.055 + 80, z * 0.055 - 30, 3);
  return smoothstep(0.52, 0.6, n);
}
/** 0..1 how grassy the ground is here (0 on sand, paths, in water). */
export function grassAt(x, z) {
  const h = heightAt(x, z);
  if (nearPond(x, z, 0.4) || inFootprint(x, z)) return 0;
  let g = smoothstep(0.95, 1.6, h);
  g *= smoothstep(0.9, 2.0, pathDistance(x, z));
  g *= 1 - woodsAt(x, z) * 0.55;
  return g;
}
export const isBeach = (x, z) => {
  const h = heightAt(x, z);
  return h > 0.12 && h < 0.85 && !nearPond(x, z, 6);
};

// ---- Colour -----------------------------------------------------------------

const C = {
  sandWet: new THREE.Color('#b9a57e'), sand: new THREE.Color('#ecd9a8'), sandDry: new THREE.Color('#f3e6bf'),
  grassA: new THREE.Color('#7fb24a'), grassB: new THREE.Color('#5d9a3f'), grassDry: new THREE.Color('#a9bf55'),
  woods: new THREE.Color('#3f6b34'), dirt: new THREE.Color('#b08d5e'), mud: new THREE.Color('#6f6247'),
  seabed: new THREE.Color('#8fa58a'), deep: new THREE.Color('#3d5f6a'),
};
const tmp = new THREE.Color();

export function groundColor(x, z, out = new THREE.Color()) {
  const h = heightAt(x, z);
  const n = fbm(x * 0.12, z * 0.12, 3);
  const fine = noise2(x * 0.9, z * 0.9);
  if (nearPond(x, z, 1.2)) {
    const dp = Math.hypot(x - POND.x, z - POND.z);
    out.copy(C.mud).lerp(C.deep, smoothstep(POND.r - 2, POND.r - 8, dp));
    out.lerp(C.grassB, smoothstep(POND.r - 0.4, POND.r + 1.2, dp));
    return out;
  }
  if (h < 0.05) {
    out.copy(C.sandWet).lerp(C.seabed, smoothstep(0, -1.2, h)).lerp(C.deep, smoothstep(-1.5, -4.5, h));
    return out;
  }
  // Beach to grass.
  out.copy(C.sandWet).lerp(C.sand, smoothstep(0.05, 0.4, h)).lerp(C.sandDry, fine * 0.5);
  const grassy = smoothstep(0.85 + n * 0.5, 1.35 + n * 0.5, h);
  tmp.copy(C.grassA).lerp(C.grassB, n).lerp(C.grassDry, smoothstep(0.55, 0.8, fbm(x * 0.03 + 9, z * 0.03, 2)) * 0.6);
  tmp.lerp(C.woods, woodsAt(x, z) * 0.85);
  tmp.multiplyScalar(0.9 + fine * 0.2);
  out.lerp(tmp, grassy);
  // Paths and trampled yard.
  const pd = pathDistance(x, z);
  const pathMix = (1 - smoothstep(0.7, 1.9, pd + (fine - 0.5) * 0.8)) * grassy;
  tmp.copy(C.dirt).multiplyScalar(0.92 + fine * 0.16);
  out.lerp(tmp, pathMix * 0.92);
  return out;
}

// ---- Mesh and lookup texture ---------------------------------------------------

export function buildTerrainMesh() {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const normals = geo.attributes.normal;
  const c = new THREE.Color(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, grid[i]);
    groundColor(x, z, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    normalAt(x, z, n);
    normals.setXYZ(i, n.x, n.y, n.z);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

/** Height field as a texture so the water shader knows how deep it is. */
export function buildHeightTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1) - 0.5) * WORLD_SIZE;
      const z = (j / (size - 1) - 0.5) * WORLD_SIZE;
      const v = clamp((heightAt(x, z) + 6) / 12) * 255;
      const o = (j * size + i) * 4;
      data[o] = v; data[o + 1] = v; data[o + 2] = v; data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
