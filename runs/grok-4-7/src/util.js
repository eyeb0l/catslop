import * as THREE from 'three';

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function angDiff(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

export function dampAngle(a, b, lambda, dt) {
  return a + angDiff(a, b) * (1 - Math.exp(-lambda * dt));
}

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function segDist(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const ab2 = abx * abx + abz * abz || 1;
  const t = clamp((apx * abx + apz * abz) / ab2, 0, 1);
  const dx = px - (ax + abx * t);
  const dz = pz - (az + abz * t);
  return Math.hypot(dx, dz);
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function paintUnitSphere(geo, kind) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const ginger = new THREE.Color(0xe0893c);
  const dark = new THREE.Color(0x9a4620);
  const cream = new THREE.Color(0xf4e4cc);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const stripe = 0.5 + 0.5 * Math.sin(z * 13 + y * 4);
    const belly = smoothstep((-y - 0.12) / 0.7);
    if (kind === 'tail') {
      const ring = 0.5 + 0.5 * Math.sin((y * 0.5 + z) * 18);
      c.copy(ginger).lerp(dark, 0.25 + ring * 0.55);
    } else {
      c.copy(ginger).lerp(cream, belly * (kind === 'belly' ? 0.95 : 0.72));
      const dorsal = smoothstep(y + 0.15);
      c.lerp(dark, (1 - belly) * dorsal * (0.22 + stripe * 0.5));
    }
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function noiseTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  paint(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const _y = new THREE.Vector3();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _iq = new THREE.Quaternion();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** Point an object's local +Y at `dest`, twisting so local +Z favours `pole`. */
export function alignY(obj, dest, pole) {
  obj.parent.updateWorldMatrix(true, false);
  _origin.copy(obj.position).applyMatrix4(obj.parent.matrixWorld);
  _dir.subVectors(dest, _origin);
  const len = _dir.length();
  if (len < 1e-5) return;
  _dir.multiplyScalar(1 / len);
  _iq.setFromRotationMatrix(obj.parent.matrixWorld).invert();
  _y.copy(_dir).applyQuaternion(_iq);
  _pole.subVectors(pole, _origin).applyQuaternion(_iq);
  const along = _pole.dot(_y);
  _pole.addScaledVector(_y, -along);
  if (_pole.lengthSq() < 1e-6) _pole.set(1, 0, 0);
  _pole.normalize();
  _x.crossVectors(_y, _pole);
  if (_x.lengthSq() < 1e-6) return;
  _x.normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _bend = new THREE.Vector3();

export function solveTwoBone(upper, lower, foot, pole, L1, L2) {
  upper.parent.updateWorldMatrix(true, false);
  const hip = _origin.copy(upper.position).applyMatrix4(upper.parent.matrixWorld);
  _a.subVectors(foot, hip);
  let dist = _a.length();
  if (dist < 1e-4) return;
  const max = L1 + L2 - 1e-4;
  const min = Math.abs(L1 - L2) + 1e-4;
  dist = clamp(dist, min, max);
  _a.multiplyScalar(1 / _a.length());
  const cosHip = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const hipAng = Math.acos(cosHip);
  _b.subVectors(pole, hip).normalize();
  _bend.copy(_b).addScaledVector(_a, -_b.dot(_a));
  if (_bend.lengthSq() < 1e-6) _bend.set(0, 0, 1);
  _bend.normalize();
  _knee.copy(hip);
  _knee.addScaledVector(_a, Math.cos(hipAng) * L1);
  _knee.addScaledVector(_bend, Math.sin(hipAng) * L1);
  alignY(upper, _knee, pole);
  upper.updateWorldMatrix(true, true);
  alignY(lower, foot, pole);
}
