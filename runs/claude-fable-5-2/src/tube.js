// A lofted tube: rings of vertices swept along a list of centres, rebuilt every
// frame. The cat's body, legs and tail are all made of these, which is what lets
// the spine actually bend instead of rotating rigid blocks.
import * as THREE from 'three';

const t = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Tube {
  constructor(rings, sides, material) {
    this.rings = rings;
    this.sides = sides;
    const count = rings * sides + 2;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3).fill(1);
    const index = [];
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j, b = i * sides + ((j + 1) % sides);
        const c = a + sides, d = b + sides;
        index.push(a, b, c, b, d, c);
      }
    }
    const capA = rings * sides, capB = capA + 1, last = (rings - 1) * sides;
    for (let j = 0; j < sides; j++) {
      const n = (j + 1) % sides;
      index.push(capA, n, j, capB, last + j, last + n);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
  }

  /** fn(u along 0..1, theta around, out Color). theta = PI/2 is the top. */
  paint(fn) {
    const c = new THREE.Color();
    const { rings, sides, colors } = this;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < sides; j++) {
        fn(i / (rings - 1), (j / sides) * Math.PI * 2, c);
        const o = (i * sides + j) * 3;
        colors[o] = c.r; colors[o + 1] = c.g; colors[o + 2] = c.b;
      }
    }
    for (const [cap, u] of [[rings * sides, 0], [rings * sides + 1, 1]]) {
      fn(u, Math.PI / 2, c);
      colors[cap * 3] = c.r; colors[cap * 3 + 1] = c.g; colors[cap * 3 + 2] = c.b;
    }
    this.geometry.attributes.color.needsUpdate = true;
  }

  /**
   * centres: Vector3[rings]; rx, ry: radii per ring (sideways, vertical).
   * up: reference "up" so the cross-section does not spin.
   */
  update(centres, rx, ry, up = UP, capBulge = 0.6) {
    const { rings, sides, positions } = this;
    for (let i = 0; i < rings; i++) {
      const a = centres[Math.max(0, i - 1)], b = centres[Math.min(rings - 1, i + 1)];
      t.subVectors(b, a);
      if (t.lengthSq() < 1e-10) t.set(0, 0, 1); else t.normalize();
      side.crossVectors(up, t);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0); else side.normalize();
      upv.crossVectors(t, side);
      const c = centres[i];
      for (let j = 0; j < sides; j++) {
        const th = (j / sides) * Math.PI * 2;
        const cx = Math.cos(th) * rx[i], cy = Math.sin(th) * ry[i];
        const o = (i * sides + j) * 3;
        positions[o] = c.x + side.x * cx + upv.x * cy;
        positions[o + 1] = c.y + side.y * cx + upv.y * cy;
        positions[o + 2] = c.z + side.z * cx + upv.z * cy;
      }
      if (i === 0 || i === rings - 1) {
        const o = (rings * sides + (i === 0 ? 0 : 1)) * 3;
        const k = (i === 0 ? -1 : 1) * capBulge * Math.min(rx[i], ry[i]);
        positions[o] = c.x + t.x * k; positions[o + 1] = c.y + t.y * k; positions[o + 2] = c.z + t.z * k;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }
}

/** Uniform Catmull-Rom through pts at parameter s in [0, pts.length-1]. */
export function catmull(pts, s, out) {
  const n = pts.length - 1;
  const i = Math.min(Math.floor(s), n - 1);
  const f = s - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  const a = -0.5 * f3 + f2 - 0.5 * f, b = 1.5 * f3 - 2.5 * f2 + 1, c = -1.5 * f3 + 2 * f2 + 0.5 * f, d = 0.5 * f3 - 0.5 * f2;
  return out.set(
    p0.x * a + p1.x * b + p2.x * c + p3.x * d,
    p0.y * a + p1.y * b + p2.y * c + p3.y * d,
    p0.z * a + p1.z * b + p2.z * c + p3.z * d,
  );
}
export function catmull1(vals, s) {
  const n = vals.length - 1;
  const i = Math.min(Math.floor(s), n - 1);
  const f = s - i;
  const p0 = vals[Math.max(0, i - 1)], p1 = vals[i], p2 = vals[i + 1], p3 = vals[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  return p0 * (-0.5 * f3 + f2 - 0.5 * f) + p1 * (1.5 * f3 - 2.5 * f2 + 1) + p2 * (-1.5 * f3 + 2 * f2 + 0.5 * f) + p3 * (0.5 * f3 - 0.5 * f2);
}
