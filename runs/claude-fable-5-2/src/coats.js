// Fur patterns, painted as vertex colours. Each coat is a handful of colours and
// a pattern rule; the rules below decide what goes where on body, legs, tail and face.
import * as THREE from 'three';
import { smoothstep, noise2, clamp } from './util.js';

const col = (hex) => new THREE.Color(hex);

export const COATS = {
  marmalade: { name: 'Marmalade', pattern: 'tabby', base: col('#e59a45'), dark: col('#b9601f'), light: col('#fdf0dc'), eye: col('#9bd24a'), nose: col('#e58a8f'), ear: col('#f2a7a0') },
  smoke: { name: 'Smoke', pattern: 'tabby', base: col('#8f96a1'), dark: col('#4f5560'), light: col('#eef0f2'), eye: col('#e8c64a'), nose: col('#b97a80'), ear: col('#d9a5a5') },
  tuxedo: { name: 'Tuxedo', pattern: 'tuxedo', base: col('#25262e'), dark: col('#1b1b22'), light: col('#ffffff'), eye: col('#ecc94b'), nose: col('#e9959b'), ear: col('#caa0a4') },
  siam: { name: 'Siam', pattern: 'points', base: col('#efe2cb'), dark: col('#46332a'), light: col('#f8f0e2'), eye: col('#55a9ee'), nose: col('#5a4038'), ear: col('#6e5046') },
  calico: { name: 'Calico', pattern: 'calico', base: col('#f7f0e6'), dark: col('#2d2b30'), light: col('#e28c3d'), eye: col('#b6d450'), nose: col('#e9959b'), ear: col('#f0a9a2') },
  void: { name: 'The Void', pattern: 'solid', base: col('#17171d'), dark: col('#0d0d11'), light: col('#17171d'), eye: col('#ffd640'), nose: col('#2a2228'), ear: col('#3a2d33') },
};

/** Body: u 0 rump -> 1 neck, theta around (PI/2 = spine, -PI/2 = belly). */
export function paintBody(coat, u, theta, out) {
  const dorsal = Math.sin(theta);
  const sideways = Math.cos(theta);
  switch (coat.pattern) {
    case 'tabby': {
      const wob = Math.sin(theta * 2 + u * 9) * 0.9;
      const s = smoothstep(0.5, 0.8, 0.5 + 0.5 * Math.sin(u * 34 + wob)) * smoothstep(-0.25, 0.45, dorsal);
      out.copy(coat.base).lerp(coat.dark, s * 0.85);
      out.lerp(coat.dark, smoothstep(0.86, 1, dorsal) * 0.5); // dorsal stripe
      out.lerp(coat.light, smoothstep(-0.3, -0.75, dorsal) * 0.9);
      out.lerp(coat.light, smoothstep(0.78, 0.95, u) * smoothstep(0.35, -0.2, dorsal));
      break;
    }
    case 'tuxedo': {
      out.copy(coat.base);
      out.lerp(coat.light, smoothstep(-0.45, -0.7, dorsal));
      out.lerp(coat.light, smoothstep(0.7, 0.82, u) * smoothstep(0.3, 0.0, dorsal));
      break;
    }
    case 'points': {
      out.copy(coat.base).lerp(coat.dark, smoothstep(0.3, 1, dorsal) * 0.12 + smoothstep(0.12, 0, u) * 0.5);
      out.lerp(coat.light, smoothstep(-0.2, -0.8, dorsal) * 0.6);
      break;
    }
    case 'calico': {
      const n = noise2(u * 5.2 + sideways * 1.4 + 3, theta * 1.1 + u * 2);
      out.copy(coat.base);
      if (dorsal > -0.35) {
        if (n > 0.6) out.copy(coat.light);
        else if (n < 0.36) out.copy(coat.dark);
      }
      break;
    }
    default:
      out.copy(coat.base);
  }
  return out;
}

/** Leg: u 0 shoulder/hip -> 1 paw. */
export function paintLeg(coat, u, theta, legIndex, out) {
  switch (coat.pattern) {
    case 'tabby': {
      const s = smoothstep(0.55, 0.8, 0.5 + 0.5 * Math.sin(u * 22 + legIndex));
      out.copy(coat.base).lerp(coat.dark, s * 0.7 * smoothstep(0.85, 0.6, u));
      out.lerp(coat.light, smoothstep(0.72, 0.86, u));
      break;
    }
    case 'tuxedo':
      out.copy(coat.base).lerp(coat.light, smoothstep(0.62, 0.72, u));
      break;
    case 'points':
      out.copy(coat.base).lerp(coat.dark, smoothstep(0.3, 0.75, u));
      break;
    case 'calico': {
      const n = noise2(legIndex * 3.7 + 1, u * 2.4);
      out.copy(coat.base);
      if (u < 0.6) { if (n > 0.62) out.copy(coat.light); else if (n < 0.3) out.copy(coat.dark); }
      break;
    }
    default:
      out.copy(coat.base);
  }
  return out;
}

