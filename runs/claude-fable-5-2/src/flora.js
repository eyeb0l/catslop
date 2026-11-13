// Everything that grows: wind-blown instanced grass (which bends away from the
// cat), trees, flowers, reeds and rocks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { heightAt, grassAt, tallGrassAt, woodsAt, pathDistance, inYard, nearPond, isBeach, POND, DOCK } from './terrain.js';
import { mulberry32, lerp, clamp, TAU, noise2, fbm } from './util.js';

// ---- Grass ---------------------------------------------------------------------

function clumpGeometry() {
  const pos = [], idx = [];
  const blades = [[0, 0, 0, 1], [1.1, 0.16, 0.1, 0.82], [2.3, -0.12, 0.14, 0.9], [3.6, 0.05, -0.17, 0.7]];
  for (const [rot, ox, oz, hs] of blades) {
    const base = pos.length / 3;
    const c = Math.cos(rot), s = Math.sin(rot);
    for (const [x, y] of [[-0.5, 0], [0.5, 0], [-0.36, 0.48], [0.36, 0.48], [0, 1]]) {
      const lean = 0.3 * y * y;
      pos.push(ox + x * c + lean * s, y * hs, oz - x * s + lean * c);
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

function grassMaterial(uniforms) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aOffset;
        attribute vec4 aParams; // rotation, height, width, tint
        attribute float aKind;  // 0 lawn, 1 tall grass, 2 reed
        uniform float uTime;
        uniform vec3 uCat;
        varying float vH;
        varying float vTint;
        varying float vKind;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        float hgt = position.y;
        float cr = cos(aParams.x), sr = sin(aParams.x);
        vec3 bp = vec3(position.x * aParams.z, position.y * aParams.y, position.z * aParams.z);
        bp.xz = vec2(bp.x * cr + bp.z * sr, -bp.x * sr + bp.z * cr);
        vec3 transformed = aOffset + bp;
        float flex = hgt * hgt * aParams.y;
        float gust = sin(uTime * 1.5 + aOffset.x * 0.33 + aOffset.z * 0.24) + sin(uTime * 2.9 + aOffset.x * 0.9 - aOffset.z * 0.6) * 0.35;
        transformed.x += gust * 0.085 * flex;
        transformed.z += cos(uTime * 1.2 + aOffset.z * 0.31) * 0.05 * flex;
        vec2 away = aOffset.xz - uCat.xz;
        float dl = length(away);
        float push = (1.0 - smoothstep(0.1, 0.95, dl)) * step(abs(aOffset.y - uCat.y), 1.2);
        transformed.xz += normalize(away + vec2(0.0001)) * push * 0.5 * hgt * aParams.y;
        transformed.y -= push * 0.35 * hgt * aParams.y;
        vH = hgt; vTint = aParams.w; vKind = aKind;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vH;
        varying float vTint;
        varying float vKind;`)
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);')
      .replace('#include <color_fragment>', `
        // Linear-space colours: roots match the terrain so blades melt into it.
        vec3 lawn = mix(vec3(0.115, 0.30, 0.045), vec3(0.30, 0.56, 0.09), vH);
        vec3 tall = mix(vec3(0.17, 0.24, 0.04), vec3(0.72, 0.55, 0.17), vH * vH);
        vec3 reed = mix(vec3(0.03, 0.11, 0.025), vec3(0.13, 0.30, 0.06), vH);
        vec3 gc = mix(lawn, tall, clamp(vKind, 0.0, 1.0));
        gc = mix(gc, reed, clamp(vKind - 1.0, 0.0, 1.0));
        diffuseColor.rgb = gc * (0.82 + 0.36 * vTint);`);
  };
  return mat;
}

export function buildGrass(scene) {
  const rng = mulberry32(7);
  const uniforms = { uTime: { value: 0 }, uCat: { value: new THREE.Vector3() } };
  const material = grassMaterial(uniforms);
  const clump = clumpGeometry();
  const CH = 8, EXT = 104, size = (EXT * 2) / CH;
  const buckets = Array.from({ length: CH * CH }, () => []);
  const step = 0.4;
  for (let z = -EXT; z < EXT; z += step) {
    for (let x = -EXT; x < EXT; x += step) {
      const px = x + (rng() - 0.5) * step * 1.6, pz = z + (rng() - 0.5) * step * 1.6;
      const g = grassAt(px, pz);
      const dp = Math.hypot(px - POND.x, pz - POND.z);
      const reedBand = dp > POND.r - 1.6 && dp < POND.r + 0.5 && noise2(px * 0.5, pz * 0.5) > 0.55;
      if (!reedBand && g < 0.05) continue;
      const tall = reedBand ? 0 : tallGrassAt(px, pz);
      const yard = inYard(px, pz);
      // Lawn is thinner than meadow; tall grass and reeds are dense.
      const keep = reedBand ? 0.9 : tall > 0.5 ? 1 : (yard ? 0.8 : 0.85) * g;
      if (rng() > keep) continue;
      const kind = reedBand ? 2 : tall > 0.5 ? 1 : 0;
      const h = kind === 2 ? lerp(0.9, 1.5, rng()) : kind === 1 ? lerp(0.72, 1.08, rng()) : (yard ? lerp(0.12, 0.2, rng()) : lerp(0.2, 0.44, rng())) * (0.6 + g * 0.4);
      const w = kind === 2 ? 0.07 : kind === 1 ? 0.12 : 0.1;
      const cx = clamp(Math.floor((px + EXT) / size), 0, CH - 1), cz = clamp(Math.floor((pz + EXT) / size), 0, CH - 1);
      buckets[cz * CH + cx].push(px, heightAt(px, pz) - 0.02, pz, rng() * TAU, h, w, rng(), kind);
    }
  }
  const chunks = [];
  let total = 0;
  buckets.forEach((b, bi) => {
    const n = b.length / 8;
    if (!n) return;
    // Shuffle so a lower instance count thins the grass evenly.
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
    const off = new Float32Array(n * 3), par = new Float32Array(n * 4), kind = new Float32Array(n);
    let minY = 1e9, maxY = -1e9;
    order.forEach((src, i) => {
      const o = src * 8;
      off[i * 3] = b[o]; off[i * 3 + 1] = b[o + 1]; off[i * 3 + 2] = b[o + 2];
      par[i * 4] = b[o + 3]; par[i * 4 + 1] = b[o + 4]; par[i * 4 + 2] = b[o + 5]; par[i * 4 + 3] = b[o + 6];
      kind[i] = b[o + 7];
      minY = Math.min(minY, b[o + 1]); maxY = Math.max(maxY, b[o + 1] + 1.5);
    });
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = clump.index;
    geo.setAttribute('position', clump.attributes.position);
    geo.setAttribute('normal', clump.attributes.normal);
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(par, 4));
    geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
    geo.instanceCount = n;
    const cx = bi % CH, cz = Math.floor(bi / CH);
    const centre = new THREE.Vector3(-EXT + (cx + 0.5) * size, (minY + maxY) / 2, -EXT + (cz + 0.5) * size);
    geo.boundingSphere = new THREE.Sphere(centre, Math.hypot(size * 0.75, (maxY - minY) / 2));
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.userData.full = n;
    scene.add(mesh);
    chunks.push(mesh);
    total += n;
  });
  return {
    uniforms, chunks, total,
    setDensity(f) { for (const m of chunks) m.geometry.instanceCount = Math.max(1, Math.floor(m.userData.full * f)); },
  };
}

// ---- Trees -----------------------------------------------------------------------

function blobGeometry(rng, radius, squash = 0.85) {
  const g = new THREE.IcosahedronGeometry(radius, 1);
  const p = g.attributes.position;
  // Icosahedron(detail 1) is non-indexed: jitter by position so shared corners stay together.
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (noise2(x * 3.1 + y * 1.7 + rng.seedOffset, z * 3.1 - y * 2.3) - 0.5) * 0.5;
    p.setXYZ(i, x * k, y * k * squash, z * k);
  }
  return g;
}

function canopyGeometry(rng) {
  rng.seedOffset = rng() * 50;
  const parts = [];
  const n = 3 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 1.25 : lerp(0.7, 1.05, rng());
    const g = blobGeometry(rng, r);
    const a = rng() * TAU, d = i === 0 ? 0 : lerp(0.6, 1.1, rng());
    g.translate(Math.cos(a) * d, i === 0 ? 0.35 : lerp(-0.35, 0.6, rng()), Math.sin(a) * d);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  const p = merged.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = clamp((p.getY(i) + 1) / 2.6);
    const v = lerp(0.7, 1.15, t);
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  merged.computeVertexNormals();
  return merged;
}

function pineGeometry() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(1.25 - i * 0.26, 1.5, 7, 1);
    g.translate(0, 0.6 + i * 0.95, 0);
    g.rotateY(i * 0.5);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  const p = merged.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = lerp(0.6, 1.1, clamp(p.getY(i) / 4.4));
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return merged;
}

function swayMaterial(uniforms, opts) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, ...opts });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
          float sw = sin(uTime * 1.1 + ip.x * 0.2 + ip.z * 0.17) + sin(uTime * 2.3 + ip.x * 0.5 + position.y) * 0.3;
          transformed.x += sw * 0.045 * (position.y + 1.0);
          transformed.z += cos(uTime * 0.9 + ip.z * 0.23) * 0.03 * (position.y + 1.0);
        #endif`);
  };
  return mat;
}

