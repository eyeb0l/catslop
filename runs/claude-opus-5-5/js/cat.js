// The cat: a procedural rig made of soft ellipsoids, IK legs, a simulated
// tail and a fur shader that paints stripes, socks and points in the cat's
// own rest space so the pattern sticks to the body as it moves.
import * as THREE from 'three';

export const COATS = {
  marmalade: { name: 'Marmalade', price: 0, pattern: 0, base: '#e3893a', dark: '#a9521b', light: '#f7dfbd', eye: '#a6c93a', nose: '#e4908a' },
  midnight: { name: 'Midnight', price: 20, pattern: 1, base: '#29262d', dark: '#141216', light: '#4a4450', eye: '#f2c230', nose: '#3a3036' },
  tuxedo: { name: 'Tuxedo', price: 25, pattern: 2, base: '#25232a', dark: '#141216', light: '#f6f2ea', eye: '#8fd16a', nose: '#e8a3a3' },
  silver: { name: 'Silver Tabby', price: 30, pattern: 0, base: '#bdbab4', dark: '#4c4946', light: '#f0ede6', eye: '#6cc48a', nose: '#d99a96' },
  calico: { name: 'Calico', price: 40, pattern: 3, base: '#f5f0e7', dark: '#2a2622', light: '#e38a3c', eye: '#e8b43a', nose: '#eaa0a0' },
  siamese: { name: 'Siamese', price: 45, pattern: 4, base: '#efe3cf', dark: '#4e3a2f', light: '#f8f1e4', eye: '#56a6ec', nose: '#5a4038' },
  cosmic: { name: 'Cosmic', price: 80, pattern: 5, base: '#272c6b', dark: '#8a52d8', light: '#ffffff', eye: '#ff7ad9', nose: '#b06ad9' },
};

export const HATS = {
  none: { name: 'No hat', price: 0 },
  party: { name: 'Party hat', price: 10 },
  flowers: { name: 'Flower crown', price: 15 },
  fez: { name: 'Fez', price: 20 },
  propeller: { name: 'Propeller cap', price: 30 },
  toast: { name: 'Bread slice', price: 35 },
  crown: { name: 'Tiny crown', price: 40 },
  wizard: { name: 'Wizard hat', price: 50 },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const sstep = (a, b, x) => smooth((x - a) / (b - a));
const TAU = Math.PI * 2;

const PART = { torso: 0, head: 1, leg: 2, tail: 3, ear: 4, paw: 5, muzzle: 6 };

const FUR_GLSL = /* glsl */ `
varying vec3 vRest; varying float vPart;
uniform vec3 uBase; uniform vec3 uDark; uniform vec3 uLight; uniform float uPattern;
float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
vec3 furColor(out float glow) {
  vec3 p = vRest;
  float part = vPart;
  float torso = 1.0 - step(0.5, part);
  float head = step(0.5, part) * (1.0 - step(1.5, part));
  float leg = step(1.5, part) * (1.0 - step(2.5, part));
  float tail = step(2.5, part) * (1.0 - step(3.5, part));
  float ear = step(3.5, part) * (1.0 - step(4.5, part));
  float paw = step(4.5, part) * (1.0 - step(5.5, part));
  float muzzle = step(5.5, part);
  float n = n3(p * 60.0);
  float n2 = n3(p * 9.0 + 7.0);
  float under = torso * smoothstep(0.165, 0.13, p.y + (n - 0.5) * 0.02);
  float chest = torso * smoothstep(0.07, 0.15, p.z) * smoothstep(0.235, 0.18, p.y + (n - 0.5) * 0.02);
  vec3 c = uBase;
  glow = 0.0;
  if (uPattern < 0.5) {
    float s = 0.0;
    s += torso * smoothstep(0.35, 0.9, sin(p.z * 95.0 + n2 * 5.0 + abs(p.x) * 30.0)) * smoothstep(0.16, 0.23, p.y);
    s += head * smoothstep(0.25, 0.85, sin(p.x * 170.0 + n2 * 2.0)) * smoothstep(0.37, 0.39, p.y) * (1.0 - smoothstep(0.035, 0.05, abs(p.x)));
    s += head * smoothstep(0.3, 0.9, sin(p.y * 180.0 + n2 * 2.0)) * smoothstep(0.045, 0.06, abs(p.x)) * (1.0 - step(0.36, p.y)) * (1.0 - step(0.25, p.z));
    s += leg * smoothstep(0.4, 0.9, sin(p.y * 95.0 + n2 * 3.0)) * 0.7;
    s += tail * smoothstep(0.3, 0.85, sin(p.z * 75.0 + n2 * 2.0));
    c = mix(uBase, uDark, clamp(s, 0.0, 1.0) * 0.68);
    c = mix(c, uLight, max(under, chest * 0.85));
    c = mix(c, uLight, muzzle);
    c = mix(c, uLight, paw * 0.55);
    c = mix(c, uDark, tail * smoothstep(-0.43, -0.49, p.z) * 0.85);
  } else if (uPattern < 1.5) {
    c = mix(uBase, uLight, muzzle * 0.25 + under * 0.12);
  } else if (uPattern < 2.5) {
    float white = max(max(under, chest), max(muzzle, paw));
    white = max(white, leg * smoothstep(0.075, 0.045, p.y));
    white = max(white, head * step(0.255, p.z) * smoothstep(0.325, 0.31, p.y) * (1.0 - smoothstep(0.03, 0.045, abs(p.x))));
    white = max(white, head * smoothstep(0.012, 0.0, abs(p.x)) * step(0.27, p.z) * step(p.y, 0.37));
    c = mix(uBase, uLight, white);
  } else if (uPattern < 3.5) {
    float m = n3(p * 13.0 + 3.0);
    c = uBase;
    c = mix(c, uLight, smoothstep(0.55, 0.6, m) * (1.0 - under) * (1.0 - muzzle) * (1.0 - paw));
    c = mix(c, uDark, smoothstep(0.37, 0.32, m) * (1.0 - under) * (1.0 - muzzle) * (1.0 - paw));
  } else if (uPattern < 4.5) {
    float pt = max(max(ear, paw), tail * smoothstep(-0.24, -0.38, p.z));
    pt = max(pt, leg * smoothstep(0.13, 0.05, p.y));
    pt = max(pt, max(muzzle, head * smoothstep(0.235, 0.29, p.z) * 0.9));
    c = mix(uBase, uDark, pt);
    c = mix(c, uLight, under * 0.5);
  } else {
    float st = step(0.955, n3(p * 140.0));
    c = mix(uBase, uDark, smoothstep(0.3, 0.75, n2));
    c = mix(c, uLight, st);
    glow = st * 0.8;
  }
  c *= 0.9 + 0.2 * n;
  return c;
}
`;

function furMaterial(uniforms) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute float aPart; varying vec3 vRest; varying float vPart;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = aRest; vPart = aPart;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FUR_GLSL)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat furGlow; diffuseColor.rgb = furColor(furGlow);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * furGlow;');
  };
  m.customProgramCacheKey = () => 'catfur';
  return m;
}

