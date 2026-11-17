import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const group = (parent, x = 0, y = 0, z = 0) => {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
};
const materialCache = new Map();
export function paint(color, roughness = 0.85, metalness = 0) {
  const key = [color, roughness, metalness].join('/');
  if (!materialCache.has(key)) materialCache.set(key, new T.MeshStandardMaterial({ color, roughness, metalness }));
  return materialCache.get(key);
}
export const glow = (color) => new T.MeshBasicMaterial({ color });
const sphere = new T.SphereGeometry(1, 20, 13);
const cylinder = new T.CylinderGeometry(1, 1, 1, 24);
const circle = new T.CircleGeometry(1, 36);
const cube = new T.BoxGeometry();
export function mesh(parent, geometry, mat, x, y, z) {
  const m = new T.Mesh(geometry, typeof mat === 'string' ? paint(mat) : mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
export function ball(parent, mat, x, y, z, sx, sy, sz = sx) {
  const m = mesh(parent, sphere, mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}
export function box(parent, mat, x, y, z, w, h, d, radius = 0.05) {
  if (radius) return mesh(parent, new RoundedBoxGeometry(w, h, d, 1, radius), mat, x, y, z);
  const m = mesh(parent, cube, mat, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
export function drum(parent, mat, x, y, z, rx, height, rz = rx) {
  const m = mesh(parent, cylinder, mat, x, y, z);
  m.scale.set(rx, height, rz);
  return m;
}
export function disk(parent, mat, x, y, z, rx, ry = rx) {
  const m = mesh(parent, circle, mat, x, y, z);
  m.scale.set(rx, ry, 1);
  return m;
}
export function torus(parent, mat, x, y, z, radius, tube, radial = 36) {
  return mesh(parent, new T.TorusGeometry(radius, tube, 8, radial), mat, x, y, z);
}
export function line(parent, mat, coords, radius = .025, steps = 12) {
  const path = new T.CatmullRomCurve3(coords.map(([x, y, z]) => new T.Vector3(x, y, z)));
  return mesh(parent, new T.TubeGeometry(path, steps, radius, 5), mat, 0, 0, 0);
}
export function texture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function panel(parent, mat, x, y, z, w, h) {
  return mesh(parent, new T.PlaneGeometry(w, h), mat, x, y, z);
}

export function rng(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Bake opaque scenery by material. Moving parts and transparent decals use their own meshes.
export function batch(source, target, shadows = true) {
  source.updateMatrixWorld(true);
  const chunks = new Map();
  source.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const id = o.material;
    if (!chunks.has(id)) chunks.set(id, []);
    chunks.get(id).push(g);
  });
  for (const [mat, geoms] of chunks) {
    const baked = mesh(target, mergeGeometries(geoms), mat, 0, 0, 0);
    baked.castShadow = shadows;
    baked.receiveShadow = shadows;
    for (const g of geoms) g.dispose();
  }
}
export const standard = (map, extra = {}) => new T.MeshStandardMaterial({ map, roughness: .88, ...extra });
export const colouredTexture = (map, extra = {}) => new T.MeshBasicMaterial({ map, ...extra });

const earShape = new T.Shape();
earShape.moveTo(-.155, -.055);
earShape.quadraticCurveTo(-.17, .10, -.09, .34);
earShape.quadraticCurveTo(-.065, .40, -.025, .36);
earShape.quadraticCurveTo(.095, .255, .15, -.015);
earShape.quadraticCurveTo(.05, -.06, -.155, -.055);
const earGeometry = new T.ExtrudeGeometry(earShape, { depth: .08, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2, curveSegments: 10 });
const innerEar = new T.ShapeGeometry(earShape);
const yAxis = new T.Vector3(0, 1, 0);
const jointDelta = new T.Vector3();
function limbBetween(m, x, y, z, tx, ty, tz, width, depth) {
  jointDelta.set(tx - x, ty - y, tz - z);
  m.position.set((x + tx) / 2, (y + ty) / 2, (z + tz) / 2);
  m.scale.set(width, jointDelta.length() * .65, depth);
  m.quaternion.setFromUnitVectors(yAxis, jointDelta.normalize());
}

const TAIL_STEPS = 20;
const TAIL_SIDES = 8;
const tailMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .85 });
function makeTail(parent, fur, dark) {
  const geo = new T.BufferGeometry();
  const verts = new Float32Array((TAIL_STEPS + 1) * TAIL_SIDES * 3);
  const normals = new Float32Array(verts.length);
  const colours = new Float32Array(verts.length);
  const faces = [];
  const colour = new T.Color();
  for (let i = 0; i <= TAIL_STEPS; i++) {
    const stripe = [10, 15, 19].some(ring => Math.abs(ring - i) <= 1);
    colour.copy(stripe ? dark.color : fur.color);
    for (let j = 0; j < TAIL_SIDES; j++) {
      const a = i * TAIL_SIDES + j;
      colour.toArray(colours, a * 3);
      if (i === TAIL_STEPS) continue;
      const b = i * TAIL_SIDES + (j + 1) % TAIL_SIDES;
      faces.push(a, b, a + TAIL_SIDES, b, b + TAIL_SIDES, a + TAIL_SIDES);
    }
  }
  geo.setIndex(faces);
  geo.setAttribute('position', new T.BufferAttribute(verts, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('normal', new T.BufferAttribute(normals, 3).setUsage(T.DynamicDrawUsage));
  geo.setAttribute('color', new T.BufferAttribute(colours, 3));
  const tail = mesh(parent, geo, tailMaterial, 0, 0, 0);
  tail.frustumCulled = false;
  const coords = Array.from({ length: 5 }, () => new T.Vector3());
  const curve = new T.CatmullRomCurve3(coords);
  const p = new T.Vector3();
  const t = new T.Vector3();
  const b = new T.Vector3();
  const n = new T.Vector3();
  const normal = new T.Vector3();
  const axis = new T.Vector3(1, 0, 0);
  return (time, speed, sneaking, rest) => {
    const swing = Math.sin(time * (2 + speed * .4)) * (.17 + speed * .017);
    const high = (1.25 - .87 * sneaking) * (1 - rest * .83) - Math.min(.30, speed * .07);
    coords[0].set(0, .52, -.58);
    coords[1].set(swing * .25 + rest * .16, .71 - rest * .28, -.94);
    coords[2].set(swing + rest * .36, .69 + high * .42 - rest * .39, -1.17);
    coords[3].set(swing * 1.34 + rest * .52, .76 + high * .62 - rest * .46, -1.05 + rest * .18);
    coords[4].set(swing * 1.46 + .10 + rest * .54, .74 + high * .54 - rest * .43, -.79 + rest * .43);
    for (let i = 0; i <= TAIL_STEPS; i++) {
      const u = i / TAIL_STEPS;
      curve.getPoint(u, p);
      curve.getTangent(u, t);
      b.crossVectors(t, axis).normalize();
      n.crossVectors(b, t).normalize();
      const radius = Math.max(.001, (.117 - .048 * u) * Math.min(1, (1 - u) * 8));
      for (let j = 0; j < TAIL_SIDES; j++) {
        const phase = j / TAIL_SIDES * Math.PI * 2;
        normal.copy(n).multiplyScalar(Math.cos(phase)).addScaledVector(b, Math.sin(phase));
        const index = (i * TAIL_SIDES + j) * 3;
        normal.toArray(normals, index);
        verts[index] = p.x + normal.x * radius;
        verts[index + 1] = p.y + normal.y * radius;
        verts[index + 2] = p.z + normal.z * radius;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
  };
}

function bakeFixedParts(pivot, keep) {
  const staticParts = new T.Group();
  for (const child of pivot.children.slice()) {
    if (child.isMesh && child !== keep) staticParts.add(child);
  }
  batch(staticParts, pivot, false);
}

export function sculptCat(parent, spec) {
  const { coat, shade, bib, ear = '#d98d80', iris, scale = 1, collar } = spec;
  const fur = paint(coat), dark = paint(shade), cream = paint(bib);
  const root = group(parent);
  root.scale.setScalar(scale);
  const spine = group(root);
  ball(spine, fur, 0, .57, -.09, .313, .31, .65);
  ball(spine, fur, 0, .56, -.44, .322, .305, .32);
  ball(spine, cream, 0, .51, .305, .253, .277, .28);
  ball(spine, fur, 0, .665, .29, .277, .322, .31);
  // Tapering tabby marks follow the curve of the back and flanks.
  for (const z of [-.46, -.23, -.015]) {
    line(spine, dark, [[-.25, .646, z - .046], [-.15, .816, z], [0, .867, z + .055], [.15, .816, z], [.25, .646, z - .046]], .027);
  }

  bakeFixedParts(spine);
  const headPivot = group(spine, 0, .855, .487);
  ball(headPivot, fur, 0, .098, .002, .363, .308, .333);
  ball(headPivot, fur, -.226, .014, .106, .151, .146, .179);
  ball(headPivot, fur, .226, .014, .106, .151, .146, .179);
  ball(headPivot, cream, 0, -.098, .217, .159, .099, .111);
  for (const side of [-1, 1]) {
    ball(headPivot, cream, side * .105, -.023, .254, .136, .104, .134);
    for (const [x, y, z] of [[.139, -.013, .383], [.17, -.022, .368], [.152, -.044, .373]]) {
      ball(headPivot, dark, side * x, y, z, .009, .009, .006);
    }
    for (let i = 0; i < 3; i++) {
      line(headPivot, paint('#f6e0bb'), [[side * .154, -.028 - i * .018, .361], [side * .31, -.015 - i * .026, .341], [side * (.49 - i * .016), .016 - i * .057, .298]], .005, 6);
    }
    line(headPivot, dark, [[side * .264, .233, .196], [side * .295, .201, .181], [side * .328, .168, .143]], .019);
    line(headPivot, dark, [[side * .292, .10, .196], [side * .337, .082, .164], [side * .359, .063, .13]], .022);
  }
  for (const x of [-.094, 0, .094]) {
    line(headPivot, dark, [[x * 1.35, .376, .10], [x * 1.18, .36, .179], [x, .32, .234], [x * .83, .27 + Math.abs(x) * .2, .273]], .017);
  }
  const ears = [-1, 1].map(side => {
    const pivot = group(headPivot, side * .23, .269, -.073);
    pivot.rotation.z = -side * .30;
    const out = mesh(pivot, earGeometry, fur, 0, 0, 0);
    out.scale.x = side < 0 ? 1 : -1;
    const inset = mesh(pivot, innerEar, paint(ear), side * .018, .027, .111);
    inset.scale.set(side < 0 ? .70 : -.70, .71, .71);
    return pivot;
  });
  const eyes = [-1, 1].map(side => {
    const eye = group(headPivot, side * .159, .131, .266);
    eye.rotation.y = side * .29;
    eye.rotation.z = side * -.10;
    ball(eye, paint('#342e29'), 0, 0, 0, .105, .13, .058);
    ball(eye, paint(iris), 0, -.004, .042, .081, .109, .034);
    ball(eye, paint('#203034'), .006, -.004, .069, .038, .093, .018);
    ball(eye, glow('#fff4cf'), -.021, .043, .082, .024, .025, .009);
    ball(eye, glow('#f9db9d'), .029, -.04, .081, .009, .012, .005);
    return eye;
  });
  const nose = ball(headPivot, paint('#a45452', .65), 0, .025, .375, .059, .042, .029);
  nose.rotation.z = Math.PI / 6;
  line(headPivot, paint('#63463b'), [[-.079, -.063, .365], [-.047, -.077, .376], [0, -.05, .379], [0, .011, .384]], .009);
  line(headPivot, paint('#63463b'), [[0, -.05, .38], [.042, -.078, .378], [.078, -.062, .369]], .009);
  const mouth = ball(headPivot, '#693e40', 0, -.07, .38, .044, .038, .013);
  mouth.visible = false;
  bakeFixedParts(headPivot, mouth);
  const neck = torus(spine, paint(collar || '#426f68'), 0, .711, .399, .257, .029);
  neck.rotation.x = .77;
  neck.scale.y = .81;
  neck.visible = Boolean(collar);
  const charm = group(spine, 0, .575, .583);
  ball(charm, paint('#e7bb5e', .45, .35), 0, 0, 0, .065, .075, .037);
  ball(charm, '#624a34', 0, -.025, .032, .024, .008, .008);
  charm.visible = Boolean(collar);
  const tail = makeTail(spine, fur, dark);

  const legs = [];
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const upper = ball(root, fur, 0, 0, 0, 1, 1, 1);
    const lower = ball(root, fur, 0, 0, 0, 1, 1, 1);
    const toes = ball(root, cream, 0, 0, 0, .107, .075, .151);
    legs.push({ front, side, upper, lower, toes });
  }

  const pose = ({ time, stride = 0, speed = 0, sneaking = 0, airborne = false, vertical = 0, squash = 0, talk = 0, rest = 0 }) => {
    const move = Math.min(1, speed * .51);
    const walk = stride * Math.PI * 2;
    const crouch = .135 * sneaking;
    const bodyY = -crouch - .24 * rest - squash * .09 + Math.cos(walk * 2) * move * .027 + Math.sin(time * 3) * .014;
    spine.position.y = bodyY;
    spine.rotation.x = airborne ? T.MathUtils.clamp(-vertical * .038, -.19, .15) : Math.sin(walk) * move * .036;
    spine.rotation.z = Math.sin(walk) * move * .035;
    const blink = Math.max(0, Math.cos(time * 1.3 + scale * 6) - .985) * 52;
    for (const eye of eyes) eye.scale.y = Math.max(.10, 1 - blink - .92 * rest);
    headPivot.rotation.x = crouch * 1.6 - talk * .20 + rest * .21;
    headPivot.rotation.y = Math.sin(time * 1.7) * (.1 * (1 - move));
    headPivot.rotation.z = (Math.sin(time * 1.83 + scale) * .045) * (1 - move);
    mouth.visible = talk > .02;
    mouth.scale.y = .04 * talk;
    for (let i = 0; i < ears.length; i++) {
      const side = 2 * i - 1;
      ears[i].rotation.z = -side * (.30 + crouch + .18 * rest) + Math.sin(time * 4 + i) * .05;
      ears[i].rotation.y = Math.sin(time * 2.5 + i) * .16;
    }
    charm.rotation.x = Math.sin(walk) * move * .45;
    tail(time, speed, sneaking, rest);
    for (const leg of legs) {
      const { front, side, upper, lower, toes } = leg;
      const phi = walk + (front === (side < 0) ? 0 : Math.PI) + (front ? .71 : 0);
      const x = side * (front ? .195 : .215);
      const hipY = (front ? .55 : .51) + bodyY;
      const hipZ = front ? .371 : -.432;
      let footY = .068 + Math.max(0, Math.sin(phi)) * move * (.165 - .06 * sneaking);
      let footZ = hipZ + (front ? .045 : -.07) + Math.cos(phi) * move * (.25 - .085 * sneaking);
      if (airborne) {
        footY = (front ? .25 : .29) + Math.max(0, vertical * .018);
        footZ = hipZ + (front ? .18 : -.22) + T.MathUtils.clamp(-vertical * .037, -.13, .21);
      }
      footZ += .16 * rest;
      const midY = (hipY + footY) / 2 + .055;
      const midZ = (hipZ + footZ) / 2 + (front ? -.075 : .13);
      limbBetween(upper, x * .83, hipY, hipZ, x, midY, midZ, front ? .09 : .139, front ? .10 : .154);
      limbBetween(lower, x, midY, midZ, x, footY, footZ, .075, .082);
      toes.position.set(x, footY, footZ + .043);
    }
  };
  return { root, pose, reward: () => { charm.visible = neck.visible = true; }, removeReward: () => { charm.visible = neck.visible = Boolean(collar); } };
}