/** Returns { colliders, positions } and adds meshes to the scene. */
export function buildTrees(scene, uniforms) {
  const rng = mulberry32(21);
  const trees = [];
  const tryPlace = (x, z, minGap) => {
    const h = heightAt(x, z);
    if (h < 1.5 || inYard(x, z) || nearPond(x, z, 3.5) || pathDistance(x, z) < 2.6) return false;
    if (Math.abs(x - DOCK.x) < 5 && z > 55) return false;
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < minGap) return false;
    return true;
  };
  for (let i = 0; i < 2600 && trees.length < 230; i++) {
    const x = (rng() - 0.5) * 190, z = (rng() - 0.5) * 190;
    const w = woodsAt(x, z);
    const chance = w > 0.3 ? 0.9 : 0.035;
    if (rng() > chance) continue;
    if (!tryPlace(x, z, w > 0.3 ? 3.4 : 9)) continue;
    const pine = w > 0.3 ? rng() < 0.5 + (heightAt(x, z) - 4) * 0.08 : rng() < 0.15;
    trees.push({ x, z, y: heightAt(x, z), pine, s: lerp(0.85, 1.5, rng()) * (pine ? 1.05 : 1), rot: rng() * TAU, tint: rng() });
  }
  // A few hand-placed landmark trees.
  for (const [x, z, s] of [[-7, -1, 1.7], [22, 12, 1.5], [-22, 30, 1.4], [30, 44, 1.55], [-12, 52, 1.3], [44, 6, 1.4]]) {
    trees.push({ x, z, y: heightAt(x, z), pine: false, s, rot: rng() * TAU, tint: rng() });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 7, 1);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  trunks.castShadow = true; trunks.receiveShadow = true;

  const variants = [canopyGeometry(rng), canopyGeometry(rng), canopyGeometry(rng)];
  const leafMat = swayMaterial(uniforms, {});
  const broad = trees.filter((t) => !t.pine), pines = trees.filter((t) => t.pine);
  const groups = variants.map((_, v) => broad.filter((_, i) => i % 3 === v));
  const meshes = groups.map((list, v) => new THREE.InstancedMesh(variants[v], leafMat, Math.max(1, list.length)));
  const pineMesh = new THREE.InstancedMesh(pineGeometry(), swayMaterial(uniforms, {}), Math.max(1, pines.length));

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const leafA = new THREE.Color('#7fbf4a'), leafB = new THREE.Color('#b5d458'), leafC = new THREE.Color('#58a04a');
  const pineA = new THREE.Color('#3f8a5a'), pineB = new THREE.Color('#58a36a');
  const colliders = [];
  trees.forEach((t, i) => {
    const trunkH = (t.pine ? 1.3 : 2.3) * t.s;
    q.setFromAxisAngle(up, t.rot);
    m.compose(p.set(t.x, t.y - 0.15, t.z), q, sc.set(t.s * (t.pine ? 0.8 : 1), trunkH + 0.6, t.s * (t.pine ? 0.8 : 1)));
    trunks.setMatrixAt(i, m);
    colliders.push({ kind: 'circle', x: t.x, z: t.z, r: 0.32 * t.s, top: t.y + 30, bottom: t.y - 2 });
    t.canopyY = t.y + trunkH + (t.pine ? 0 : 0.9 * t.s);
  });
  groups.forEach((list, v) => {
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.rot);
      m.compose(p.set(t.x, t.canopyY, t.z), q, sc.setScalar(t.s * 1.25));
      meshes[v].setMatrixAt(i, m);
      c.copy(leafA).lerp(t.tint > 0.5 ? leafB : leafC, Math.abs(t.tint - 0.5) * 1.6);
      meshes[v].setColorAt(i, c);
    });
    meshes[v].count = list.length;
  });
  pines.forEach((t, i) => {
    q.setFromAxisAngle(up, t.rot);
    m.compose(p.set(t.x, t.y + 1.0 * t.s, t.z), q, sc.setScalar(t.s * 1.15));
    pineMesh.setMatrixAt(i, m);
    pineMesh.setColorAt(i, c.copy(pineA).lerp(pineB, t.tint));
  });
  pineMesh.count = pines.length;
  for (const mesh of [...meshes, pineMesh]) {
    mesh.castShadow = true; mesh.receiveShadow = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  trunks.frustumCulled = false;
  scene.add(trunks);
  return { colliders, trees };
}