export function pawColor(coat, out) {
  switch (coat.pattern) {
    case 'tabby': case 'tuxedo': return out.copy(coat.light);
    case 'points': return out.copy(coat.dark);
    default: return out.copy(coat.base);
  }
}

/** Tail: u 0 base -> 1 tip. */
export function paintTail(coat, u, theta, out) {
  switch (coat.pattern) {
    case 'tabby': {
      const s = smoothstep(0.45, 0.7, 0.5 + 0.5 * Math.sin(u * 26));
      out.copy(coat.base).lerp(coat.dark, s * 0.85).lerp(coat.dark, smoothstep(0.82, 0.95, u));
      break;
    }
    case 'tuxedo':
      out.copy(coat.base).lerp(coat.light, smoothstep(0.86, 0.93, u));
      break;
    case 'points':
      out.copy(coat.base).lerp(coat.dark, smoothstep(0.05, 0.4, u));
      break;
    case 'calico':
      out.copy(u > 0.45 ? coat.dark : coat.light);
      break;
    default:
      out.copy(coat.base);
  }
  return out;
}

/** Head: x,y,z in roughly [-1,1] head space (+z is the face, +y up). */
export function paintHead(coat, x, y, z, out) {
  const muzzle = smoothstep(0.55, 0.25, Math.hypot(x * 1.15, (y + 0.36) * 1.25)) * smoothstep(0.1, 0.5, z);
  const chin = smoothstep(-0.45, -0.75, y) * smoothstep(-0.1, 0.4, z);
  switch (coat.pattern) {
    case 'tabby': {
      out.copy(coat.base);
      // Forehead "M" and cheek stripes.
      const fore = smoothstep(0.5, 0.8, 0.5 + 0.5 * Math.sin(x * 15)) * smoothstep(0.15, 0.45, y) * smoothstep(-0.1, 0.4, z) * smoothstep(0.6, 0.3, Math.abs(x));
      const cheek = smoothstep(0.5, 0.8, 0.5 + 0.5 * Math.sin(y * 16 + 1)) * smoothstep(0.45, 0.8, Math.abs(x)) * smoothstep(0.3, -0.2, y);
      const back = smoothstep(0.5, 0.8, 0.5 + 0.5 * Math.sin(x * 12)) * smoothstep(0.1, -0.5, z) * smoothstep(-0.2, 0.4, y);
      out.lerp(coat.dark, clamp(fore + cheek * 0.8 + back * 0.8) * 0.85);
      out.lerp(coat.light, clamp(muzzle + chin));
      break;
    }
    case 'tuxedo': {
      const blaze = smoothstep(0.2, 0.08, Math.abs(x)) * smoothstep(0.55, 0.2, y) * smoothstep(0.2, 0.5, z);
      out.copy(coat.base).lerp(coat.light, clamp(muzzle * 1.3 + chin + blaze));
      break;
    }
    case 'points': {
      const mask = smoothstep(1.05, 0.45, Math.hypot(x, y + 0.12)) * smoothstep(0.0, 0.55, z);
      out.copy(coat.base).lerp(coat.dark, clamp(mask * 1.15));
      break;
    }
    case 'calico': {
      out.copy(x > 0.06 ? coat.light : coat.dark);
      const blaze = smoothstep(0.22, 0.06, Math.abs(x - 0.03)) * smoothstep(-0.2, 0.3, z);
      out.lerp(coat.base, clamp(muzzle * 1.4 + chin + blaze));
      break;
    }
    default:
      out.copy(coat.base);
  }
  return out;
}

export function earColor(coat, sideSign, out) {
  if (coat.pattern === 'points') return out.copy(coat.dark);
  if (coat.pattern === 'calico') return out.copy(sideSign > 0 ? coat.light : coat.dark);
  if (coat.pattern === 'tabby') return out.copy(coat.base).lerp(coat.dark, 0.35);
  return out.copy(coat.base);
}
