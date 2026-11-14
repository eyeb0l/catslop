import * as THREE from 'three';
import { LEVEL } from './level.js';
import { clamp, lerp, mulberry32, noiseTexture, segDist, smoothstep } from './util.js';

function std(color, rough = 0.9, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra });
}

function put(mesh, x, y, z, parent) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function createWorld(scene, renderer, quality) {
  const rand = mulberry32(0x51a70);
  const blocks = [];
  const circles = [];
  const platforms = [];

  const plasterTex = noiseTexture(128, (g, s) => {
    g.fillStyle = '#f3e6d2';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 180 + rand() * 50;
      g.fillStyle = `rgba(${v},${v - 20},${v - 40},0.18)`;
      g.fillRect(rand() * s, rand() * s, 2, 2);
    }
  });
  plasterTex.repeat.set(3, 2);
  const woodTex = noiseTexture(128, (g, s) => {
    g.fillStyle = '#8d5a34';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      const v = 90 + rand() * 50;
      g.fillStyle = `rgba(${v},${v * 0.55},${v * 0.3},0.35)`;
      g.fillRect(0, y, s, 2);
    }
  });
  woodTex.repeat.set(1, 2);

  const mats = {
    plaster: std(0xf0e2cc, 0.93, { map: plasterTex }),
    plasterShade: std(0xe3d0b6, 0.94),
    brick: std(0xa85a42, 0.96),
    wood: std(0x8d5a34, 0.86, { map: woodTex }),
    woodDark: std(0x684028, 0.9),
    leaf: std(0x3e6a3c, 0.92),
    leafLite: std(0x6d9448, 0.88),
    hedge: std(0x2f5538, 0.94),
    terra: std(0xc4623c, 0.78),
    stone: std(0xcbb892, 0.96),
    stoneDark: std(0xa89880, 0.95),
    cloth: std(0xf4efe4, 0.96),
    clothRed: std(0xc4474a, 0.9),
    clothBlue: std(0x3d6e8c, 0.9),
    metal: std(0xc5c8cc, 0.32, { metalness: 0.75 }),
    soil: std(0x7a4e34, 0.95),
    cream: std(0xf6efe2, 0.9),
    trunk: std(0x6b4632, 0.94),
    cushion: std(0xf7f1e6, 0.95),
  };

  const glass = new THREE.MeshStandardMaterial({
    color: 0xffe2c4,
    emissive: 0xffb15a,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0,
  });

  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const hemi = new THREE.HemisphereLight(0xd7ecff, 0xc4a07a, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b8, 2.35);
  sun.castShadow = quality.shadows;
  sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 48;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xbfd4ee, 0.28);
  fill.position.set(-6, 4, -4);
  scene.add(fill);

  const skyGeo = new THREE.SphereGeometry(80, 20, 14);
  const skyPos = skyGeo.attributes.position;
  const skyCol = new Float32Array(skyPos.count * 3);
  const zenith = new THREE.Color(0x7eb6e4);
  const horizon = new THREE.Color(0xf6c9a4);
  const c = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 80;
    const t = smoothstep(clamp(y * 0.85 + 0.15, 0, 1));
    c.copy(horizon).lerp(zenith, t);
    skyCol[i * 3] = c.r;
    skyCol[i * 3 + 1] = c.g;
    skyCol[i * 3 + 2] = c.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyCol, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  scene.add(sky);

  scene.fog = new THREE.Fog(0xf3d5b4, 18, 52);

  function discTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,220,170,0.7)');
    grd.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture(),
    color: 0xfff1d2,
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  }));
  sunSprite.scale.set(10, 10, 1);
  scene.add(sunSprite);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture(),
    color: 0xd5e4ff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  }));
  moonSprite.scale.set(3.2, 3.2, 1);
  scene.add(moonSprite);

  const starPositions = [];
  for (let i = 0; i < 80; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.3 + rand() * 1.1;
    starPositions.push(Math.cos(a) * Math.cos(e) * 50, Math.sin(e) * 28 + 8, Math.sin(a) * Math.cos(e) * 50);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: 0xfff6e4, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(stars);

  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff4ea, roughness: 1, metalness: 0 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const n = 3;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.4 + rand(), 8, 6), cloudMat);
      s.position.set((k - 1) * 1.6, rand() * 0.4, rand() * 0.6);
      s.scale.y = 0.55;
      g.add(s);
    }
    g.position.set(-12 + i * 6, 11 + rand() * 2, -6 + rand() * 10);
    g.userData.base = g.position.clone();
    g.userData.speed = 0.15 + rand() * 0.2;
    scene.add(g);
    clouds.push(g);
  }

  // Ground
  const groundGeo = new THREE.PlaneGeometry(34, 28, 70, 58);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  const gc = new Float32Array(gp.count * 3);
  const grassA = new THREE.Color(0x6f9a44);
  const grassB = new THREE.Color(0x86ab52);
  const grassC = new THREE.Color(0x5c8638);
  const pathC = new THREE.Color(0xd2c0a2);
  const soilC = new THREE.Color(0x8a573c);
  const pondC = new THREE.Color(0x3e6a52);
  const pathPts = [[-3.7, -4.5], [-1.2, -0.5], [0.4, 2.8], [0.2, 7.2], [0.1, 13.8]];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i);
    const z = gp.getZ(i);
    let dPath = 99;
    for (let p = 0; p < pathPts.length - 1; p++) {
      dPath = Math.min(dPath, segDist(x, z, pathPts[p][0], pathPts[p][1], pathPts[p + 1][0], pathPts[p + 1][1]));
    }
    const pondDx = (x - LEVEL.pond.x) / LEVEL.pond.rx;
    const pondDz = (z - LEVEL.pond.z) / LEVEL.pond.rz;
    const pond = pondDx * pondDx + pondDz * pondDz;
    const bed = (x < -10.3 && x > -12.3 && z > -4.2 && z < 13.2)
      || (x > 10.3 && x < 12.3 && z > -4.2 && z < 13.2)
      || (z < -3.7 && z > -5.05 && x > -7 && x < 7);
    const wobble = 0.5 + 0.5 * Math.sin(x * 0.72 + z * 0.31) * Math.cos(z * 0.48 + x * 0.17);
    c.copy(grassB).lerp(wobble > 0.5 ? grassA : grassC, Math.abs(wobble - 0.5) * 0.55);
    if (pond < 1) c.lerp(pondC, 0.75);
    else if (dPath < 0.95) c.lerp(pathC, smoothstep(1 - dPath / 0.95));
    else if (bed) c.lerp(soilC, 0.82);
    const edge = Math.min(Math.abs(x) > 11 ? (Math.abs(x) - 11) : 0, z > 12.5 ? z - 12.5 : 0);
    c.multiplyScalar(1 - clamp(edge, 0, 1) * 0.25);
    if (z < LEVEL.house.faceZ + 0.4) c.multiplyScalar(0.72);
    gc[i * 3] = c.r;
    gc[i * 3 + 1] = c.g;
    gc[i * 3 + 2] = c.b;
    if (pond < 1) gp.setY(i, -0.04 * (1 - pond));
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  function flag(mesh, cast = true) {
    mesh.castShadow = cast && quality.shadows;
    mesh.receiveShadow = true;
    return mesh;
  }

  // House
  const H = LEVEL.house;
  const house = flag(new THREE.Mesh(new THREE.BoxGeometry(H.maxX - H.minX, H.height, H.faceZ - H.backZ), mats.plaster));
  put(house, (H.minX + H.maxX) / 2, H.height / 2, (H.faceZ + H.backZ) / 2, scene);
  const brick = flag(new THREE.Mesh(new THREE.BoxGeometry(H.maxX - H.minX + 0.08, 0.55, H.faceZ - H.backZ + 0.08), mats.brick), false);
  put(brick, (H.minX + H.maxX) / 2, 0.27, (H.faceZ + H.backZ) / 2, scene);
  const roof = flag(new THREE.Mesh(new THREE.BoxGeometry(H.maxX - H.minX + 0.7, 0.28, H.faceZ - H.backZ + 0.9), mats.brick));
  put(roof, (H.minX + H.maxX) / 2, H.height + 0.1, (H.faceZ + H.backZ) / 2 + 0.15, scene);
  const chimney = flag(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.46), mats.brick));
  put(chimney, 2.2, H.height + 0.55, -7.2, scene);

  const sillX0 = LEVEL.sill.x - LEVEL.sill.w / 2;
  const sillX1 = LEVEL.sill.x + LEVEL.sill.w / 2;
  blocks.push({ minX: H.minX, maxX: sillX0, minZ: H.backZ, maxZ: H.faceZ, minY: 0, maxY: H.height });
  blocks.push({ minX: sillX1, maxX: H.maxX, minZ: H.backZ, maxZ: H.faceZ, minY: 0, maxY: H.height });
  blocks.push({ minX: sillX0, maxX: sillX1, minZ: H.backZ, maxZ: H.faceZ, minY: 0, maxY: 2.02 });
  blocks.push({ minX: sillX0, maxX: sillX1, minZ: H.backZ, maxZ: H.faceZ, minY: 3.05, maxY: H.height });

  function windowAt(x, y, w, h) {
    const frame = flag(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mats.woodDark), false);
    put(frame, x, y, H.faceZ + 0.02, scene);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), glass);
    put(pane, x, y, H.faceZ + 0.07, scene);
    const barV = flag(new THREE.Mesh(new THREE.BoxGeometry(0.04, h - 0.1, 0.05), mats.wood), false);
    put(barV, x, y, H.faceZ + 0.08, scene);
    const barH = flag(new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.04, 0.05), mats.wood), false);
    put(barH, x, y, H.faceZ + 0.08, scene);
  }
  windowAt(-5.6, 1.7, 1.15, 1.35);
  windowAt(-0.4, 1.65, 1.05, 1.25);
  windowAt(LEVEL.sill.x, 2.85, 1.25, 1.15);

  const door = flag(new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.55, 0.08), mats.woodDark));
  put(door, LEVEL.door.x, 0.78, H.faceZ + 0.05, scene);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mats.metal);
  put(knob, LEVEL.door.x + 0.28, 0.75, H.faceZ + 0.12, scene);
  const mat = flag(new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.02, 0.55), mats.clothRed), false);
  put(mat, LEVEL.door.x, 0.02, -4.85, scene);

  const step = LEVEL.step;
  const stepMesh = flag(new THREE.Mesh(new THREE.BoxGeometry(step.w, step.y, step.d), mats.stone));
  put(stepMesh, step.x, step.y / 2, step.z, scene);
  platforms.push({
    minX: step.x - step.w / 2, maxX: step.x + step.w / 2,
    minZ: step.z - step.d / 2, maxZ: step.z + step.d / 2,
    y: step.y, surface: 'stone',
  });

  const flowerBox = flag(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.32), mats.wood));
  put(flowerBox, -5.6, 0.95, H.faceZ + 0.22, scene);

  const sill = LEVEL.sill;
  const sillMesh = flag(new THREE.Mesh(new THREE.BoxGeometry(sill.w, 0.1, sill.d), mats.stone));
  put(sillMesh, sill.x, sill.y, sill.z, scene);
  const cushion = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.cushion);
  cushion.scale.set(0.42, 0.08, 0.28);
  put(cushion, sill.x, sill.y + 0.1, sill.z + 0.02, scene);
  cushion.castShadow = quality.shadows;
  platforms.push({
    minX: sill.x - sill.w / 2, maxX: sill.x + sill.w / 2,
    minZ: sill.z - sill.d / 2, maxZ: sill.z + sill.d / 2,
    y: sill.y + 0.05, surface: 'stone',
  });

  const curtainMat = std(0xf7f3ea, 0.95);
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.7), curtainMat);
  put(curtain, sill.x - 0.4, 2.85, H.faceZ + 0.1, scene);
  curtain.userData.baseRot = 0;

  // Garden walls
  function wall(x, z, w, d, h, platform) {
    const mesh = flag(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.plasterShade));
    put(mesh, x, h / 2, z, scene);
    const cap = flag(new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.1, d + 0.12), mats.brick), false);
    put(cap, x, h + 0.04, z, scene);
    blocks.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h });
    if (platform) {
      platforms.push({ minX: x - w / 2 - 0.05, maxX: x + w / 2 + 0.05, minZ: z - d / 2 - 0.05, maxZ: z + d / 2 + 0.05, y: h + 0.08, surface: 'stone' });
    }
  }
  wall(-12.15, 4.6, 0.55, 19.2, LEVEL.wallH, true);
  wall(12.15, 4.6, 0.55, 19.2, LEVEL.wallH, true);
  wall(-6.6, 14.15, 10.6, 0.5, LEVEL.wallH, true);
  wall(6.7, 14.15, 10.4, 0.5, LEVEL.wallH, true);
  // Gate
  for (let i = -2; i <= 2; i++) {
    const bar = flag(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, 0.06), mats.woodDark));
    put(bar, i * 0.28, 0.62, 14.15, scene);
  }
  const rail = flag(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), mats.woodDark));
  put(rail, 0, 1.15, 14.15, scene);
  blocks.push({ minX: -0.8, maxX: 0.8, minZ: 13.95, maxZ: 14.35, minY: 0, maxY: 1.25 });

  // Tree
  const T = LEVEL.tree;
  const trunk = flag(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.7, 8), mats.trunk));
  put(trunk, T.x, 0.85, T.z, scene);
  circles.push({ x: T.x, z: T.z, r: 0.32, minY: 0, maxY: 1.5 });
  const canopyGeo = new THREE.SphereGeometry(1, 10, 8);
  for (const [ox, oy, oz, s, mat] of [[0, 2.15, 0, 1.15, mats.leaf], [0.7, 2.4, 0.3, 0.8, mats.leafLite], [-0.6, 2.35, -0.2, 0.85, mats.hedge], [0.2, 2.9, -0.1, 0.7, mats.leaf]]) {
    const m = flag(new THREE.Mesh(canopyGeo, mat));
    m.scale.setScalar(s);
    put(m, T.x + ox, oy, T.z + oz, scene);
  }
  const branch = flag(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.4, 6), mats.trunk));
  branch.rotation.z = Math.PI / 2.6;
  branch.rotation.y = 0.4;
  put(branch, T.x + 0.7, 0.72, T.z - 0.15, scene);
  platforms.push({ minX: T.x + 0.15, maxX: T.x + 1.25, minZ: T.z - 0.45, maxZ: T.z + 0.15, y: 0.62, surface: 'wood' });

  // Bench
  const B = LEVEL.bench;
  const seat = flag(new THREE.Mesh(new THREE.BoxGeometry(B.w, B.seatThick, B.d), mats.wood));
  put(seat, B.x, B.seat, B.z, scene);
  const back = flag(new THREE.Mesh(new THREE.BoxGeometry(B.w, 0.42, 0.06), mats.wood));
  put(back, B.x, B.seat + 0.28, B.z - B.d / 2 + 0.04, scene);
  for (const sx of [-0.7, 0.7]) {
    for (const sz of [-0.18, 0.18]) {
      const leg = flag(new THREE.Mesh(new THREE.BoxGeometry(0.06, B.seat - 0.04, 0.06), mats.woodDark), false);
      put(leg, B.x + sx, (B.seat - 0.04) / 2, B.z + sz, scene);
    }
  }
  blocks.push({
    minX: B.x - B.w / 2, maxX: B.x + B.w / 2,
    minZ: B.z - B.d / 2, maxZ: B.z + B.d / 2,
    minY: B.seat - B.seatThick, maxY: B.seat + B.seatThick / 2,
  });
  blocks.push({
    minX: B.x - B.w / 2, maxX: B.x + B.w / 2,
    minZ: B.z - B.d / 2, maxZ: B.z - B.d / 2 + 0.1,
    minY: B.seat, maxY: B.seat + 0.5,
  });
  platforms.push({
    minX: B.x - B.w / 2, maxX: B.x + B.w / 2,
    minZ: B.z - B.d / 2, maxZ: B.z + B.d / 2,
    y: B.seat + B.seatThick / 2, surface: 'wood',
  });

  // Bird table
  const bird = LEVEL.bird;
  const pole = flag(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, bird.top, 6), mats.woodDark));
  put(pole, bird.x, bird.top / 2, bird.z, scene);
  circles.push({ x: bird.x, z: bird.z, r: 0.16, minY: 0, maxY: bird.top });
  const top = flag(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.7), mats.wood));
  put(top, bird.x, bird.top, bird.z, scene);
  const littleRoof = flag(new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.28, 4), mats.brick));
  littleRoof.rotation.y = Math.PI / 4;
  put(littleRoof, bird.x, bird.top + 0.38, bird.z, scene);
  platforms.push({ minX: bird.x - 0.32, maxX: bird.x + 0.32, minZ: bird.z - 0.32, maxZ: bird.z + 0.32, y: bird.top + 0.04, surface: 'wood' });

  // Laundry
  const Ln = LEVEL.laundry;
  const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.6, 6);
  const postA = flag(new THREE.Mesh(postGeo, mats.woodDark));
  put(postA, Ln.x1, 0.8, Ln.z1, scene);
  const postB = flag(new THREE.Mesh(postGeo, mats.woodDark));
  put(postB, Ln.x2, 0.8, Ln.z2, scene);
  circles.push({ x: Ln.x1, z: Ln.z1, r: 0.12, minY: 0, maxY: 1.5 });
  circles.push({ x: Ln.x2, z: Ln.z2, r: 0.12, minY: 0, maxY: 1.5 });
  const lineLen = Math.hypot(Ln.x2 - Ln.x1, Ln.z2 - Ln.z1);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, lineLen, 4), mats.woodDark);
  line.position.set((Ln.x1 + Ln.x2) / 2, Ln.y, (Ln.z1 + Ln.z2) / 2);
  line.rotation.z = Math.PI / 2;
  line.rotation.y = Math.atan2(Ln.z2 - Ln.z1, Ln.x2 - Ln.x1);
  scene.add(line);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.06), mats.cloth);
  const sock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.05), mats.clothBlue);
  scene.add(shirt, sock);

  // Stump
  const stump = flag(new THREE.Mesh(new THREE.CylinderGeometry(LEVEL.stump.r, LEVEL.stump.r + 0.04, LEVEL.stump.y, 8), mats.trunk));
  put(stump, LEVEL.stump.x, LEVEL.stump.y / 2, LEVEL.stump.z, scene);
  circles.push({ x: LEVEL.stump.x, z: LEVEL.stump.z, r: LEVEL.stump.r, minY: 0, maxY: LEVEL.stump.y });
  platforms.push({
    minX: LEVEL.stump.x - LEVEL.stump.r, maxX: LEVEL.stump.x + LEVEL.stump.r,
    minZ: LEVEL.stump.z - LEVEL.stump.r, maxZ: LEVEL.stump.z + LEVEL.stump.r,
    y: LEVEL.stump.y, surface: 'wood',
  });

  // Pond water
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = 128;
  normalCanvas.height = 128;
  const ng = normalCanvas.getContext('2d');
  const img = ng.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = Math.cos(x * 0.17) * Math.cos(y * 0.13);
      const dy = Math.sin(y * 0.19 + x * 0.05);
      const i = (y * 128 + x) * 4;
      img.data[i] = 128 + dx * 40;
      img.data[i + 1] = 128 + dy * 40;
      img.data[i + 2] = 230;
      img.data[i + 3] = 255;
    }
  }
  ng.putImageData(img, 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(2.5, 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3e8f8a,
    roughness: 0.18,
    metalness: 0.04,
    transparent: true,
    opacity: 0.86,
    normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 36), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.scale.set(LEVEL.pond.rx, LEVEL.pond.rz, 1);
  water.position.set(LEVEL.pond.x, 0.03, LEVEL.pond.z);
  water.receiveShadow = true;
  scene.add(water);

  const lilyGeo = new THREE.CircleGeometry(0.28, 8);
  const lilyMat = std(0x3f7a45, 0.8);
  const lilies = [];
  for (let i = 0; i < 4; i++) {
    const lily = new THREE.Mesh(lilyGeo, lilyMat);
    lily.rotation.x = -Math.PI / 2;
    const a = i * 1.4;
    lily.position.set(LEVEL.pond.x + Math.cos(a) * 1.3, 0.045, LEVEL.pond.z + Math.sin(a) * 0.9);
    lily.receiveShadow = true;
    scene.add(lily);
    lilies.push(lily);
  }
  const reedGeo = new THREE.ConeGeometry(0.03, 0.7, 4);
  const reeds = new THREE.InstancedMesh(reedGeo, mats.leaf, 18);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 0.75 + rand() * 0.3;
    dummy.position.set(LEVEL.pond.x + Math.cos(a) * LEVEL.pond.rx * rad, 0.35, LEVEL.pond.z + Math.sin(a) * LEVEL.pond.rz * rad);
    dummy.rotation.z = (rand() - 0.5) * 0.2;
    dummy.scale.set(1, 0.7 + rand() * 0.6, 1);
    dummy.updateMatrix();
    reeds.setMatrixAt(i, dummy.matrix);
  }
  scene.add(reeds);

  // Grass
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.035, 0, 0, 0.035, 0, 0, 0.01, 0.32, 0.012,
    -0.02, 0, 0.02, 0.025, 0, -0.015, -0.005, 0.24, 0.01,
  ], 3));
  blade.setIndex([0, 1, 2, 3, 4, 5]);
  blade.computeVertexNormals();
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7ea84a, roughness: 0.95, side: THREE.DoubleSide });
  const grassCount = quality.grass;
  const grass = new THREE.InstancedMesh(blade, grassMat, grassCount);
  grass.receiveShadow = true;
  let gi = 0;
  let guard = 0;
  while (gi < grassCount && guard < grassCount * 12) {
    guard += 1;
    const x = -12 + rand() * 24;
    const z = -4.6 + rand() * 18.5;
    if (z < H.faceZ + 0.3) continue;
    let dPath = 99;
    for (let p = 0; p < pathPts.length - 1; p++) {
      dPath = Math.min(dPath, segDist(x, z, pathPts[p][0], pathPts[p][1], pathPts[p + 1][0], pathPts[p + 1][1]));
    }
    if (dPath < 0.85) continue;
    const pdx = (x - LEVEL.pond.x) / LEVEL.pond.rx;
    const pdz = (z - LEVEL.pond.z) / LEVEL.pond.rz;
    if (pdx * pdx + pdz * pdz < 1.05) continue;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    const s = 0.65 + rand() * 0.5;
    dummy.scale.set(s, 0.4 + rand() * 0.45, s);
    dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix);
    gi += 1;
  }
  grass.count = gi;
  scene.add(grass);

  // Flowers
  const flowerColors = [0xd85048, 0xf0c14d, 0xf7f1e4, 0xd46a9a, 0xe7e0c8];
  const stemMat = std(0x3e6b38, 0.9);
  const headMat = std(0xffffff, 0.7);
  const flowerCount = quality.flowers;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.014, 0.22, 4), stemMat, flowerCount);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 6, 5), headMat, flowerCount);
  const flowerSpots = [];
  let fi = 0;
  guard = 0;
  while (fi < flowerCount && guard < flowerCount * 10) {
    guard += 1;
    let x = 0;
    let z = 0;
    const which = rand();
    if (which < 0.38) { x = -11.6 + rand() * 1.1; z = -3.5 + rand() * 16; }
    else if (which < 0.76) { x = 10.6 + rand() * 1.1; z = -3.5 + rand() * 16; }
    else { x = -6 + rand() * 12; z = -4.7 + rand() * 0.8; }
    dummy.position.set(x, 0.11, z);
    dummy.rotation.set(0, rand(), 0);
    dummy.scale.set(1, 0.75 + rand() * 0.6, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(fi, dummy.matrix);
    dummy.position.y = 0.22 + rand() * 0.04;
    const bloom = 0.85 + rand() * 0.4;
    dummy.scale.set(bloom, bloom * 0.42, bloom);
    dummy.updateMatrix();
    heads.setMatrixAt(fi, dummy.matrix);
    heads.setColorAt(fi, c.setHex(flowerColors[fi % flowerColors.length]));
    flowerSpots.push([x, z]);
    fi += 1;
  }
  stems.count = fi;
  heads.count = fi;
  scene.add(stems, heads);

  // Ivy
  const ivy = LEVEL.ivy;
  const leafMat = std(0x2f6a3a, 0.85);
  const ivyCount = quality.software ? 24 : 48;
  const ivyMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 5), leafMat, ivyCount);
  for (let i = 0; i < ivyCount; i++) {
    const y = rand() * ivy.top;
    const a = rand() * Math.PI * 2;
    const r = 0.12 + rand() * 0.38;
    dummy.position.set(ivy.x + Math.cos(a) * r, y, ivy.z + Math.sin(a) * r * 0.8);
    dummy.lookAt(ivy.x, y, ivy.z);
    dummy.rotateZ(rand() * 3);
    dummy.scale.setScalar(0.6 + rand() * 0.9);
    dummy.updateMatrix();
    ivyMesh.setMatrixAt(i, dummy.matrix);
  }
  scene.add(ivyMesh);
  const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, ivy.top, 5), mats.trunk);
  put(vine, ivy.x, ivy.top / 2, ivy.z, scene);

  // Hedge bumps along the south beds
  for (let i = 0; i < 8; i++) {
    const h = flag(new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mats.hedge));
    h.scale.y = 0.7;
    put(h, -4.2 + i * 1.15, 0.3, 13.25, scene);
  }
  for (let i = 0; i < 7; i++) {
    const h = flag(new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), mats.hedge));
    h.position.set(-10.8, 0.28, -2 + i * 1.8);
    h.scale.y = 0.65;
    scene.add(h);
  }

  // A couple of boots by the door, for the story of someone who left.
  const bootMat = std(0x3a2a24, 0.8);
  for (const s of [-1, 1]) {
    const boot = flag(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.22), bootMat), false);
    put(boot, LEVEL.door.x + 0.7, 0.07, -4.55 + s * 0.08, scene);
  }

  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(1.1, 0.03, 2.35);
  scene.add(patch);
  let patchLight = null;
  if (!quality.software) {
    patchLight = new THREE.SpotLight(0xffd2a0, 0.55, 7, 0.85, 0.75, 1);
    patchLight.position.set(1.1, 4.5, 2.35);
    patchLight.target.position.copy(patch.position);
    scene.add(patchLight, patchLight.target);
  }

  const flyPositions = new Float32Array(12 * 3);
  const flies = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(flyPositions, 3)),
    new THREE.PointsMaterial({ color: 0xffe38a, size: 4, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(flies);

  const sunDirection = new THREE.Vector3();
  let smokeT = 0;
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xf4f0ea, transparent: true, opacity: 0.25, depthWrite: false }));
    scene.add(s);
    smoke.push(s);
  }

  function surfaceAt(x, z) {
    let dPath = 99;
    for (let p = 0; p < pathPts.length - 1; p++) {
      dPath = Math.min(dPath, segDist(x, z, pathPts[p][0], pathPts[p][1], pathPts[p + 1][0], pathPts[p + 1][1]));
    }
    if (dPath < 0.9) return 'stone';
    return 'grass';
  }

  function pondFactor(x, z) {
    const dx = (x - LEVEL.pond.x) / LEVEL.pond.rx;
    const dz = (z - LEVEL.pond.z) / LEVEL.pond.rz;
    return Math.hypot(dx, dz);
  }

  function update(dt, env) {
    const t = env.sunT;
    const night = env.night;
    const az = -0.35 + t * 1.35;
    const elev = 1.12 - t * 1.02;
    const horiz = Math.cos(clamp(elev, -0.2, 1.2));
    sunDirection.set(Math.sin(az) * horiz, Math.sin(clamp(elev, -0.35, 1.2)), Math.cos(az) * horiz).normalize();
    const center = sun.target.position.set(0.5, 0.5, 4);
    sun.position.copy(center).addScaledVector(sunDirection, 26);
    sun.intensity = lerp(2.45, 0.15, night);
    sun.color.setHex(night > 0.5 ? 0xb9c8e8 : 0xffe0b8);
    hemi.intensity = lerp(0.72, 0.22, night);
    hemi.color.setHex(night > 0.5 ? 0x223048 : 0xd7ecff);
    hemi.groundColor.setHex(night > 0.5 ? 0x1a1814 : 0xc4a07a);
    fill.intensity = lerp(0.28, 0.08, night);
    skyMat.color.setRGB(lerp(1, 0.16, night), lerp(1, 0.2, night), lerp(1, 0.34, night));
    scene.fog.color.setRGB(lerp(0.95, 0.07, night), lerp(0.84, 0.09, night), lerp(0.7, 0.16, night));
    glass.emissiveIntensity = lerp(0.28, 1.35, night);
    sunSprite.position.copy(sunDirection).multiplyScalar(42);
    sunSprite.material.opacity = 1 - night;
    const moonDir = sunDirection.clone().multiplyScalar(-1);
    moonDir.y = Math.abs(moonDir.y) + 0.25;
    moonSprite.position.copy(moonDir.normalize()).multiplyScalar(40);
    moonSprite.material.opacity = smoothstep((night - 0.2) / 0.6);
    stars.material.opacity = smoothstep((night - 0.25) / 0.5);
    normalMap.offset.x += dt * 0.035;
    normalMap.offset.y += dt * 0.02;

    for (const cloud of clouds) {
      cloud.position.x = cloud.userData.base.x + Math.sin(env.time * cloud.userData.speed) * 1.4;
    }
    const sway = Math.sin(env.time * 1.3) * 0.12;
    const dx = Ln.x2 - Ln.x1;
    const dz = Ln.z2 - Ln.z1;
    shirt.position.set(Ln.x1 + dx * 0.38, Ln.y - 0.28 + sway * 0.05, Ln.z1 + dz * 0.38);
    shirt.rotation.z = sway;
    sock.position.set(Ln.x1 + dx * 0.68, Ln.y - 0.2 + sway * 0.08, Ln.z1 + dz * 0.68);
    sock.rotation.z = -sway * 0.8;
    curtain.rotation.y = Math.sin(env.time * 0.8) * 0.12;

    smokeT += dt;
    for (let i = 0; i < smoke.length; i++) {
      const u = ((smokeT * 0.18 + i / smoke.length) % 1);
      smoke[i].position.set(2.2 + Math.sin(u * 6 + i) * 0.15, H.height + 0.9 + u * 1.4, -7.2);
      smoke[i].scale.setScalar(0.6 + u * 1.4);
      smoke[i].material.opacity = (1 - u) * 0.22 * (1 - night * 0.4);
    }

    const flyAttr = flies.geometry.attributes.position;
    for (let i = 0; i < 12; i++) {
      const a = env.time * 0.7 + i;
      flyAttr.setXYZ(i, Math.sin(a * 1.3 + i) * 4 + (i % 3), 0.5 + (Math.sin(a * 2 + i) * 0.5 + 0.5) * 1.2, 3 + Math.cos(a + i * 0.7) * 3);
    }
    flyAttr.needsUpdate = true;
    flies.material.opacity = smoothstep((night - 0.35) / 0.4);

    if (patchLight) {
      patchLight.position.set(patch.position.x, 4.2, patch.position.z);
      patchLight.target.position.set(patch.position.x, 0, patch.position.z);
      patchLight.intensity = (1 - night) * 0.55;
    }
    patch.material.opacity = (0.1 + Math.sin(env.time * 2) * 0.02) * (1 - night * 0.7);
  }

  function setShadows(on) {
    renderer.shadowMap.enabled = on;
    sun.castShadow = on;
    quality.shadows = on;
  }

  return {
    blocks,
    circles,
    platforms,
    update,
    surfaceAt,
    pondFactor,
    patch,
    setShadows,
    mats,
    flowerSpots,
  };
}