// ---- Flowers and rocks ----------------------------------------------------------------

export function buildFlowers(scene, uniforms) {
  const rng = mulberry32(99);
  const spots = [];
  const palette = ['#ffffff', '#ffd23e', '#ff7aa8', '#b28dff', '#ff9d5c', '#ff5a5f'].map((h) => new THREE.Color(h));
  for (let i = 0; i < 9000 && spots.length < 620; i++) {
    const x = (rng() - 0.5) * 180, z = (rng() - 0.5) * 180;
    if (grassAt(x, z) < 0.8 || tallGrassAt(x, z) > 0.2 || woodsAt(x, z) > 0.5) continue;
    // Flowers come in drifts.
    if (fbm(x * 0.07 + 300, z * 0.07 + 100, 2) < 0.52 && !inYard(x, z)) continue;
    if (inYard(x, z) && rng() > 0.25) continue;
    spots.push({ x, z, y: heightAt(x, z), h: lerp(0.28, 0.55, rng()), color: palette[(rng() * palette.length) | 0], s: lerp(0.95, 1.4, rng()) });
  }
  const head = new THREE.SphereGeometry(0.075, 7, 5);
  head.scale(1, 0.55, 1);
  const stem = new THREE.CylinderGeometry(0.008, 0.012, 1, 4);
  stem.translate(0, 0.5, 0);
  const headMat = swayFlowerMaterial(uniforms, { roughness: 0.7 });
  const heads = new THREE.InstancedMesh(head, headMat, spots.length);
  const stems = new THREE.InstancedMesh(stem, swayFlowerMaterial(uniforms, { color: '#4f8a35', roughness: 1 }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  spots.forEach((f, i) => {
    m.compose(p.set(f.x, f.y + f.h, f.z), q, s.setScalar(f.s));
    heads.setMatrixAt(i, m);
    heads.setColorAt(i, f.color);
    m.compose(p.set(f.x, f.y, f.z), q, s.set(1, f.h, 1));
    stems.setMatrixAt(i, m);
  });
  heads.instanceColor.needsUpdate = true;
  heads.frustumCulled = stems.frustumCulled = false;
  scene.add(heads, stems);
  return spots;
}

function swayFlowerMaterial(uniforms, opts) {
  const mat = new THREE.MeshStandardMaterial(opts);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          float sw = sin(uTime * 1.5 + mvPosition.x * 0.33 + mvPosition.z * 0.24);
          float hh = instanceMatrix[1].y > 0.9 ? 1.0 : position.y; // heads move whole, stems bend
          mvPosition.x += sw * 0.05 * hh;
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}

export function buildRocks(scene) {
  const rng = mulberry32(5);
  const rocks = [];
  for (let i = 0; i < 4000 && rocks.length < 90; i++) {
    const x = (rng() - 0.5) * 200, z = (rng() - 0.5) * 200;
    const h = heightAt(x, z);
    if (h < -0.4 || inYard(x, z) || nearPond(x, z, 0.5) || pathDistance(x, z) < 2) continue;
    const beach = isBeach(x, z) || h < 0.2;
    if (!beach && rng() > 0.12) continue;
    if (Math.abs(x - DOCK.x) < 4 && z > 60) continue;
    rocks.push({ x, z, y: h, s: beach ? lerp(0.25, 0.9, rng() * rng()) : lerp(0.3, 1.1, rng() * rng()) });
  }
  // Landmarks: sunning rocks by the pond and a cluster on the west shore.
  rocks.push({ x: POND.x + 12.6, z: POND.z - 4.5, y: heightAt(POND.x + 12.6, POND.z - 4.5), s: 1.5 });
  rocks.push({ x: POND.x - 6, z: POND.z + 13, y: heightAt(POND.x - 6, POND.z + 13), s: 1.2 });
  rocks.push({ x: 30, z: -16, y: heightAt(30, -16), s: 1.35 });

  rng.seedOffset = 3;
  const geo = blobGeometry(rng, 1, 0.62);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, rocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const colliders = [];
  rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(0, rng() * TAU, 0));
    m.compose(p.set(r.x, r.y + r.s * 0.18, r.z), q, s.set(r.s, r.s, r.s * lerp(0.8, 1.2, rng())));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHSL(0.09 + rng() * 0.05, 0.06 + rng() * 0.06, 0.5 + rng() * 0.14));
    if (r.s > 0.55) colliders.push({ kind: 'circle', x: r.x, z: r.z, r: r.s * 0.78, top: r.y + r.s * 0.74, bottom: r.y - 2 });
  });
  mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  scene.add(mesh);
  return { colliders, rocks };
}