/** Two-bone IK: joint position for a chain A->J->T with lengths l1, l2, bending toward `pole`. */
const _dir = new THREE.Vector3();
function ik(A, T, l1, l2, pole, outJ, outT) {
  const dir = _dir.subVectors(T, A);
  let dist = dir.length();
  dir.divideScalar(dist || 1);
  dist = clamp(dist, Math.abs(l1 - l2) + 0.002, l1 + l2 - 0.0005);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const b = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  outJ.copy(A).addScaledVector(dir, a).addScaledVector(b, h);
  outT.copy(A).addScaledVector(dir, dist);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);

function placeSegment(mesh, A, B) {
  mesh.position.addVectors(A, B).multiplyScalar(0.5);
  _a.subVectors(B, A).normalize();
  mesh.quaternion.setFromUnitVectors(Y, _a);
}

export class CatModel {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uBase: { value: new THREE.Color() }, uDark: { value: new THREE.Color() },
      uLight: { value: new THREE.Color() }, uPattern: { value: 0 },
    };
    this.fur = furMaterial(this.uniforms);
    this.furMeshes = [];
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    this.t = 0;
    this.phase = 0;
    this._build();
    this._initState();
    this.setCoat('marmalade');
    this.setHat('none');
  }

  // ---------- construction ----------

  _furMesh(geo, part, parent) {
    const mesh = new THREE.Mesh(geo, this.fur);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    parent.add(mesh);
    this.furMeshes.push(mesh);
    return mesh;
  }

  _ellipsoid(parent, part, x, y, z, rx, ry, rz, seg = 20) {
    const m = this._furMesh(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), part, parent);
    m.position.set(x, y, z);
    m.scale.set(rx, ry, rz);
    return m;
  }

  _build() {
    const B = this.body;
    B.position.set(0, 0.215, 0);
    // torso: chest, middle, hips + shoulder and haunch masses
    this.chest = this._ellipsoid(B, PART.torso, 0, 0.012, 0.085, 0.079, 0.086, 0.11);
    this._ellipsoid(B, PART.torso, 0, 0.0, -0.01, 0.07, 0.077, 0.12);
    this._ellipsoid(B, PART.torso, 0, 0.012, -0.105, 0.071, 0.079, 0.09);
    for (const s of [1, -1]) {
      this._ellipsoid(B, PART.torso, s * 0.04, -0.005, 0.115, 0.034, 0.05, 0.045, 12);
      this._ellipsoid(B, PART.torso, s * 0.042, -0.0, -0.115, 0.04, 0.062, 0.058, 12);
    }
    // neck
    const neck = this._ellipsoid(B, PART.torso, 0, 0.055, 0.155, 0.05, 0.06, 0.06, 14);
    neck.rotation.x = -0.5;
    // head
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.07, 0.165);
    B.add(this.headPivot);
    const H = (this.head = new THREE.Group());
    H.position.set(0, 0.05, 0.055);
    this.headPivot.add(H);
    this._ellipsoid(H, PART.head, 0, 0, 0, 0.067, 0.058, 0.062, 22);
    for (const s of [1, -1]) {
      this._ellipsoid(H, PART.head, s * 0.032, -0.02, 0.016, 0.04, 0.033, 0.04, 14);
      this._ellipsoid(H, PART.muzzle, s * 0.0145, -0.027, 0.05, 0.021, 0.017, 0.019, 12);
    }
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.03, 0.03);
    H.add(this.jaw);
    this._ellipsoid(this.jaw, PART.muzzle, 0, -0.012, 0.018, 0.017, 0.012, 0.018, 10);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshStandardMaterial({ color: '#7a2f3a', roughness: 0.6 }));
    mouth.position.set(0, -0.032, 0.04);
    H.add(mouth);
    this.noseMat = new THREE.MeshStandardMaterial({ color: '#e4908a', roughness: 0.4 });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 10, 8), this.noseMat);
    nose.scale.set(1.35, 0.8, 0.9);
    nose.position.set(0, -0.008, 0.063);
    H.add(nose);
    // eyes
    this.irisMat = new THREE.MeshStandardMaterial({ color: '#a6c93a', roughness: 0.12, emissive: '#000', emissiveIntensity: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.05 });
    const glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.eyes = [];
    this.pupils = [];
    for (const s of [1, -1]) {
      const e = new THREE.Group();
      e.position.set(s * 0.026, 0.008, 0.049);
      e.rotation.y = s * 0.32;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 16, 12), this.irisMat);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 12, 10), pupilMat);
      pupil.scale.set(0.35, 0.92, 0.5);
      pupil.position.z = 0.0095;
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), glint);
      g.position.set(s * -0.005, 0.007, 0.016);
      e.add(ball, pupil, g);
      H.add(e);
      this.eyes.push(e);
      this.pupils.push(pupil);
    }
    // ears
    this.innerEarMat = new THREE.MeshStandardMaterial({ color: '#e9a6a0', roughness: 0.7, side: THREE.DoubleSide });
    this.ears = [];
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.036, 0.04, -0.004);
      pivot.rotation.set(-0.12, 0, -s * 0.32);
      const g = new THREE.ConeGeometry(0.03, 0.06, 3, 1);
      g.rotateY(Math.PI);
      g.scale(1, 1, 0.55);
      g.translate(0, 0.026, 0);
      this._furMesh(g, PART.ear, pivot);
      const gi = new THREE.ConeGeometry(0.021, 0.045, 3, 1, true);
      gi.rotateY(Math.PI);
      gi.scale(1, 1, 0.35);
      gi.translate(0, 0.022, 0.006);
      const inner = new THREE.Mesh(gi, this.innerEarMat);
      pivot.add(inner);
      H.add(pivot);
      this.ears.push({ pivot, s, twitch: 0 });
    }
    // whiskers
    const wp = [];
    for (const s of [1, -1]) {
      for (let i = 0; i < 3; i++) {
        wp.push(s * 0.026, -0.024 - i * 0.004, 0.056, s * (0.1 + i * 0.006), -0.012 - i * 0.016, 0.07 - i * 0.012);
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    this.whiskers = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#fbf7ee', transparent: true, opacity: 0.85 }));
    H.add(this.whiskers);
    // hat anchor
    this.hatAnchor = new THREE.Group();
    this.hatAnchor.position.set(0, 0.052, -0.004);
    H.add(this.hatAnchor);

    // legs: segments live in root space and are re-aimed every frame
    const legDefs = [
      { front: true, side: 1, root: V(0.04, -0.012, 0.118), foot: V(0.042, 0, 0.125) },
      { front: true, side: -1, root: V(-0.04, -0.012, 0.118), foot: V(-0.042, 0, 0.125) },
      { front: false, side: 1, root: V(0.044, -0.008, -0.118), foot: V(0.046, 0, -0.105) },
      { front: false, side: -1, root: V(-0.044, -0.008, -0.118), foot: V(-0.046, 0, -0.105) },
    ];
    this.legs = legDefs.map((d) => {
      const r1 = d.front ? 0.025 : 0.031, r2 = d.front ? 0.019 : 0.021, r3 = 0.016;
      const l1 = d.front ? 0.1 : 0.105, l2 = d.front ? 0.1 : 0.1;
      const upper = this._furMesh(new THREE.CapsuleGeometry(r1, l1, 4, 10), PART.leg, this.root);
      const lower = this._furMesh(new THREE.CapsuleGeometry(r2, l2, 4, 10), PART.leg, this.root);
      const meta = this._furMesh(new THREE.CapsuleGeometry(r3, d.front ? 0.03 : 0.058, 4, 8), PART.leg, this.root);
      const paw = this._furMesh(new THREE.SphereGeometry(1, 12, 8), PART.paw, this.root);
      paw.scale.set(0.019, 0.012, 0.025);
      return { ...d, l1, l2, upper, lower, meta, paw, footW: new THREE.Vector3(), lastStance: true, J: new THREE.Vector3(), W: new THREE.Vector3(), Ar: new THREE.Vector3(), T: new THREE.Vector3() };
    });

    // tail: a tube rebuilt from simulated joints each frame, in world space
    this.tailN = 13;
    this.tailSeg = 0.027;
    this.tailRadial = 9;
    this.tailRoot = V(0, 0.03, -0.185);
    this.tailJ = [];
    this.tailV = [];
    for (let i = 0; i < this.tailN; i++) { this.tailJ.push(new THREE.Vector3()); this.tailV.push(new THREE.Vector3()); }
    const N = this.tailN, R = this.tailRadial;
    const tg = new THREE.BufferGeometry();
    const vcount = N * R + 1;
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vcount * 3), 3));
    tg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vcount * 3), 3));
    const rest = new Float32Array(vcount * 3);
    const partA = new Float32Array(vcount).fill(PART.tail);
    const restY = 0.215 + this.tailRoot.y, restZ = this.tailRoot.z;
    for (let i = 0; i < N; i++) for (let k = 0; k < R; k++) {
      const a = (k / R) * TAU, r = this._tailRadius(i);
      const idx = (i * R + k) * 3;
      rest[idx] = Math.cos(a) * r; rest[idx + 1] = restY + Math.sin(a) * r; rest[idx + 2] = restZ - i * this.tailSeg;
    }
    rest[(N * R) * 3 + 1] = restY; rest[(N * R) * 3 + 2] = restZ - N * this.tailSeg;
    tg.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
    tg.setAttribute('aPart', new THREE.BufferAttribute(partA, 1));
    const idx = [];
    for (let i = 0; i < N - 1; i++) for (let k = 0; k < R; k++) {
      const a = i * R + k, b = i * R + ((k + 1) % R), c = (i + 1) * R + k, d = (i + 1) * R + ((k + 1) % R);
      idx.push(a, c, b, b, c, d);
    }
    const tip = N * R;
    for (let k = 0; k < R; k++) idx.push((N - 1) * R + k, tip, (N - 1) * R + ((k + 1) % R));
    tg.setIndex(idx);
    this.tail = new THREE.Mesh(tg, this.fur);
    this.tail.castShadow = true;
    this.tail.receiveShadow = true;
    this.tail.frustumCulled = false;
    this.scene.add(this.tail);
    this.tailPuff = 1;

    // place everything in the rest pose and bake rest-space coordinates for the fur shader
    this._restPose();
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const m = new THREE.Matrix4();
    for (const mesh of this.furMeshes) {
      const g = mesh.geometry;
      m.multiplyMatrices(inv, mesh.matrixWorld);
      const p = g.attributes.position;
      const rest2 = new Float32Array(p.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m);
        rest2[i * 3] = v.x; rest2[i * 3 + 1] = v.y; rest2[i * 3 + 2] = v.z;
      }
      g.setAttribute('aRest', new THREE.BufferAttribute(rest2, 3));
      g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(p.count).fill(mesh.userData.part), 1));
    }
  }

  _tailRadius(i) {
    const t = i / (this.tailN - 1);
    return lerp(0.02, 0.0125, t) * (i === this.tailN - 1 ? 0.75 : 1);
  }

  _restPose() {
    for (const L of this.legs) {
      const A = _b.copy(L.root).add(this.body.position);
      const P = _c.copy(L.foot).setY(0.012);
      if (L.front) {
        const W = P.clone().add(V(0, 0.032, 0.0));
        const J = new THREE.Vector3();
        ik(A, W, L.l1, L.l2, V(0, 0, -1), J, L.T);
        placeSegment(L.upper, A, J); placeSegment(L.lower, J, L.T); placeSegment(L.meta, L.T, P);
      } else {
        const Hk = P.clone().add(V(0, 0.06, -0.028));
        const J = new THREE.Vector3();
        ik(A, Hk, L.l1, L.l2, V(0, 0.2, 1), J, L.T);
        placeSegment(L.upper, A, J); placeSegment(L.lower, J, L.T); placeSegment(L.meta, L.T, P);
      }
      L.paw.position.copy(P).add(V(0, 0, 0.008));
    }
  }

  _initState() {
    this.s = {
      bodyY: 0.215, bodyZ: 0, pitch: 0, roll: 0, wiggle: 0,
      sitW: 0, loafW: 0, crouchW: 0, airW: 0, startleW: 0, scratchW: 0, groomW: 0,
      headYaw: 0, headPitch: 0, jaw: 0, blink: 1, blinkT: 2, pupil: 0.5, land: 0, landV: 0,
      earTimer: 1.5, tailInit: false,
    };
  }

  // ---------- customisation ----------

  setCoat(id) {
    const c = COATS[id] || COATS.marmalade;
    this.coat = id;
    this.uniforms.uBase.value.set(c.base);
    this.uniforms.uDark.value.set(c.dark);
    this.uniforms.uLight.value.set(c.light);
    this.uniforms.uPattern.value = c.pattern;
    this.irisMat.color.set(c.eye);
    this.irisMat.emissive.set(c.eye);
    this.noseMat.color.set(c.nose);
    this.innerEarMat.color.set(c.pattern === 4 ? '#7a5a4c' : c.pattern === 5 ? '#c78be8' : '#eaa7a1');
  }

  setHat(id) {
    this.hatId = id;
    while (this.hatAnchor.children.length) this.hatAnchor.remove(this.hatAnchor.children[0]);
    this.propeller = null;
    const g = buildHat(id);
    if (g) {
      this.hatAnchor.add(g.group);
      this.propeller = g.spin || null;
      g.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    }
  }

  // ---------- animation ----------

  /**
   * s: { pos, yaw, speed, vy, grounded, turn, mode, charge, sneak, swatT, meowT, scratchT,
   *      landImpact (set once on landing), lookAt, sunny, groundY, groomT, hop }
   * Returns footfall count this frame (for step sounds).
   */
  update(dt, s) {
    const st = this.s;
    this.t += dt;
    const t = this.t;
    this.root.position.copy(s.pos);
    this.root.rotation.y = s.yaw;
    const sp = s.grounded ? s.speed : 0;
    const mode = s.mode;

    // ----- gait -----
    const runW = sstep(2.3, 3.3, sp);
    const trotW = sstep(0.75, 1.25, sp) * (1 - runW);
    const walkW = 1 - runW - trotW;
    const freq = walkW * (0.85 + sp * 1.4) + trotW * (1.55 + sp * 0.55) + runW * (2.5 + sp * 0.22);
    const moveW = sstep(0.04, 0.25, sp);
    this.phase = (this.phase + freq * dt * moveW + (moveW < 0.01 ? 0 : 0)) % 1;
    const duty = walkW * 0.62 + trotW * 0.5 + runW * 0.34;
    const stride = clamp((sp * duty) / Math.max(freq, 0.01), 0, 0.42);
    const lift = walkW * 0.032 + trotW * 0.045 + runW * 0.075;
    const offs = [
      [0.25, 0.0, 0.58], // LF  walk / trot / gallop
      [0.75, 0.5, 0.66], // RF
      [0.0, 0.5, 0.0],   // LH
      [0.5, 0.0, 0.1],   // RH
    ];

    // ----- pose weights -----
    const isSit = mode === 'sit' || mode === 'groom' || mode === 'box';
    const isLoaf = mode === 'loaf' || mode === 'nap';
    st.sitW = damp(st.sitW, isSit ? 1 : 0, 6, dt);
    st.loafW = damp(st.loafW, isLoaf ? 1 : 0, 4, dt);
    st.crouchW = damp(st.crouchW, mode === 'charge' ? 0.6 + s.charge * 0.4 : s.sneak ? 0.55 : 0, 10, dt);
    st.airW = damp(st.airW, s.grounded ? 0 : 1, s.grounded ? 18 : 10, dt);
    st.startleW = damp(st.startleW, mode === 'startle' ? 1 : 0, mode === 'startle' ? 20 : 3, dt);
    st.scratchW = damp(st.scratchW, mode === 'scratch' ? 1 : 0, 10, dt);
    st.groomW = damp(st.groomW, mode === 'groom' ? 1 : 0, 4, dt);
    const poseW = Math.max(st.sitW, st.loafW);

    // landing squash (spring)
    if (s.landImpact) { st.landV -= Math.min(0.9, s.landImpact * 0.12); }
    st.landV += (-st.land * 220 - st.landV * 18) * dt;
    st.land += st.landV * dt;
    st.land = clamp(st.land, -0.08, 0.03);

    // ----- body -----
    const bobPh = this.phase * TAU;
    let tY = 0.215 + st.land;
    tY += moveW * (walkW * -0.006 * Math.abs(Math.sin(bobPh * 2)) + trotW * 0.008 * Math.sin(bobPh * 2) + runW * 0.03 * Math.sin(bobPh));
    tY -= runW * 0.012;
    tY -= st.crouchW * 0.07;
    let tPitch = runW * moveW * Math.sin(bobPh + 0.6) * 0.12 + st.crouchW * (mode === 'charge' ? 0.12 : 0.03);
    let tZ = 0;
    // air
    const vyK = clamp(-s.vy * 0.065, -0.35, 0.4);
    tPitch = lerp(tPitch, vyK, st.airW);
    tY = lerp(tY, 0.2, st.airW);
    // sit and loaf
    tY = lerp(tY, 0.17, st.sitW);
    tZ = lerp(tZ, 0.028, st.sitW);
    tPitch = lerp(tPitch, -0.7, st.sitW);
    tY = lerp(tY, 0.098, st.loafW);
    tPitch = lerp(tPitch, 0.02, st.loafW);
    // startle: up on tiptoes, back arched
    tY = lerp(tY, 0.255, st.startleW);
    tPitch = lerp(tPitch, 0, st.startleW);
    // scratching: up on the hind legs
    tY = lerp(tY, 0.24, st.scratchW);
    tPitch = lerp(tPitch, -0.55, st.scratchW);
    st.bodyY = tY;
    st.bodyZ = tZ;
    st.pitch = damp(st.pitch, tPitch, 14, dt);
    const lean = clamp(-s.turn * sp * 0.045, -0.3, 0.3) * (1 - st.airW);
    st.roll = damp(st.roll, lean, 8, dt);
    const wiggle = mode === 'charge' ? Math.sin(t * 17) * (0.05 + 0.1 * s.charge) : 0;
    st.wiggle = damp(st.wiggle, wiggle, 25, dt);
    const breath = Math.sin(t * (isLoaf ? 1.6 : 2.4)) * 0.0035;
    this.body.position.set(Math.sin(st.wiggle) * -0.06, st.bodyY + breath, st.bodyZ);
    this.body.rotation.set(st.pitch, st.wiggle, st.roll);
    const puff = 1 + st.startleW * 0.1;
    this.body.scale.set(puff, puff * (1 + breath * 2), 1);

    // ----- legs -----
    this.body.updateMatrix();
    const bm = this.body.matrix;
    let footfalls = 0;
    const swat = s.swatT >= 0 && s.swatT < 0.34 ? s.swatT / 0.34 : -1;
    const rising = s.vy > 0.5;
    this.legs.forEach((L, i) => {
      const o = offs[i];
      // circular blend of phase offsets so gaits morph without jumps
      const sx = walkW * Math.sin(o[0] * TAU) + trotW * Math.sin(o[1] * TAU) + runW * Math.sin(o[2] * TAU);
      const cx = walkW * Math.cos(o[0] * TAU) + trotW * Math.cos(o[1] * TAU) + runW * Math.cos(o[2] * TAU);
      const off = Math.atan2(sx, cx) / TAU;
      const p = (((this.phase + off) % 1) + 1) % 1;
      const P = L.T.copy(L.foot);
      P.y = 0.012;
      let stance = true;
      if (moveW > 0.001) {
        if (p < duty) {
          const k = p / duty;
          P.z += (stride / 2 - stride * k) * moveW;
        } else {
          stance = false;
          const k = (p - duty) / (1 - duty);
          P.z += (-stride / 2 + stride * smooth(k)) * moveW;
          P.y += lift * Math.sin(Math.PI * k) * moveW;
        }
      }
      if (stance && !L.lastStance && moveW > 0.3) footfalls++;
      L.lastStance = stance;
      if (L.front) P.z += runW * 0.03; else P.z -= runW * 0.02;
      // crouch: front paws forward
      if (L.front) P.z += st.crouchW * 0.025;
      // air pose
      if (st.airW > 0.01) {
        const air = L.front
          ? _a.set(L.foot.x * 0.9, rising ? 0.07 : -0.02, rising ? 0.21 : 0.17)
          : _a.set(L.foot.x, rising ? 0.04 : 0.05, rising ? -0.2 : -0.11);
        P.lerp(air, st.airW);
      }
      // sit / loaf
      if (poseW > 0.001) {
        const sitP = L.front ? _a.set(L.side * 0.034, 0.012, 0.135) : _a.set(L.side * 0.05, 0.012, 0.035);
        const loafP = L.front ? _b.set(L.side * 0.028, 0.012, 0.14) : _b.set(L.side * 0.05, 0.012, -0.05);
        const k = st.loafW / Math.max(poseW, 1e-4);
        sitP.lerp(loafP, k);
        P.lerp(sitP, poseW);
      }
      // startle: legs stiff and splayed
      if (st.startleW > 0.01) P.lerp(_a.set(L.side * 0.055, 0.012, L.front ? 0.14 : -0.13), st.startleW);
      // scratch: front paws up the sofa, alternating
      if (L.front && st.scratchW > 0.01) {
        const k = Math.sin(t * 15 + (L.side > 0 ? 0 : Math.PI));
        P.lerp(_a.set(L.side * 0.04, 0.2 + k * 0.05, 0.24 + Math.max(0, k) * 0.02), st.scratchW);
      }
      // groom: lick the right front paw
      if (L.front && L.side < 0 && st.groomW > 0.01) {
        P.lerp(_a.set(-0.012, 0.25 + Math.sin(t * 5) * 0.01, 0.2), st.groomW);
      }
      // swat with the right front paw
      if (L.front && L.side < 0 && swat >= 0) {
        const raised = _a.set(-0.035, 0.15, 0.2);
        const strike = _b.set(0.0, 0.03, 0.29);
        if (swat < 0.35) P.lerp(raised, smooth(swat / 0.35));
        else if (swat < 0.6) P.copy(raised).lerp(strike, smooth((swat - 0.35) / 0.25));
        else P.copy(strike).lerp(_c.copy(L.foot).setY(0.012), smooth((swat - 0.6) / 0.4));
      }
      // solve
      const A = L.Ar.copy(L.root).applyMatrix4(bm);
      const flat = L.front ? 0 : Math.max(poseW, st.crouchW * 0.4);
      const off2 = L.front ? _a.set(0, 0.032, 0.002) : _a.set(0, lerp(0.06, 0.016, flat), lerp(-0.028, -0.066, flat));
      const W = L.W.copy(P).add(off2);
      const pole = L.front ? _b.set(0, -0.15, -1) : _b.set(L.side * 0.15, 0.25, 1);
      ik(A, W, L.l1, L.l2, pole, L.J, _c);
      W.copy(_c);
      placeSegment(L.upper, A, L.J);
      placeSegment(L.lower, L.J, W);
      placeSegment(L.meta, W, P);
      L.paw.position.copy(P);
      L.paw.position.z += 0.008;
      L.paw.rotation.x = L.front && P.y > 0.05 ? -0.8 : 0;
    });

    // ----- head -----
    let lookYaw = clamp(s.turn * 0.12, -0.5, 0.5);
    let lookPitch = 0;
    if (s.lookAt) {
      this.root.updateMatrixWorld(true);
      _a.copy(s.lookAt);
      this.headPivot.parent.worldToLocal(_a);
      _a.sub(this.headPivot.position);
      lookYaw = clamp(Math.atan2(_a.x, _a.z), -1.1, 1.1);
      lookPitch = clamp(-Math.atan2(_a.y - 0.05, Math.hypot(_a.x, _a.z)), -0.7, 0.6);
    }
    if (mode === 'meow' || s.meowT >= 0 && s.meowT < 0.5) lookPitch -= 0.35;
    if (isLoaf) lookPitch += mode === 'nap' ? 0.3 : 0.0;
    if (st.groomW > 0.2) { lookPitch += 0.55 * st.groomW; lookYaw = -0.25 * st.groomW; }
    if (swat >= 0) lookPitch += 0.25;
    st.headYaw = damp(st.headYaw, lookYaw, 7, dt);
    st.headPitch = damp(st.headPitch, lookPitch, 7, dt);
    this.headPivot.rotation.set(-st.pitch * 0.75 + st.headPitch, st.headYaw, -st.roll * 0.5);
    if (mode === 'nap') this.headPivot.rotation.z += 0.35;
    this.headPivot.position.y = 0.07 - st.loafW * 0.02;

    // jaw for meows and hisses
    const jawT = s.meowT >= 0 && s.meowT < 0.55 ? Math.sin(Math.PI * clamp(s.meowT / 0.55, 0, 1)) * 0.6 : 0;
    st.jaw = damp(st.jaw, Math.max(jawT, st.startleW * 0.5), 30, dt);
    this.jaw.rotation.x = st.jaw;

    // blink, pupils
    st.blinkT -= dt;
    if (st.blinkT < 0) { st.blinkT = 1.5 + Math.random() * 4; st.blinkPhase = 0; }
    let eyeOpen = 1;
    if (st.blinkPhase !== undefined && st.blinkPhase < 1) { st.blinkPhase += dt / 0.16; eyeOpen = 1 - Math.sin(Math.PI * clamp(st.blinkPhase, 0, 1)) * 0.95; }
    if (mode === 'nap') eyeOpen = 0.06;
    else if (mode === 'loaf') eyeOpen = Math.min(eyeOpen, 0.45);
    else if (st.groomW > 0.5) eyeOpen = Math.min(eyeOpen, 0.3);
    if (st.startleW > 0.3) eyeOpen = 1.15;
    st.blink = damp(st.blink, eyeOpen, 25, dt);
    for (const e of this.eyes) e.scale.set(1, Math.max(0.05, st.blink), 1);
    const pupilTarget = mode === 'charge' || st.startleW > 0.3 ? 1.0 : s.sunny ? 0.16 : 0.42;
    st.pupil = damp(st.pupil, pupilTarget, 5, dt);
    for (const p of this.pupils) p.scale.set(clamp(st.pupil, 0.12, 1) * 0.95, 0.92, 0.5);

    // ears: twitches, back when startled, perked when hunting
    st.earTimer -= dt;
    if (st.earTimer < 0) { st.earTimer = 1 + Math.random() * 4; this.ears[(Math.random() * 2) | 0].twitch = 1; }
    for (const e of this.ears) {
      e.twitch = Math.max(0, e.twitch - dt * 6);
      const flat = st.startleW * 1.0 + (mode === 'nap' ? 0.25 : 0);
      const perk = mode === 'charge' ? 0.25 : 0;
      e.pivot.rotation.set(-0.12 - flat * 0.9 + perk + Math.sin(e.twitch * 9) * 0.25, e.s * flat * 0.4, -e.s * (0.32 + flat * 0.6 - perk * 0.4));
    }

    // propeller spins with speed
    if (this.propeller) this.propeller.rotation.y += dt * (3 + sp * 9 + (s.grounded ? 0 : 14));

    // ----- tail -----
    this._tail(dt, s, mode, sp, runW, st);
    return footfalls;
  }

  _tail(dt, s, mode, sp, runW, st) {
    const t = this.t;
    let base = 1.15, curl = 1.1, sway = 0.12, swayF = 1.8, wrap = 0, twitch = 0;
    if (sp > 0.1) { base = lerp(1.2, 0.3, runW); curl = lerp(0.9, 0.2, runW); sway = 0.08; swayF = 4; }
    if (s.sneak) { base = 0.05; curl = 0.25; }
    if (mode === 'charge') { base = -0.05; curl = 0.1; twitch = 0.6 + s.charge * 0.6; }
    if (!s.grounded) { base = 0.5; curl = 0.2; sway = 0.02; }
    const posed = Math.max(st.sitW, st.loafW);
    if (posed > 0.5) { base = -0.15; curl = -0.1; sway = 0.06; swayF = 0.7; wrap = 2.3; twitch = mode === 'nap' ? 0 : 0.15; }
    if (st.startleW > 0.3) { base = 1.5; curl = 0; sway = 0.02; }
    this.tailPuff = damp(this.tailPuff, st.startleW > 0.3 ? 2.1 : 1, st.startleW > 0.3 ? 20 : 1.5, dt);

    this.body.updateMatrixWorld(true);
    const N = this.tailN;
    const rootW = _a.copy(this.tailRoot).applyMatrix4(this.body.matrixWorld);
    const bodyQ = this.body.getWorldQuaternion(_q);
    const targets = [];
    let p = rootW.clone();
    targets.push(p.clone());
    for (let i = 1; i < N; i++) {
      const k = i / (N - 1);
      const pitch = base + curl * k * k;
      const yaw = Math.sin(t * swayF - k * 2.5) * sway * (0.4 + k) + wrap * k * 0.85 + Math.sin(t * 13 + k * 4) * twitch * k * k;
      const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      d.applyQuaternion(bodyQ);
      p.addScaledVector(d, this.tailSeg);
      targets.push(p.clone());
    }
    const J = this.tailJ;
    if (!this.s.tailInit || s.teleport) {
      for (let i = 0; i < N; i++) J[i].copy(targets[i]);
      this.s.tailInit = true;
    }
    J[0].copy(targets[0]);
    const groundY = s.groundY ?? 0;
    for (let i = 1; i < N; i++) {
      const k = i / (N - 1);
      const rate = lerp(40, 9, k);
      J[i].lerp(targets[i], 1 - Math.exp(-rate * dt));
      // keep segment length
      _b.subVectors(J[i], J[i - 1]);
      const len = _b.length() || 1;
      J[i].copy(J[i - 1]).addScaledVector(_b, this.tailSeg / len);
      const minY = groundY + this._tailRadius(i) * this.tailPuff * 0.9;
      if (J[i].y < minY && s.pos.y - groundY < 0.05) J[i].y = minY;
    }
    // rebuild the tube
    const pos = this.tail.geometry.attributes.position;
    const nor = this.tail.geometry.attributes.normal;
    const R = this.tailRadial;
    let up = _c.set(0, 1, 0).applyQuaternion(bodyQ);
    const tan = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = J[Math.max(0, i - 1)], b = J[Math.min(N - 1, i + 1)];
      tan.subVectors(b, a).normalize();
      nrm.copy(up).addScaledVector(tan, -up.dot(tan));
      if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0);
      nrm.normalize();
      bin.crossVectors(tan, nrm);
      up = nrm;
      const r = this._tailRadius(i) * (i === 0 ? 1 : this.tailPuff);
      for (let k = 0; k < R; k++) {
        const ang = (k / R) * TAU;
        const cx = Math.cos(ang), sy = Math.sin(ang);
        const nx = bin.x * cx + nrm.x * sy, ny = bin.y * cx + nrm.y * sy, nz = bin.z * cx + nrm.z * sy;
        const idx = i * R + k;
        pos.setXYZ(idx, J[i].x + nx * r, J[i].y + ny * r, J[i].z + nz * r);
        nor.setXYZ(idx, nx, ny, nz);
      }
    }
    const tipDir = tan;
    const last = J[N - 1];
    const rTip = this._tailRadius(N - 1) * this.tailPuff;
    pos.setXYZ(N * R, last.x + tipDir.x * rTip, last.y + tipDir.y * rTip, last.z + tipDir.z * rTip);
    nor.setXYZ(N * R, tipDir.x, tipDir.y, tipDir.z);
    pos.needsUpdate = true;
    nor.needsUpdate = true;
  }

  setVisible(v) {
    this.root.visible = v;
    this.tail.visible = v;
  }
}

// ---------- hats ----------

function buildHat(id) {
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const group = new THREE.Group();
  let spin = null;
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); return m; };
  switch (id) {
    case 'party': {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const g = c.getContext('2d');
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4d35e' : '#e8546b'; g.fillRect(0, i * 8, 64, 8); }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const cone = add(new THREE.ConeGeometry(0.03, 0.09, 20), std(0xffffff, { map: tex }), 0, 0.045, 0);
      cone.rotation.z = 0.15;
      add(new THREE.SphereGeometry(0.012, 10, 8), std('#3f8ad8'), -0.007, 0.09, 0);
      break;
    }
    case 'crown': {
      const gold = std('#e3b23c', { metalness: 0.9, roughness: 0.25 });
      add(new THREE.CylinderGeometry(0.03, 0.028, 0.022, 20, 1, true), gold, 0, 0.011, 0).material.side = THREE.DoubleSide;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        add(new THREE.ConeGeometry(0.008, 0.022, 6), gold, Math.cos(a) * 0.028, 0.032, Math.sin(a) * 0.028);
        add(new THREE.SphereGeometry(0.004, 6, 6), std(i % 2 ? '#d8344b' : '#3f8ad8', { roughness: 0.2 }), Math.cos(a) * 0.03, 0.014, Math.sin(a) * 0.03);
      }
      group.rotation.z = -0.2;
      break;
    }
    case 'fez': {
      add(new THREE.CylinderGeometry(0.024, 0.031, 0.04, 20), std('#b7283b', { roughness: 0.8 }), 0, 0.02, 0);
      add(new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 4), std('#1f1a1a'), 0.012, 0.03, 0).rotation.z = -0.9;
      add(new THREE.SphereGeometry(0.005, 6, 6), std('#1f1a1a'), 0.026, 0.02, 0);
      group.rotation.z = 0.12;
      break;
    }
    case 'propeller': {
      const cap = new THREE.SphereGeometry(0.036, 18, 10, 0, TAU, 0, Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ color: '#3f8ad8', roughness: 0.6 });
      add(cap, m, 0, -0.008, 0).scale.set(1, 0.7, 1);
      const seg = 4;
      for (let i = 0; i < seg; i++) {
        const w = new THREE.SphereGeometry(0.0365, 10, 6, (i / seg) * TAU, TAU / seg / 2, 0, Math.PI / 2);
        add(w, std(['#e8546b', '#f4d35e'][i % 2]), 0, -0.0075, 0).scale.set(1, 0.71, 1);
      }
      add(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 4), std('#888'), 0, 0.025, 0);
      const prop = new THREE.Group();
      prop.position.y = 0.036;
      for (let i = 0; i < 2; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.002, 0.012), std(i ? '#e8546b' : '#f4d35e'));
        blade.position.x = i ? -0.03 : 0.03;
        blade.rotation.x = i ? 0.3 : -0.3;
        prop.add(blade);
      }
      group.add(prop);
      spin = prop;
      break;
    }
    case 'wizard': {
      const m = std('#4b3b8f', { roughness: 0.7 });
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.004, 24), m, 0, 0.002, 0);
      const cone = add(new THREE.ConeGeometry(0.032, 0.13, 20, 4), m, 0, 0.067, 0);
      cone.geometry.translate(0, 0, 0);
      cone.rotation.z = 0.25;
      cone.position.x = -0.012;
      for (let i = 0; i < 5; i++) add(new THREE.OctahedronGeometry(0.006), std('#f4d35e', { emissive: '#f4d35e', emissiveIntensity: 0.6 }), Math.cos(i * 1.3) * 0.022 - 0.01, 0.025 + i * 0.016, Math.sin(i * 1.3) * 0.022);
      break;
    }
    case 'flowers': {
      const cols = ['#f4d35e', '#e8546b', '#ffffff', '#e86a9a', '#f0a33c'];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        add(new THREE.SphereGeometry(0.009, 8, 6), std(cols[i % cols.length], { roughness: 0.8 }), Math.cos(a) * 0.04, 0.0 - Math.sin(a) * 0.004, Math.sin(a) * 0.036 - 0.004);
        add(new THREE.SphereGeometry(0.006, 6, 4), std('#5f8f4e'), Math.cos(a + 0.35) * 0.041, -0.004, Math.sin(a + 0.35) * 0.037 - 0.004);
      }
      break;
    }
    case 'toast': {
      // a slice of bread worn around the face, like a picture frame
      const shape = new THREE.Shape();
      shape.moveTo(-0.075, -0.07); shape.lineTo(0.075, -0.07); shape.lineTo(0.075, 0.04);
      shape.quadraticCurveTo(0.09, 0.1, 0.03, 0.105); shape.quadraticCurveTo(0, 0.12, -0.03, 0.105);
      shape.quadraticCurveTo(-0.09, 0.1, -0.075, 0.04); shape.lineTo(-0.075, -0.07);
      const hole = new THREE.Path();
      hole.absellipse(0, -0.005, 0.058, 0.06, 0, TAU, true);
      shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 16 });
      const m = add(geo, [std('#e8c58a', { roughness: 0.95 }), std('#b07a3e', { roughness: 0.95 })], 0, -0.05, 0.035);
      m.rotation.x = -0.05;
      break;
    }
    default:
      return null;
  }
  return { group, spin };
}

export { buildHat };
